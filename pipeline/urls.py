from django.urls import path

from .views import run_pipeline_view

urlpatterns = [
    path("pipeline/run/", run_pipeline_view, name="pipeline-run"),
]
