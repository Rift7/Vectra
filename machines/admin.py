from django.contrib import admin

from .models import MachineProfile, Tool


class ToolInline(admin.TabularInline):
    model = Tool
    extra = 0


@admin.register(MachineProfile)
class MachineProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "units", "origin", "bed_width", "bed_height", "created_at")
    search_fields = ("name",)
    inlines = [ToolInline]
