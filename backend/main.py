try:
    from app import create_app
except ModuleNotFoundError:  # pragma: no cover
    from backend.app import create_app

app = create_app()
