"""
Application configuration settings.
"""

import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings."""
    
    # App settings
    APP_NAME: str = Field(default="HelseJournal")
    APP_VERSION: str = Field(default="1.0.0")
    DEBUG: bool = Field(default=False)
    
    # Database
    DATABASE_URL: str = Field(default="postgresql://helsejournal:changeme@localhost:5432/helsejournal")
    
    # Elasticsearch
    ELASTICSEARCH_URL: str = Field(default="http://localhost:9200")
    
    # JWT Settings
    JWT_SECRET_KEY: str = Field(default="your-secret-key-change-this-in-production")
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)  # 24 hours
    
    # File upload settings
    UPLOAD_DIR: str = Field(default="/app/uploads")
    MAX_FILE_SIZE: int = Field(default=50 * 1024 * 1024)  # 50MB
    ALLOWED_EXTENSIONS: List[str] = Field(default=["pdf"])
    
    # CORS
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:3000", "http://localhost:80"])
    
    # Backup settings
    BACKUP_ENABLED: bool = Field(default=True)
    BACKUP_SCHEDULE: str = Field(default="0 2 * * *")  # Daily at 2 AM
    BACKUP_DESTINATION: str = Field(default="/backup")
    
    # User settings (single user system)
    DEFAULT_USERNAME: str = Field(default="admin")
    DEFAULT_PASSWORD: str = Field(default="admin")  # Change in production!
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
