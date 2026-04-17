"""Utilidades compartidas entre las skills de Playwright."""

from argparse import ArgumentParser
from pathlib import Path

DEFAULT_VIEWPORT = {"width": 1440, "height": 900}


def capturas_dir(script_file: str) -> Path:
    """Crea (si hace falta) y retorna skills/<skill>/capturas/ relativo al script."""
    ruta = Path(script_file).resolve().parent / "capturas"
    ruta.mkdir(exist_ok=True)
    return ruta


def snap(page, dir_: Path, nombre: str, enabled: bool = True) -> None:
    """Screenshot full-page condicional."""
    if not enabled:
        return
    ruta = dir_ / f"{nombre}.png"
    page.screenshot(path=str(ruta), full_page=True)
    print(f"      📸 {ruta.name}")


def add_browser_args(parser: ArgumentParser) -> None:
    """Añade --headless y --dry-run con textos unificados entre skills."""
    parser.add_argument(
        "--headless", action="store_true",
        help="Ocultar navegador (por defecto se muestra)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Llena el formulario pero no envía",
    )


def warn_if_world_readable(path: Path) -> None:
    """Imprime un warning si `path` es legible por otros usuarios (perms > 600)."""
    try:
        mode = path.stat().st_mode & 0o777
        if mode & 0o077:
            print(
                f"⚠️  {path.name} tiene permisos {oct(mode)} — ejecuta "
                f"`chmod 600 {path}` para restringir."
            )
    except FileNotFoundError:
        pass
