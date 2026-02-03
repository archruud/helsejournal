# 🏥 HelseJournal

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://docker.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql)](https://postgresql.org)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-005571?logo=elasticsearch)](https://elastic.co)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **En sikker, personlig helsejournal for organisering av medisinske dokumenter**

HelseJournal er en selvhostet webapplikasjon for å organisere, søke i og administrere personlige medisinske dokumenter med fulltekstsøk, PDF-visning, notater og sikker deling.

![Dark Mode](https://img.shields.io/badge/Dark%20Mode-Supported-purple)
![Light Mode](https://img.shields.io/badge/Light%20Mode-Supported-yellow)
![Languages](https://img.shields.io/badge/Languages-EN%20%7C%20NO-blue)

---

## 🖥️ Systemkrav

### Hardware (Testet på)
| Komponent | Spesifikasjon |
|-----------|---------------|
| **Plattform** | LXC Container på Proxmox |
| **GPU** | 2x NVIDIA A2 + 1x NVIDIA T4 |
| **RAM** | 512 GB |
| **Lagring** | 20 TB |
| **IP-adresse** | 192.168.30.10 |

### Minimumskrav
- **CPU**: 2 kjerner
- **RAM**: 4 GB (8 GB anbefalt)
- **Lagring**: 10 GB + dokumentlagring
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

---

## 🚀 Hurtiginstallasjon

### One-liner installasjon
```bash
curl -fsSL https://raw.githubusercontent.com/dinbruker/helsejournal/main/auto-install.sh | bash
```

### Manuell installasjon
```bash
# 1. Klon repository
git clone https://github.com/dinbruker/helsejournal.git
cd helsejournal

# 2. Kjør installasjonsscript
chmod +x install.sh
./install.sh

# 3. Start tjenester
docker-compose up -d
```

---

## ✨ Funksjoner

| Funksjon | Beskrivelse | Status |
|----------|-------------|--------|
| 🌓 **Tema** | Dark/Light mode med sol/måne-knapp | ✅ |
| 🌍 **Språk** | Engelsk og Norsk med flagg-knapper | ✅ |
| 🌳 **Tre-struktur** | År → Sykehus/Lege → Dokumenter | ✅ |
| 📄 **PDF-visning** | Innebygd PDF-leser på høyre side | ✅ |
| 🔍 **Fulltekstsøk** | Søk i alle dokumenter med Elasticsearch | ✅ |
| ⬆️ **Opplasting** | Last opp nye PDF-er direkte | ✅ |
| 🔐 **Autentisering** | Sikker innlogging (én bruker) | ✅ |
| 📝 **Notater** | Legg til notater til dokumenter | ✅ |
| 🔔 **Varsler** | Få varsler om nye dokumenter | ✅ |
| 🔗 **Deling** | Lag sikre delingslenker | ✅ |
| 💾 **Backup** | Automatisk backup til NAS/Cloud | ✅ |
| 📱 **Responsiv** | Mobilvennlig design | ✅ |

---

## 🏗️ Arkitektur

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Compose                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Nginx     │  │   React     │  │     FastAPI         │ │
│  │   (Proxy)   │──│  Frontend   │──│     Backend         │ │
│  │   :80/:443  │  │   :3000     │  │     :8000           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                              │              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────▼──────────┐  │
│  │ PostgreSQL  │  │Elasticsearch│  │   PDF Storage      │  │
│  │   :5432     │  │   :9200     │  │   (Volume)         │  │
│  └─────────────┘  └─────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Konfigurasjon

### Miljøvariabler
Opprett en `.env` fil i rotmappen:

```env
# Database
POSTGRES_USER=helsejournal
POSTGRES_PASSWORD=din_sikre_passord
POSTGRES_DB=helsejournal

# JWT Secret
JWT_SECRET_KEY=din_hemmelige_nøkkel_minst_32_tegn
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200

# App Settings
APP_NAME=HelseJournal
APP_VERSION=1.0.0
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=50MB

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_DESTINATION=/backup
```

### GPU-akselerasjon (valgfritt)
For OCR med GPU-akselerasjon, aktiver i `docker-compose.yml`:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

---

## 📁 Mappestruktur

```
helsejournal/
├── docker-compose.yml          # Hoved Docker Compose
├── README.md                   # Denne filen
├── install.sh                  # Installasjonsscript
├── auto-install.sh             # One-liner installer
├── .env.example                # Eksempel på miljøvariabler
├── backend/                    # FastAPI backend
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database/
│       ├── auth/
│       ├── documents/
│       └── pdf_processor/
└── frontend/                   # React frontend
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.js
    └── src/
        ├── main.tsx
        ├── App.tsx
        └── components/
```

---

## 🛠️ Utvikling

### Start utviklingsmiljø
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Kjør tester
```bash
# Backend tester
cd backend
pytest

# Frontend tester
cd frontend
npm test
```

---

## 🔒 Sikkerhet

- ✅ JWT-basert autentisering
- ✅ Passord hashing med bcrypt
- ✅ HTTPS-støtte
- ✅ Sikre delingslenker med utløpstid
- ✅ Input-validering
- ✅ SQL-injeksjon beskyttelse
- ✅ XSS-beskyttelse

---

## 💾 Backup

### Automatisk backup
Backup kjøres automatisk daglig kl. 02:00:
```bash
# Manuell backup
docker-compose exec backend python -m app.backup
```

### Gjenoppretting
```bash
# Gjenopprett fra backup
docker-compose exec backend python -m app.restore /backup/helsejournal_YYYYMMDD.tar.gz
```

---

## 🐛 Feilsøking

### Sjekk logger
```bash
# Alle tjenester
docker-compose logs -f

# Spesifikk tjeneste
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f elasticsearch
```

### Vanlige problemer

**Problem**: Elasticsearch starter ikke  
**Løsning**: Øk vm.max_map_count:
```bash
sudo sysctl -w vm.max_map_count=262144
```

**Problem**: Port 80 er opptatt  
**Løsning**: Endre port i `docker-compose.yml`:
```yaml
ports:
  - "8080:80"
```

---

## 📄 Lisens

Dette prosjektet er lisensiert under MIT License - se [LICENSE](LICENSE) for detaljer.

---

## 🙏 Takk til

- [FastAPI](https://fastapi.tiangolo.com/) - Moderne Python web-rammeverk
- [React](https://reactjs.org/) - JavaScript-bibliotek for brukergrensesnitt
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS-rammeverk
- [Elasticsearch](https://www.elastic.co/) - Distribuert søk og analyse
- [PostgreSQL](https://www.postgresql.org/) - Åpen kildekode relasjonsdatabase

---

## 📞 Support

For spørsmål eller problemer, opprett en [GitHub Issue](https://github.com/dinbruker/helsejournal/issues).

---

<p align="center">
  Laget med ❤️ i Norge
</p>
