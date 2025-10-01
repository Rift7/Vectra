from django.urls import path

from .views import celery_ping, celery_result

urlpatterns = [
    path("celery/ping/", celery_ping, name="celery-ping"),
    path("celery/result/<str:task_id>/", celery_result, name="celery-result"),
]
