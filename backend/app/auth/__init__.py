"""
Authentication module for HelseJournal.

Provides JWT-based authentication and user management.
"""

from app.auth.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_token,
    get_current_user,
    authenticate_user,
)
from app.auth.router import router

__all__ = [
    "verify_password",
    "get_password_hash",
    "create_access_token",
    "decode_token",
    "get_current_user",
    "authenticate_user",
    "router",
]
