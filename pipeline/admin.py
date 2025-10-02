from django.contrib import admin

from .models import Pipeline, PipelineRun, PipelineStepModel, RunArtifact


class PipelineStepInline(admin.TabularInline):
    model = PipelineStepModel
    extra = 0


@admin.register(Pipeline)
class PipelineAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "name", "created_at", "updated_at")
    search_fields = ("name", "project__name")
    inlines = [PipelineStepInline]


@admin.register(PipelineRun)
class PipelineRunAdmin(admin.ModelAdmin):
    list_display = ("id", "pipeline", "asset", "status", "duration_ms", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("pipeline__name",)


@admin.register(RunArtifact)
class RunArtifactAdmin(admin.ModelAdmin):
    list_display = ("id", "run", "kind", "file", "created_at")
    list_filter = ("kind",)
