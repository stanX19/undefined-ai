"""Document service – PDF storage and text extraction."""
import os
import uuid
import traceback

import fitz  # PyMuPDF


class DocumentService:
    """Handles file persistence and raw text extraction (no chunking for POC)."""

    @staticmethod
    def save_pdf(file_bytes: bytes, original_filename: str, upload_dir: str) -> str:
        """Save raw PDF bytes to *upload_dir* and return the full file path.

        A UUID prefix is added to avoid filename collisions.
        """
        os.makedirs(upload_dir, exist_ok=True)
        safe_name: str = f"{uuid.uuid4().hex[:8]}_{original_filename}"
        file_path: str = os.path.join(upload_dir, safe_name)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        return file_path

    @staticmethod
    def extract_text(file_path: str) -> str:
        """Extract all text from a PDF using PyMuPDF.

        Returns the concatenated text of every page.

        Raises:
            FileNotFoundError: If *file_path* does not exist.
            RuntimeError: If text extraction fails for any other reason.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF not found: {file_path}")

        try:
            doc: fitz.Document = fitz.open(file_path)
            pages: list[str] = [page.get_text() for page in doc]
            doc.close()
            return "\n".join(pages)
        except Exception as exc:
            traceback.print_exc()
            raise RuntimeError(f"Failed to extract text from {file_path}") from exc
