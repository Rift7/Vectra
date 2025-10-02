from django.apps import AppConfig


class PipelineConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "pipeline"

    def ready(self) -> None:  # ensure steps register on startup
        from . import steps  # noqa: F401
