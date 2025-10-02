from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MachineProfileViewSet

router = DefaultRouter()
router.register(r"machine-profiles", MachineProfileViewSet, basename="machine-profile")

urlpatterns = [
    path("", include(router.urls)),
]
