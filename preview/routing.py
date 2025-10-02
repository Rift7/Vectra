from django.urls import re_path

from .consumers import PreviewConsumer

websocket_urlpatterns = [
    re_path(r"^ws/preview/run/$", PreviewConsumer.as_asgi()),
]
