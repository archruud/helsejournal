"""
PDF text extraction utilities.
"""

import os
from typing import Optional, Dict, Any
import fitz  # PyMuPDF
from pdf2image import convert_from_path
import pytesseract


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from a PDF file using multiple methods.
    
    First tries PyMuPDF for embedded text, then falls back to OCR if needed.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        str: Extracted text
    """
    text = ""
    
    try:
        # Try PyMuPDF first (for PDFs with embedded text)
        with fitz.open(file_path) as doc:
            for page in doc:
                page_text = page.get_text()
                text += page_text + "\n"
        
        # If no text extracted, try OCR
        if not text.strip():
            text = extract_text_with_ocr(file_path)
            
    except Exception as e:
        print(f"Error extracting text with PyMuPDF: {e}")
        # Fallback to OCR
        try:
            text = extract_text_with_ocr(file_path)
        except Exception as ocr_error:
            print(f"OCR also failed: {ocr_error}")
    
    return text.strip()


def extract_text_with_ocr(file_path: str, lang: str = "nor+eng") -> str:
    """
    Extract text from PDF using OCR.
    
    Args:
        file_path: Path to the PDF file
        lang: OCR language(s), default Norwegian + English
        
    Returns:
        str: Extracted text
    """
    text = ""
    
    try:
        # Convert PDF to images
        images = convert_from_path(file_path, dpi=200)
        
        # OCR each image
        for image in images:
            page_text = pytesseract.image_to_string(image, lang=lang)
            text += page_text + "\n"
            
    except Exception as e:
        print(f"Error during OCR: {e}")
    
    return text.strip()


def get_pdf_info(file_path: str) -> Dict[str, Any]:
    """
    Get information about a PDF file.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        Dict[str, Any]: PDF information
    """
    info = {
        "page_count": 0,
        "file_size": 0,
        "metadata": {},
        "is_encrypted": False,
        "has_text": False
    }
    
    try:
        # Get file size
        info["file_size"] = os.path.getsize(file_path)
        
        # Open PDF
        with fitz.open(file_path) as doc:
            info["page_count"] = len(doc)
            info["is_encrypted"] = doc.is_encrypted
            
            # Get metadata
            metadata = doc.metadata
            if metadata:
                info["metadata"] = {
                    "title": metadata.get("title", ""),
                    "author": metadata.get("author", ""),
                    "subject": metadata.get("subject", ""),
                    "creator": metadata.get("creator", ""),
                    "producer": metadata.get("producer", ""),
                    "creation_date": metadata.get("creationDate", ""),
                    "modification_date": metadata.get("modDate", ""),
                }
            
            # Check if PDF has embedded text
            for page in doc:
                if page.get_text().strip():
                    info["has_text"] = True
                    break
                    
    except Exception as e:
        print(f"Error getting PDF info: {e}")
    
    return info


def extract_metadata(file_path: str) -> Dict[str, Optional[str]]:
    """
    Extract metadata from a PDF file.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        Dict[str, Optional[str]]: PDF metadata
    """
    metadata = {
        "title": None,
        "author": None,
        "subject": None,
        "keywords": None,
        "creator": None,
        "producer": None,
        "creation_date": None,
        "modification_date": None,
    }
    
    try:
        with fitz.open(file_path) as doc:
            pdf_metadata = doc.metadata
            if pdf_metadata:
                metadata["title"] = pdf_metadata.get("title") or None
                metadata["author"] = pdf_metadata.get("author") or None
                metadata["subject"] = pdf_metadata.get("subject") or None
                metadata["keywords"] = pdf_metadata.get("keywords") or None
                metadata["creator"] = pdf_metadata.get("creator") or None
                metadata["producer"] = pdf_metadata.get("producer") or None
                metadata["creation_date"] = pdf_metadata.get("creationDate") or None
                metadata["modification_date"] = pdf_metadata.get("modDate") or None
                
    except Exception as e:
        print(f"Error extracting metadata: {e}")
    
    return metadata


def extract_text_from_page(file_path: str, page_number: int) -> str:
    """
    Extract text from a specific page of a PDF.
    
    Args:
        file_path: Path to the PDF file
        page_number: Page number (0-indexed)
        
    Returns:
        str: Extracted text from the page
    """
    text = ""
    
    try:
        with fitz.open(file_path) as doc:
            if 0 <= page_number < len(doc):
                page = doc[page_number]
                text = page.get_text()
                
                # If no text, try OCR on this page
                if not text.strip():
                    images = convert_from_path(file_path, first_page=page_number+1, last_page=page_number+1)
                    if images:
                        text = pytesseract.image_to_string(images[0], lang="nor+eng")
                        
    except Exception as e:
        print(f"Error extracting text from page {page_number}: {e}")
    
    return text.strip()


def search_in_pdf(file_path: str, query: str) -> list:
    """
    Search for text in a PDF file.
    
    Args:
        file_path: Path to the PDF file
        query: Search query
        
    Returns:
        list: List of search results with page numbers
    """
    results = []
    
    try:
        with fitz.open(file_path) as doc:
            for page_num, page in enumerate(doc):
                text = page.get_text()
                if query.lower() in text.lower():
                    # Find context around the match
                    idx = text.lower().find(query.lower())
                    start = max(0, idx - 50)
                    end = min(len(text), idx + len(query) + 50)
                    context = text[start:end]
                    
                    results.append({
                        "page": page_num + 1,
                        "context": f"...{context}..."
                    })
                    
    except Exception as e:
        print(f"Error searching in PDF: {e}")
    
    return results
