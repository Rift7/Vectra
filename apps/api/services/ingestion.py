from pathlib import Path

from services.storage import find_source_file, save_intermediate


def _stub_svg(filename: str, label: str) -> str:
    safe = filename.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return (
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"700\" viewBox=\"0 0 1000 700\">"
        "<rect x=\"20\" y=\"20\" width=\"960\" height=\"660\" fill=\"none\" stroke=\"black\" stroke-width=\"2\"/>"
        f"<text x=\"40\" y=\"120\" font-size=\"42\" font-family=\"Arial\">{label} import stub</text>"
        f"<text x=\"40\" y=\"190\" font-size=\"28\" font-family=\"Arial\">Source file: {safe}</text>"
        "<text x=\"40\" y=\"250\" font-size=\"24\" font-family=\"Arial\">Pipeline continues with placeholder geometry for MVP.</text>"
        "<path d=\"M120 380 L880 380 L880 560 L120 560 Z\" fill=\"none\" stroke=\"black\" stroke-width=\"3\"/>"
        "</svg>"
    )


def ingest_to_svg_stub(project_id: str, file_id: str, filename: str) -> tuple[str, str]:
    ext = Path(filename).suffix.lower()
    if ext == ".svg":
        return file_id, "svg"
    if ext in [".png", ".jpg", ".jpeg"]:
        return file_id, "raster"
    if ext == ".pdf":
        svg_id = save_intermediate(project_id, "pdf_stub.svg", _stub_svg(filename, "PDF"))
        return svg_id, "pdf_stub"
    if ext == ".docx":
        svg_id = save_intermediate(project_id, "docx_stub.svg", _stub_svg(filename, "DOCX"))
        return svg_id, "docx_stub"

    source_path = find_source_file(project_id, file_id)
    fallback_name = filename if source_path is None else source_path.name
    svg_id = save_intermediate(project_id, "unsupported_stub.svg", _stub_svg(fallback_name, "Unsupported"))
    return svg_id, "unsupported_stub"
