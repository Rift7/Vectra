from django.contrib import admin

from .models import Asset, Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "owner", "created_at", "updated_at")
    search_fields = ("name", "owner__username")
    list_filter = ("created_at",)


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "media_type", "original_name", "size_bytes", "created_at")
    list_filter = ("media_type", "created_at")
    search_fields = ("original_name", "file")
