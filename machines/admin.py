from django.contrib import admin

from .models import MachineProfile


@admin.register(MachineProfile)
class MachineProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "units", "origin", "bed_width", "bed_height", "created_at")
    search_fields = ("name",)
