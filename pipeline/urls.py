from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import run_pipeline_view
from .views_saved import PipelineRunViewSet, PipelineViewSet

router = DefaultRouter()
router.register(r"pipelines", PipelineViewSet, basename="pipeline")
router.register(r"pipeline-runs", PipelineRunViewSet, basename="pipeline-run")

urlpatterns = [
    path("pipeline/run/", run_pipeline_view, name="pipeline-run-adhoc"),
    path("", include(router.urls)),
]
