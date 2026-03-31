"""Document service - PDF/DOCX storage and text extraction."""
import os
import uuid
import traceback

import fitz  # PyMuPDF
from docx import Document


class DocumentService:
    """Handles file persistence and raw text extraction (no chunking for POC)."""

    @staticmethod
    def save_document(file_bytes: bytes, original_filename: str, upload_dir: str) -> str:
        """Save raw document bytes to *upload_dir* and return the full file path.

        A UUID prefix is added to avoid filename collisions.
        """
        os.makedirs(upload_dir, exist_ok=True)
        safe_name: str = f"{uuid.uuid4().hex[:8]}_{original_filename}"
        file_path: str = os.path.join(upload_dir, safe_name)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        return file_path

    @staticmethod
    def delete_document(file_path: str | None) -> None:
        """Best-effort cleanup for a previously saved document."""
        if not file_path:
            return
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            pass

    @staticmethod
    def extract_text(file_path: str) -> str:
        """Extract all text from a PDF or DOCX.

        Returns the concatenated text of every page or paragraph.

        Raises:
            FileNotFoundError: If *file_path* does not exist.
            RuntimeError: If text extraction fails for any other reason.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Document not found: {file_path}")

        try:
            ext = os.path.splitext(file_path)[1].lower()
            if ext == ".pdf":
                return DocumentService._extract_pdf(file_path)
            if ext == ".docx":
                return DocumentService._extract_docx(file_path)
            raise RuntimeError(f"Unsupported document type: {ext}")
        except Exception as exc:
            traceback.print_exc()
            raise RuntimeError(f"Failed to extract text from {file_path}") from exc

    @staticmethod
    def _extract_pdf(file_path: str) -> str:
        doc: fitz.Document = fitz.open(file_path)
        pages: list[str] = [page.get_text() for page in doc]
        doc.close()
        return "\n".join(pages)

    @staticmethod
    def _extract_docx(file_path: str) -> str:
        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text]
        return "\n".join(paragraphs)
