from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AssetViewSet, ProjectViewSet

router = DefaultRouter()
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"assets", AssetViewSet, basename="asset")

urlpatterns = [
    path("", include(router.urls)),
]
