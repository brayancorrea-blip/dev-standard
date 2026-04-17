---
name: registro-horas
description: Registra las horas laborales diarias en Ripor (ripor.co). Úsalo cuando el usuario pida "registrar horas", "llenar ripor", "reportar jornada" o similares.
---

# registro-horas

Registra jornada laboral en Ripor con los valores fijos del equipo:
- Proyecto: `005 - PROYECTO POSITIVA SGDEA 2026 - 3T`
- Tarea: `Tarea Personalizada`
- Horas: `9` (default)
- Medio de transporte: `🏍️ Moto particular`

Lo único que varía día a día: **descripción de actividades** y **URL de evidencia**.

## Manejo de fechas

Cuando el usuario dice "llena el ripor de **hoy**", "de **ayer**", "del **viernes pasado**", etc., **convierte a formato YYYY-MM-DD** usando la fecha actual del sistema (`date +%Y-%m-%d`) y pásala con `--fecha`. Si el usuario no dice nada sobre fecha, asume **hoy**.

Ejemplos:
- "hoy" → `--fecha 2026-04-17` (hoy)
- "ayer" → `--fecha 2026-04-16`
- "el lunes" → calcular el lunes más reciente pasado

Siempre menciona explícitamente al usuario qué fecha vas a usar antes de enviar.

## Flujo conversacional

Cuando el usuario invoque `/registro-horas`:

### 1. Pregunta las tareas del día

Formula una pregunta tipo:
> ¿Qué tareas hiciste hoy? Dime las actividades principales (puedo ayudarte a resumirlas si me das bullets).

Si el usuario responde con bullets o texto largo, **resúmelo en 1-3 frases claras** (máx. ~400 caracteres), en español, redacción profesional, usando verbos de acción:
- ✅ "Configuré Cloud SQL en positiva-sgda-cap, corregí deduplicación de tutelas en Redis y creé skill de tickets con Playwright."
- ❌ "Hice varias cosas hoy del proyecto."

### 2. Pregunta la evidencia

> ¿URL de evidencia? (repo, commit, PR, doc, dashboard, ticket...)

Si el usuario no tiene una clara:
- Sugiere el PR/commit del día si hay actividad en git (ejecuta `git log --since="1 day ago" --oneline` para inspirar).
- O pídele un Google Doc / link de Azure DevOps.

**No inventes URLs.** Si el usuario no da ninguna, pregunta de nuevo o propón una opción concreta.

### 3. Confirma antes de enviar

Muestra un resumen compacto:
```
Voy a registrar en Ripor:
  Fecha:       2026-04-17
  Proyecto:    005 - PROYECTO POSITIVA SGDEA 2026 - 3T
  Horas:       9
  Descripción: <lo que escribiste>
  Evidencia:   <URL>
  Transporte:  🏍️ Moto particular

¿Lo envío? (sí / editar / cancelar)
```

### 4. Ejecuta el script

Si confirma, corre desde la raíz del repo:

```bash
python skills/registro-horas/registrar_horas.py \
  --descripcion "<descripción>" \
  --evidencia "<url>"
```

Parámetros opcionales si el usuario los pidió:
- `--horas N` (default 9)
- `--fecha YYYY-MM-DD` (default: hoy)
- `--transporte "..."` (default: Moto particular)

### 5. Reporta el resultado

El script imprime un JSON con `ok: true` y la fecha, o un error. Pásale eso al usuario.

## Primer uso (setup por usuario)

Cada compañero, una sola vez, debe hacer el login de Google manual:

```bash
# 1. Instalar deps (si no las tiene)
pip install playwright && playwright install chromium

# 2. Login manual (abre navegador visible)
python skills/registro-horas/registrar_horas.py --login-manual
```

Tras el login la sesión queda en `skills/registro-horas/state.json` (gitignored). Después de eso la skill corre en segundos reutilizando esa sesión.

Si más adelante la sesión expira, el script dirá:
```
❌ Sesión de Google expiró. Relanza con --login-manual para renovarla.
```

## Debug

El navegador se abre visible por defecto. Para inspeccionar sin enviar usa `--dry-run`:

```bash
python skills/registro-horas/registrar_horas.py \
  --descripcion "test" --evidencia "https://test.com" --dry-run
```

Las capturas quedan en `skills/registro-horas/capturas/`. Añade `--headless` si quieres ocultar el navegador.

## Reglas

- **Nunca** envíes sin mostrar el resumen y esperar confirmación del usuario.
- La descripción debe ser profesional, sin emojis ni markdown (Ripor la muestra como texto plano).
- La URL de evidencia debe ser real y verificable — no URLs genéricas tipo `https://example.com`.
- Si la fecha no es hoy, avisa al usuario explícitamente ("voy a registrar para 2026-04-15 retroactivamente").
