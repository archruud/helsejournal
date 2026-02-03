"""
PDF Processor module for HelseJournal.

Provides PDF text extraction and metadata extraction functionality.
"""

from app.pdf_processor.extractor import (
    extract_text_from_pdf,
    get_pdf_info,
    extract_metadata,
)

__all__ = [
    "extract_text_from_pdf",
    "get_pdf_info",
    "extract_metadata",
]
