import os
from django.core.asgi import get_asgi_application
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter

import preview.routing

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vectra.settings")

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(preview.routing.websocket_urlpatterns)
    ),
})
