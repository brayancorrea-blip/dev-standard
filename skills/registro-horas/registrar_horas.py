"""
Registra horas laborales en Ripor (https://ripor.co/u/horas).

Login: Google OAuth → storage_state.json (cookies + localStorage).
  - Primera corrida: --login-manual. Abre Chrome visible, haces login una vez.
  - Siguientes corridas: carga state.json automáticamente.

Uso:
  python skills/registro-horas/registrar_horas.py --login-manual
  python skills/registro-horas/registrar_horas.py --descripcion "..." --evidencia "..." [--fecha YYYY-MM-DD]

Dependencias: pip install playwright && playwright install chromium
"""

import argparse
import sys
import traceback
from datetime import date
from pathlib import Path

# Permitir importar skills/_common.py cuando se ejecuta directamente.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _common import (
    DEFAULT_VIEWPORT,
    add_browser_args,
    capturas_dir,
    snap,
    warn_if_world_readable,
)

from playwright.sync_api import Page, sync_playwright

RIPOR_URL = "https://ripor.co/u"
RIPOR_HORAS_URL = "https://ripor.co/u/horas"

PROYECTO_DEFAULT = "005 - PROYECTO POSITIVA SGDEA 2026 - 3T"
TAREA_DEFAULT = "Tarea Personalizada"
HORAS_DEFAULT = 9
TRANSPORTE_DEFAULT = "🏍️ Moto particular"

STATE_FILE = Path(__file__).resolve().parent / "state.json"
CAPTURAS = capturas_dir(__file__)

LAUNCH_ARGS = {
    "channel": "chrome",
    "ignore_default_args": ["--enable-automation"],
    "args": ["--disable-blink-features=AutomationControlled"],
}


def _login_manual(pw) -> None:
    print("[ripor] Abriendo Chrome para login manual con Google...")
    print("[ripor] Haz login en ESTA ventana (sin tus extensiones). Tienes 8 min.")
    browser = pw.chromium.launch(headless=False, **LAUNCH_ARGS)
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()
    page.goto(RIPOR_URL, wait_until="domcontentloaded")
    try:
        page.wait_for_function(
            "() => !location.pathname.startsWith('/login') && !location.hostname.includes('google')",
            timeout=480000,
        )
        # Supabase escribe en localStorage de forma async tras el redirect.
        page.wait_for_function(
            "() => Object.keys(localStorage).some(k => k.includes('sb-') && k.includes('auth'))",
            timeout=10000,
        )
        print(f"[ripor] ✅ Login detectado. URL: {page.url}")
        context.storage_state(path=str(STATE_FILE))
        warn_if_world_readable(STATE_FILE)
        print(f"[ripor] Estado guardado en: {STATE_FILE.name}")
    except Exception as e:
        context.close()
        browser.close()
        sys.exit(
            f"❌ Timeout o error en login: {type(e).__name__}: {e}\n"
            "Relanza --login-manual y completa el flujo Google OAuth."
        )
    context.close()
    browser.close()


_MESES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
             "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]


def _seleccionar_fecha(page: Page, fecha: date) -> None:
    valor = fecha.isoformat()
    locator = page.locator(f'[data-calendar-day][data-value="{valor}"]').first
    if locator.count() == 0:
        raise RuntimeError(f"No se encontró el día {valor} en el calendario visible")
    estado = locator.evaluate(
        "el => ({disabled: el.hasAttribute('data-disabled'), ariaDisabled: el.getAttribute('aria-disabled')})"
    )
    if estado["disabled"] or estado["ariaDisabled"] == "true":
        raise RuntimeError(f"El día {valor} está deshabilitado (no hábil o bloqueado)")

    esperado = f"{fecha.day} de {_MESES_ES[fecha.month - 1]} de {fecha.year}"

    def _panel_muestra_fecha() -> bool:
        try:
            page.wait_for_function(
                "t => document.body.innerText.includes(t)",
                arg=esperado,
                timeout=2000,
            )
            return True
        except Exception:
            return False

    for intento, estrategia in enumerate(["click", "force", "dispatch"], start=1):
        if estrategia == "click":
            locator.click()
        elif estrategia == "force":
            locator.click(force=True)
        else:
            locator.dispatch_event("click")
        if _panel_muestra_fecha():
            if intento > 1:
                print(f"      fecha fijada tras estrategia '{estrategia}'")
            return

    snap(page, CAPTURAS, "error_fecha_no_fijada", enabled=True)
    html_celda = locator.evaluate("el => el.outerHTML")
    html_padre = locator.evaluate("el => el.parentElement?.outerHTML")
    (CAPTURAS / "error_fecha_no_fijada.html").write_text(
        f"CELDA:\n{html_celda}\n\nPADRE:\n{html_padre}"
    )
    raise RuntimeError(
        f"Ningún tipo de click (normal/force/dispatch) fijó la fecha {valor}. "
        f"HTML volcado en capturas/error_fecha_no_fijada.html."
    )


def _rellenar_modal(
    page: Page,
    proyecto: str,
    tarea: str,
    horas: int,
    descripcion: str,
    evidencia: str,
    transporte: str,
) -> None:
    page.wait_for_selector("#project-input", state="visible", timeout=15000)

    page.fill("#project-input", proyecto)
    page.press("#project-input", "Tab")

    # Dropdown custom con checkboxes. Abrir y marcar.
    page.locator("form").get_by_text("Seleccione...", exact=False).first.click()
    item = page.locator(f"div.flex.items-center:has(p:text-is('{tarea}'))").first
    item.locator("input[type='checkbox']").click()

    # Al seleccionar la tarea aparece input[type=number] para horas.
    horas_input = page.locator('form input[type="number"]').first
    horas_input.wait_for(state="visible", timeout=5000)
    horas_input.fill(str(horas))

    page.fill("#textarea-description", descripcion)
    page.fill("#project-input-evidencia", evidencia)
    page.fill("#medio-transporte-input", transporte)
    page.press("#medio-transporte-input", "Tab")


def registrar_horas(
    descripcion: str,
    evidencia: str,
    proyecto: str = PROYECTO_DEFAULT,
    tarea: str = TAREA_DEFAULT,
    horas: int = HORAS_DEFAULT,
    transporte: str = TRANSPORTE_DEFAULT,
    fecha: date | None = None,
    headless: bool = False,
    dry_run: bool = False,
) -> dict:
    fecha = fecha or date.today()

    if not STATE_FILE.exists():
        sys.exit(
            f"❌ No hay sesión guardada ({STATE_FILE.name}). Ejecuta primero:\n"
            f"   python skills/registro-horas/registrar_horas.py --login-manual"
        )
    warn_if_world_readable(STATE_FILE)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless, **LAUNCH_ARGS)
        context = browser.new_context(
            storage_state=str(STATE_FILE),
            viewport=DEFAULT_VIEWPORT,
        )
        page = context.new_page()

        print(f"[ripor] Navegando a {RIPOR_HORAS_URL}...")
        page.goto(RIPOR_HORAS_URL, wait_until="domcontentloaded", timeout=30000)

        try:
            page.wait_for_selector('[data-calendar-day][data-today]', timeout=20000)
        except Exception:
            if "/login" in page.url:
                snap(page, CAPTURAS, "sesion_expirada", enabled=True)
                context.close()
                browser.close()
                sys.exit(
                    "❌ Sesión de Google expiró. Relanza con --login-manual para renovarla."
                )
            raise

        print(f"[ripor] Fecha a registrar: {fecha}")
        _seleccionar_fecha(page, fecha)

        print("[ripor] Abriendo modal de registro...")
        page.get_by_role("button", name="Registrar").first.click()

        print("[ripor] Llenando formulario...")
        _rellenar_modal(page, proyecto, tarea, horas, descripcion, evidencia, transporte)
        snap(page, CAPTURAS, "form_lleno", enabled=dry_run)

        if dry_run:
            print("[ripor] DRY-RUN: no se envía")
            resultado = {"dry_run": True, "fecha": str(fecha)}
        else:
            print("[ripor] Enviando (Continuar)...")
            page.get_by_role("button", name="Continuar").click()
            try:
                page.wait_for_function(
                    "!document.querySelector('#project-input')",
                    timeout=15000,
                )
                print("[ripor] ✅ Registrado")
                context.storage_state(path=str(STATE_FILE))
                resultado = {"ok": True, "fecha": str(fecha), "horas": horas}
            except Exception as e:
                snap(page, CAPTURAS, "error_submit")
                try:
                    (CAPTURAS / "error_submit.html").write_text(page.content())
                except Exception:
                    pass
                resultado = {
                    "ok": False,
                    "error": f"{type(e).__name__}: {e}",
                    "trace": traceback.format_exc(limit=3),
                }

        context.close()
        browser.close()
        return resultado


def main() -> None:
    parser = argparse.ArgumentParser(description="Registra horas en Ripor")
    parser.add_argument("--login-manual", action="store_true",
                        help="Abre Chrome para login Google una vez (guarda state.json)")
    parser.add_argument("--descripcion", help="Descripción de actividades")
    parser.add_argument("--evidencia", help="URL de evidencia")
    parser.add_argument("--proyecto", default=PROYECTO_DEFAULT)
    parser.add_argument("--horas", type=int, default=HORAS_DEFAULT)
    parser.add_argument("--transporte", default=TRANSPORTE_DEFAULT)
    parser.add_argument("--fecha", help="YYYY-MM-DD (default: hoy)")
    add_browser_args(parser)
    args = parser.parse_args()

    if args.login_manual:
        with sync_playwright() as pw:
            _login_manual(pw)
        return

    descripcion = (args.descripcion or "").strip()
    evidencia = (args.evidencia or "").strip()
    if not descripcion or not evidencia:
        sys.exit("❌ --descripcion y --evidencia son obligatorios (no pueden estar vacíos)")

    fecha = date.fromisoformat(args.fecha) if args.fecha else None
    resultado = registrar_horas(
        descripcion=descripcion,
        evidencia=evidencia,
        proyecto=args.proyecto,
        tarea=TAREA_DEFAULT,
        horas=args.horas,
        transporte=args.transporte,
        fecha=fecha,
        headless=args.headless,
        dry_run=args.dry_run,
    )
    print(f"\nResultado: {resultado}")
    if resultado.get("ok") is False:
        sys.exit(1)


if __name__ == "__main__":
    main()
