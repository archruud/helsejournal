#!/bin/bash

# HelseJournal - One-Line Auto-Installer
# This script downloads and installs HelseJournal automatically

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/dinbruker/helsejournal.git"
INSTALL_DIR="/opt/helsejournal"
BACKUP_DIR="/backup/helsejournal"

# Print functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    print_info "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Installing Docker..."
        install_docker
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Installing Docker Compose..."
        install_docker_compose
    fi
    
    # Check available resources
    MEM_GB=$(free -g | awk '/^Mem:/{print $2}')
    DISK_GB=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    
    print_info "System resources:"
    print_info "  Memory: ${MEM_GB}GB"
    print_info "  Disk space available: ${DISK_GB}GB"
    
    if [[ $MEM_GB -lt 4 ]]; then
        print_warning "Less than 4GB RAM detected. Performance may be affected."
    fi
    
    print_success "System requirements check passed"
}

# Install Docker
install_docker() {
    print_info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    usermod -aG docker $SUDO_USER 2>/dev/null || true
    print_success "Docker installed successfully"
}

# Install Docker Compose
install_docker_compose() {
    print_info "Installing Docker Compose..."
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    print_success "Docker Compose installed successfully"
}

# Create directories
create_directories() {
    print_info "Creating directories..."
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$INSTALL_DIR/uploads"
    chmod 755 "$INSTALL_DIR"
    print_success "Directories created"
}

# Download application
download_app() {
    print_info "Downloading HelseJournal..."
    
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        print_info "Existing installation found, updating..."
        cd "$INSTALL_DIR"
        git pull origin main
    else
        # Clone or extract files
        if command -v git &> /dev/null; then
            git clone "$REPO_URL" "$INSTALL_DIR" 2>/dev/null || true
        fi
        
        # If git clone failed, create structure manually
        if [[ ! -f "$INSTALL_DIR/docker-compose.yml" ]]; then
            print_info "Creating application structure..."
            create_app_structure
        fi
    fi
    
    print_success "Application downloaded"
}

# Create application structure manually
create_app_structure() {
    cd "$INSTALL_DIR"
    
    # Create directories
    mkdir -p backend/app/{database,auth,documents,pdf_processor}
    mkdir -p frontend/src/{components,pages,hooks,services}
    mkdir -p nginx
    mkdir -p backup
    
    print_info "Please manually copy the application files to $INSTALL_DIR"
    print_info "Or clone from: $REPO_URL"
}

# Generate environment file
generate_env() {
    print_info "Generating environment configuration..."
    
    # Generate random passwords
    DB_PASSWORD=$(openssl rand -base64 32 2>/dev/null || tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 32)
    JWT_SECRET=$(openssl rand -base64 64 2>/dev/null || tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 64)
    
    cat > "$INSTALL_DIR/.env" << EOF
# HelseJournal Environment Configuration
# Generated on $(date)

# Database Configuration
POSTGRES_USER=helsejournal
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=helsejournal
DATABASE_URL=postgresql://helsejournal:$DB_PASSWORD@postgres:5432/helsejournal

# JWT Configuration
JWT_SECRET_KEY=$JWT_SECRET
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200

# Application Settings
APP_NAME=HelseJournal
APP_VERSION=1.0.0
DEBUG=false
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=52428800

# Default User Credentials
DEFAULT_USERNAME=admin
DEFAULT_PASSWORD=admin

# Backup Settings
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_DESTINATION=/backup

# CORS Settings
CORS_ORIGINS=http://localhost:3000,http://localhost,http://192.168.30.10
EOF
    
    chmod 600 "$INSTALL_DIR/.env"
    print_success "Environment configuration generated"
    print_warning "Default credentials: admin / admin"
    print_warning "Please change the default password after first login!"
}

# Start services
start_services() {
    print_info "Starting HelseJournal services..."
    cd "$INSTALL_DIR"
    
    # Pull latest images
    docker-compose pull 2>/dev/null || true
    
    # Build and start services
    docker-compose up -d --build
    
    # Wait for services to be ready
    print_info "Waiting for services to start..."
    sleep 10
    
    # Check health
    print_info "Checking service health..."
    
    # Check PostgreSQL
    until docker-compose exec -T postgres pg_isready -U helsejournal 2>/dev/null; do
        print_info "Waiting for PostgreSQL..."
        sleep 2
    done
    print_success "PostgreSQL is ready"
    
    # Check Elasticsearch
    until curl -s http://localhost:9200/_cluster/health 2>/dev/null | grep -q '"status":"green\|yellow"'; do
        print_info "Waiting for Elasticsearch..."
        sleep 5
    done
    print_success "Elasticsearch is ready"
    
    # Check Backend
    until curl -s http://localhost:8000/health 2>/dev/null | grep -q '"status":"healthy"'; do
        print_info "Waiting for Backend..."
        sleep 2
    done
    print_success "Backend is ready"
    
    print_success "All services are running!"
}

# Print final information
print_final_info() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           HelseJournal Installation Complete!              ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    print_success "HelseJournal has been successfully installed!"
    echo ""
    echo "📱 Access the application:"
    echo "   • Web Interface: http://192.168.30.10"
    echo "   • API Documentation: http://192.168.30.10:8000/docs"
    echo ""
    echo "🔐 Default Login Credentials:"
    echo "   • Username: admin"
    echo "   • Password: admin"
    echo ""
    echo "⚙️  Configuration file:"
    echo "   $INSTALL_DIR/.env"
    echo ""
    echo "📂 Installation directory:"
    echo "   $INSTALL_DIR"
    echo ""
    echo "🛠️  Useful commands:"
    echo "   cd $INSTALL_DIR"
    echo "   docker-compose logs -f    # View logs"
    echo "   docker-compose ps         # Check status"
    echo "   docker-compose down       # Stop services"
    echo "   docker-compose up -d      # Start services"
    echo ""
    echo "💾 Backup directory:"
    echo "   $BACKUP_DIR"
    echo ""
    print_warning "IMPORTANT: Please change the default password after first login!"
    echo ""
}

# Main installation function
main() {
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║              HelseJournal Auto-Installer                   ║"
    echo "║         Personal Health Journal Application                ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    check_root
    check_requirements
    create_directories
    download_app
    generate_env
    start_services
    print_final_info
}

# Run main function
main "$@"
