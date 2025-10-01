from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class Project(TimeStampedModel):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_projects")
    collaborators = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="collaborations")

    def __str__(self) -> str:
        return self.name


class Asset(TimeStampedModel):
    class MediaType(models.TextChoices):
        SVG = "svg", "SVG"
        PDF = "pdf", "PDF"
        PNG = "png", "PNG"
        JPG = "jpg", "JPG"
        OTHER = "other", "Other"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="assets")
    file = models.FileField(upload_to="assets/%Y/%m/%d")
    media_type = models.CharField(max_length=10, choices=MediaType.choices)
    original_name = models.CharField(max_length=255, blank=True)
    size_bytes = models.BigIntegerField(default=0)

    def __str__(self) -> str:
        return f"{self.project.name}: {self.original_name or self.file.name}"
