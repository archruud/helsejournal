# Changelog

All notable changes to HelseJournal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-01

### Added
- Initial release of HelseJournal
- Dark/Light mode toggle with sun/moon button
- Multi-language support (English and Norwegian) with flag buttons
- Tree structure navigation: Year → Hospital/Doctor → Documents
- PDF viewer with zoom, rotation, and page navigation
- Full-text search in all documents using Elasticsearch
- PDF upload with drag-and-drop support
- JWT-based user authentication (single user system)
- Notes feature for adding annotations to documents
- Notification system for new documents
- Secure document sharing with expiring links
- Backup support for NAS/Cloud
- Responsive design for mobile devices
- Docker Compose setup for easy deployment
- PostgreSQL database for data storage
- Elasticsearch for full-text search
- OCR support for scanned PDFs

### Security
- JWT token-based authentication
- Password hashing with bcrypt
- Secure document sharing with token-based links
- CORS protection
- Rate limiting on authentication endpoints

### Technical
- FastAPI backend with Python 3.11
- React 18 frontend with TypeScript
- Vite build system
- Tailwind CSS for styling
- Docker containerization
- Nginx reverse proxy

[1.0.0]: https://github.com/dinbruker/helsejournal/releases/tag/v1.0.0
