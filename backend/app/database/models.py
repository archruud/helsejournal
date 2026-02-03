"""
Database models for HelseJournal.
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base


class User(Base):
    """User model for authentication."""
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    full_name = Column(String(100), nullable=True)
    language = Column(String(10), default="en")  # 'en' or 'no'
    theme = Column(String(10), default="light")  # 'light' or 'dark'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="owner", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    """Document model for storing PDF metadata."""
    
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)  # in bytes
    file_hash = Column(String(64), nullable=False)  # SHA-256 hash
    content_type = Column(String(100), default="application/pdf")
    
    # Document metadata
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    year = Column(Integer, nullable=True, index=True)
    hospital = Column(String(255), nullable=True, index=True)
    doctor = Column(String(255), nullable=True, index=True)
    document_date = Column(DateTime(timezone=True), nullable=True)
    document_type = Column(String(100), nullable=True)  # 'lab', 'prescription', 'report', etc.
    
    # Extracted text for search
    extracted_text = Column(Text, nullable=True)
    
    # Status
    is_processed = Column(Boolean, default=False)
    is_favorite = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", back_populates="documents")
    notes = relationship("Note", back_populates="document", cascade="all, delete-orphan")
    share_links = relationship("ShareLink", back_populates="document", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_document_year_hospital', 'year', 'hospital'),
        Index('idx_document_search', 'title', 'description'),
    )


class Note(Base):
    """Note model for document annotations."""
    
    __tablename__ = "notes"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)  # Optional: specific page reference
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="notes")
    owner = relationship("User", back_populates="notes")


class ShareLink(Base):
    """Share link model for secure document sharing."""
    
    __tablename__ = "share_links"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    token = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    max_views = Column(Integer, nullable=True)  # None = unlimited
    view_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="share_links")


class Notification(Base):
    """Notification model for user alerts."""
    
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="info")  # 'info', 'warning', 'success', 'error'
    is_read = Column(Boolean, default=False)
    related_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="notifications")
