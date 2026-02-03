"""
Documents router for HelseJournal.
"""

import os
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import io

from app.config import settings
from app.database.connection import get_db
from app.database.models import User, Document, Note, ShareLink, Notification
from app.auth.security import get_current_user
from app.pdf_processor.extractor import extract_text_from_pdf, get_pdf_info

router = APIRouter()


# Pydantic models
class DocumentResponse(BaseModel):
    """Document response model."""
    id: int
    filename: str
    original_filename: str
    file_size: int
    title: Optional[str]
    description: Optional[str]
    year: Optional[int]
    hospital: Optional[str]
    doctor: Optional[str]
    document_date: Optional[datetime]
    document_type: Optional[str]
    is_favorite: bool
    is_archived: bool
    is_processed: bool
    created_at: datetime
    updated_at: Optional[datetime]
    note_count: int
    
    class Config:
        from_attributes = True


class DocumentCreate(BaseModel):
    """Document create/update model."""
    title: Optional[str] = None
    description: Optional[str] = None
    year: Optional[int] = None
    hospital: Optional[str] = None
    doctor: Optional[str] = None
    document_date: Optional[datetime] = None
    document_type: Optional[str] = None


class NoteResponse(BaseModel):
    """Note response model."""
    id: int
    content: str
    page_number: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class NoteCreate(BaseModel):
    """Note create model."""
    content: str
    page_number: Optional[int] = None


class ShareLinkResponse(BaseModel):
    """Share link response model."""
    id: int
    token: str
    expires_at: Optional[datetime]
    max_views: Optional[int]
    view_count: int
    is_active: bool
    created_at: datetime
    share_url: str
    
    class Config:
        from_attributes = True


class ShareLinkCreate(BaseModel):
    """Share link create model."""
    expires_in_days: Optional[int] = 7  # None = no expiration
    max_views: Optional[int] = None  # None = unlimited


class TreeItem(BaseModel):
    """Tree structure item."""
    id: str
    name: str
    type: str  # 'year', 'hospital', 'doctor', 'document'
    children: Optional[List['TreeItem']] = None
    document_id: Optional[int] = None


TreeItem.model_rebuild()


class SearchResult(BaseModel):
    """Search result model."""
    id: int
    title: str
    original_filename: str
    year: Optional[int]
    hospital: Optional[str]
    doctor: Optional[str]
    highlight: Optional[str] = None
    score: float


def calculate_file_hash(file_content: bytes) -> str:
    """Calculate SHA-256 hash of file content."""
    return hashlib.sha256(file_content).hexdigest()


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename."""
    ext = os.path.splitext(original_filename)[1]
    return f"{uuid.uuid4().hex}{ext}"


@router.get("/tree", response_model=List[TreeItem])
async def get_document_tree(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get documents organized in a tree structure: Year -> Hospital/Doctor -> Documents.
    
    Args:
        current_user: The authenticated user
        db: Database session
        
    Returns:
        List[TreeItem]: Tree structure of documents
    """
    documents = db.query(Document).filter(
        Document.owner_id == current_user.id,
        Document.is_archived == False
    ).order_by(desc(Document.year), Document.hospital, Document.doctor).all()
    
    # Build tree structure
    tree = {}
    
    for doc in documents:
        year = doc.year or 0
        hospital = doc.hospital or "Unknown Hospital"
        
        if year not in tree:
            tree[year] = {}
        
        if hospital not in tree[year]:
            tree[year][hospital] = []
        
        tree[year][hospital].append(doc)
    
    # Convert to TreeItem structure
    result = []
    for year in sorted(tree.keys(), reverse=True):
        year_node = TreeItem(
            id=f"year_{year}",
            name=str(year) if year > 0 else "Unknown Year",
            type="year",
            children=[]
        )
        
        for hospital in sorted(tree[year].keys()):
            hospital_node = TreeItem(
                id=f"hospital_{year}_{hospital}",
                name=hospital,
                type="hospital",
                children=[]
            )
            
            for doc in tree[year][hospital]:
                doc_node = TreeItem(
                    id=f"doc_{doc.id}",
                    name=doc.title or doc.original_filename,
                    type="document",
                    document_id=doc.id
                )
                hospital_node.children.append(doc_node)
            
            year_node.children.append(hospital_node)
        
        result.append(year_node)
    
    return result


@router.get("/search")
async def search_documents(
    q: str = Query(..., min_length=1, description="Search query"),
    year: Optional[int] = Query(None, description="Filter by year"),
    hospital: Optional[str] = Query(None, description="Filter by hospital"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search documents with full-text search.
    
    Args:
        q: Search query
        year: Optional year filter
        hospital: Optional hospital filter
        current_user: The authenticated user
        db: Database session
        
    Returns:
        List[SearchResult]: Search results
    """
    query = db.query(Document).filter(
        Document.owner_id == current_user.id,
        Document.is_archived == False
    )
    
    # Apply filters
    if year:
        query = query.filter(Document.year == year)
    if hospital:
        query = query.filter(Document.hospital.ilike(f"%{hospital}%"))
    
    # Full-text search on title, description, and extracted text
    search_filter = (
        Document.title.ilike(f"%{q}%") |
        Document.description.ilike(f"%{q}%") |
        Document.extracted_text.ilike(f"%{q}%") |
        Document.hospital.ilike(f"%{q}%") |
        Document.doctor.ilike(f"%{q}%")
    )
    query = query.filter(search_filter)
    
    documents = query.all()
    
    results = []
    for doc in documents:
        # Create highlight snippet
        highlight = None
        if doc.extracted_text and q.lower() in doc.extracted_text.lower():
            idx = doc.extracted_text.lower().find(q.lower())
            start = max(0, idx - 50)
            end = min(len(doc.extracted_text), idx + len(q) + 50)
            highlight = f"...{doc.extracted_text[start:end]}..."
        
        results.append(SearchResult(
            id=doc.id,
            title=doc.title or doc.original_filename,
            original_filename=doc.original_filename,
            year=doc.year,
            hospital=doc.hospital,
            doctor=doc.doctor,
            highlight=highlight,
            score=1.0  # Simple scoring, could be improved with Elasticsearch
        ))
    
    return results


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    year: Optional[int] = Query(None),
    hospital: Optional[str] = Query(None),
    is_favorite: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List documents with optional filters.
    
    Args:
        skip: Number of documents to skip
        limit: Maximum number of documents to return
        year: Filter by year
        hospital: Filter by hospital
        is_favorite: Filter by favorite status
        current_user: The authenticated user
        db: Database session
        
    Returns:
        List[DocumentResponse]: List of documents
    """
    query = db.query(Document).filter(
        Document.owner_id == current_user.id,
        Document.is_archived == False
    )
    
    if year:
        query = query.filter(Document.year == year)
    if hospital:
        query = query.filter(Document.hospital.ilike(f"%{hospital}%"))
    if is_favorite is not None:
        query = query.filter(Document.is_favorite == is_favorite)
    
    documents = query.order_by(desc(Document.created_at)).offset(skip).limit(limit).all()
    
    # Add note count
    result = []
    for doc in documents:
        doc.note_count = len(doc.notes)
        result.append(doc)
    
    return result


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a single document by ID.
    
    Args:
        document_id: Document ID
        current_user: The authenticated user
        db: Database session
        
    Returns:
        DocumentResponse: Document details
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    document.note_count = len(document.notes)
    return document


@router.get("/{document_id}/view")
async def view_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    View/download a document file.
    
    Args:
        document_id: Document ID
        current_user: The authenticated user
        db: Database session
        
    Returns:
        FileResponse: PDF file
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    file_path = os.path.join(settings.UPLOAD_DIR, document.file_path)
    
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    return FileResponse(
        file_path,
        filename=document.original_filename,
        media_type="application/pdf"
    )


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    year: Optional[int] = Form(None),
    hospital: Optional[str] = Form(None),
    doctor: Optional[str] = Form(None),
    document_date: Optional[str] = Form(None),
    document_type: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a new PDF document.
    
    Args:
        file: PDF file to upload
        title: Document title
        description: Document description
        year: Year of document
        hospital: Hospital name
        doctor: Doctor name
        document_date: Document date (ISO format)
        document_type: Type of document
        current_user: The authenticated user
        db: Database session
        
    Returns:
        DocumentResponse: Created document
    """
    # Validate file type
    if not file.content_type or file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )
    
    # Read file content
    content = await file.read()
    
    # Check file size
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE / 1024 / 1024}MB"
        )
    
    # Calculate file hash
    file_hash = calculate_file_hash(content)
    
    # Check for duplicate
    existing = db.query(Document).filter(
        Document.owner_id == current_user.id,
        Document.file_hash == file_hash
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This document already exists"
        )
    
    # Generate unique filename
    unique_filename = generate_unique_filename(file.filename)
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Extract text from PDF
    extracted_text = ""
    try:
        extracted_text = extract_text_from_pdf(file_path)
    except Exception as e:
        # Log error but don't fail upload
        print(f"Failed to extract text: {e}")
    
    # Parse document date
    parsed_date = None
    if document_date:
        try:
            parsed_date = datetime.fromisoformat(document_date.replace('Z', '+00:00'))
        except:
            pass
    
    # Create document record
    document = Document(
        owner_id=current_user.id,
        filename=unique_filename,
        original_filename=file.filename,
        file_path=unique_filename,
        file_size=len(content),
        file_hash=file_hash,
        title=title or file.filename,
        description=description,
        year=year,
        hospital=hospital,
        doctor=doctor,
        document_date=parsed_date,
        document_type=document_type,
        extracted_text=extracted_text,
        is_processed=len(extracted_text) > 0
    )
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    # Create notification
    notification = Notification(
        user_id=current_user.id,
        title="New document uploaded",
        message=f"'{document.title}' has been uploaded successfully",
        notification_type="success",
        related_document_id=document.id
    )
    db.add(notification)
    db.commit()
    
    document.note_count = 0
    return document


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    document_update: DocumentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update document metadata.
    
    Args:
        document_id: Document ID
        document_update: Update data
        current_user: The authenticated user
        db: Database session
        
    Returns:
        DocumentResponse: Updated document
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Update fields
    for field, value in document_update.dict(exclude_unset=True).items():
        setattr(document, field, value)
    
    db.commit()
    db.refresh(document)
    
    document.note_count = len(document.notes)
    return document


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a document.
    
    Args:
        document_id: Document ID
        current_user: The authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Delete file
    file_path = os.path.join(settings.UPLOAD_DIR, document.file_path)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Delete from database
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted successfully"}


@router.post("/{document_id}/favorite")
async def toggle_favorite(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggle favorite status for a document.
    
    Args:
        document_id: Document ID
        current_user: The authenticated user
        db: Database session
        
    Returns:
        dict: New favorite status
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    document.is_favorite = not document.is_favorite
    db.commit()
    
    return {"is_favorite": document.is_favorite}


# Notes endpoints
@router.get("/{document_id}/notes", response_model=List[NoteResponse])
async def get_notes(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get notes for a document.
    
    Args:
        document_id: Document ID
        current_user: The authenticated user
        db: Database session
        
    Returns:
        List[NoteResponse]: List of notes
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    notes = db.query(Note).filter(
        Note.document_id == document_id,
        Note.owner_id == current_user.id
    ).order_by(desc(Note.created_at)).all()
    
    return notes


@router.post("/{document_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    document_id: int,
    note_data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a note for a document.
    
    Args:
        document_id: Document ID
        note_data: Note data
        current_user: The authenticated user
        db: Database session
        
    Returns:
        NoteResponse: Created note
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    note = Note(
        document_id=document_id,
        owner_id=current_user.id,
        content=note_data.content,
        page_number=note_data.page_number
    )
    
    db.add(note)
    db.commit()
    db.refresh(note)
    
    return note


@router.delete("/{document_id}/notes/{note_id}")
async def delete_note(
    document_id: int,
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a note.
    
    Args:
        document_id: Document ID
        note_id: Note ID
        current_user: The authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.document_id == document_id,
        Note.owner_id == current_user.id
    ).first()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    db.delete(note)
    db.commit()
    
    return {"message": "Note deleted successfully"}


# Share link endpoints
@router.post("/{document_id}/share", response_model=ShareLinkResponse)
async def create_share_link(
    document_id: int,
    share_data: ShareLinkCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a share link for a document.
    
    Args:
        document_id: Document ID
        share_data: Share link configuration
        current_user: The authenticated user
        db: Database session
        
    Returns:
        ShareLinkResponse: Created share link
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Generate unique token
    token = uuid.uuid4().hex
    
    # Calculate expiration
    expires_at = None
    if share_data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=share_data.expires_in_days)
    
    share_link = ShareLink(
        document_id=document_id,
        token=token,
        expires_at=expires_at,
        max_views=share_data.max_views
    )
    
    db.add(share_link)
    db.commit()
    db.refresh(share_link)
    
    # Add share URL
    share_link.share_url = f"/api/documents/share/{token}"
    
    return share_link


@router.get("/share/{token}")
async def access_shared_document(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Access a document via share link.
    
    Args:
        token: Share token
        db: Database session
        
    Returns:
        FileResponse: Shared PDF file
    """
    share_link = db.query(ShareLink).filter(
        ShareLink.token == token,
        ShareLink.is_active == True
    ).first()
    
    if not share_link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link not found or expired"
        )
    
    # Check expiration
    if share_link.expires_at and share_link.expires_at < datetime.utcnow():
        share_link.is_active = False
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Share link has expired"
        )
    
    # Check max views
    if share_link.max_views and share_link.view_count >= share_link.max_views:
        share_link.is_active = False
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Share link has reached maximum views"
        )
    
    # Increment view count
    share_link.view_count += 1
    db.commit()
    
    # Return document
    document = share_link.document
    file_path = os.path.join(settings.UPLOAD_DIR, document.file_path)
    
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    return FileResponse(
        file_path,
        filename=document.original_filename,
        media_type="application/pdf"
    )


@router.delete("/{document_id}/share/{share_id}")
async def revoke_share_link(
    document_id: int,
    share_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Revoke a share link.
    
    Args:
        document_id: Document ID
        share_id: Share link ID
        current_user: The authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    share_link = db.query(ShareLink).filter(
        ShareLink.id == share_id,
        ShareLink.document_id == document_id
    ).first()
    
    if not share_link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link not found"
        )
    
    # Verify ownership
    if share_link.document.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to revoke this share link"
        )
    
    share_link.is_active = False
    db.commit()
    
    return {"message": "Share link revoked successfully"}
