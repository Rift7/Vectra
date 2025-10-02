from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MachineProfileViewSet, ToolViewSet

router = DefaultRouter()
router.register(r"machine-profiles", MachineProfileViewSet, basename="machine-profile")
router.register(r"tools", ToolViewSet, basename="tool")

urlpatterns = [
    path("", include(router.urls)),
]
