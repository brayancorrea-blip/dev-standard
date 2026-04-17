---
name: ticket-infra
description: Crea un ticket en la mesa de servicio Confiani (Proceso de Ingeniería Cloud → Gestión GCP, centro de costos [0004008]). Úsalo cuando el usuario pida "crear un ticket de infra", "subir un ticket a la mesa", "pedir permisos a DevOps", "pedir habilitación de API en GCP", o cualquier solicitud que deba escalarse al equipo de infraestructura.
---

# ticket-infra

Crea tickets en `https://erp.confiani.com/helpdesk` con la combinación fija del equipo de Agentes de IA Positiva.

## Campos fijos (NO cambian)

- **Centro de costos:** `[0004008] 004 - PROYECTO POSITIVA SGDEA 2025 - 3T`
- **Proceso:** `Proceso de Ingeniería Cloud`
- **Nombre del servicio:** `Gestión - GCP`

## Flujo a seguir

### 1. Derivar asunto y descripción

A partir de la petición del usuario, genera:

- **Asunto** (máx. 70 caracteres): frase corta y accionable.
  - ✅ "Configurar Cloud SQL + VPC en ms-radicacion-ia-tutelas DEV"
  - ✅ "Habilitar Cloud SQL Admin API en positiva-sgda-cap"
  - ❌ "Ayuda" / "Urgente" / textos largos con verbo repetido

- **Descripción** (texto plano, sin markdown): debe ser auto-suficiente para el técnico de infraestructura. Incluir siempre:
  - Proyecto GCP y ambiente (DEV/UAT/PRD)
  - Servicio o recurso afectado
  - Problema o necesidad (evidencia: log, error exacto)
  - Acciones concretas a realizar (en pasos, con nombres de recursos exactos)
  - Justificación técnica breve
  - Cómo validar que quedó listo

Si ya hay un archivo de ticket preparado en el repo (por ejemplo `TICKET_INFRA_DEV.txt`), úsalo directamente como descripción.

### 2. Escribir la descripción a un archivo temporal

```bash
cat > ticket_descripcion.txt <<'EOF'
<contenido de la descripción>
EOF
```

`ticket_descripcion.txt` está en `.gitignore` — no se commitea.

### 3. Ejecutar el script

Desde la raíz del repo:

```bash
python skills/ticket-infra/crear_ticket_confiani.py \
  --asunto "<asunto generado>" \
  --descripcion-archivo ticket_descripcion.txt
```

Si hay evidencia adicional (log, captura), agrega `--adjunto ruta/archivo` (se puede repetir).

### 4. Reportar

El script imprime el número del ticket (`TICKET/NNNNN`) y la URL pública. Pasa ambos al usuario.

Si falla:
- `Login falló` → credenciales en `.env` incorrectas; pide al usuario que las corrija.
- `No se encontró option con texto...` → Confiani cambió el catálogo; el navegador se abre visible por defecto — revisa qué opciones ofrece el select.
- `ModuleNotFoundError: playwright` → `pip install playwright && playwright install chromium`.

### 5. Limpieza

Borra `ticket_descripcion.txt` después de crear el ticket.

## Reglas

- **Nunca** commitear `.env` ni credenciales.
- Asunto ≤ 70 caracteres.
- Descripción en español, texto plano, sin emojis ni markdown (se copia en Odoo como texto).
- Incluye siempre el proyecto GCP y los comandos/recursos literales para que quien reciba el ticket no tenga que adivinar nada.
