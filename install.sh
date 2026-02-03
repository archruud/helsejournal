#!/bin/bash

# HelseJournal Installation Script
# This script guides you through the installation process

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
INSTALL_DIR="$(pwd)"
BACKUP_DIR="${INSTALL_DIR}/backup"

# Print functions
print_header() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║              HelseJournal Installer                        ║"
    echo "║         Personal Health Journal Application                ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

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

print_step() {
    echo ""
    echo -e "${CYAN}▶ $1${NC}"
    echo "────────────────────────────────────────────────────────────"
}

# Check if Docker is installed
check_docker() {
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker found: $DOCKER_VERSION"
        return 0
    else
        return 1
    fi
}

# Check if Docker Compose is installed
check_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        print_success "Docker Compose found: $COMPOSE_VERSION"
        return 0
    elif docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version)
        print_success "Docker Compose (plugin) found: $COMPOSE_VERSION"
        return 0
    else
        return 1
    fi
}

# Install Docker
install_docker() {
    print_step "Installing Docker"
    
    print_info "Downloading and installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Start Docker service
    systemctl enable docker
    systemctl start docker
    
    # Add current user to docker group
    if [[ -n "$SUDO_USER" ]]; then
        usermod -aG docker "$SUDO_USER"
        print_info "Added $SUDO_USER to docker group"
    fi
    
    print_success "Docker installed successfully"
}

# Install Docker Compose
install_docker_compose() {
    print_step "Installing Docker Compose"
    
    print_info "Downloading Docker Compose..."
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    
    curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Create symlink
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose 2>/dev/null || true
    
    print_success "Docker Compose installed successfully"
}

# Check system resources
check_resources() {
    print_step "Checking System Resources"
    
    # Check memory
    if command -v free &> /dev/null; then
        MEM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
        MEM_GB=$((MEM_TOTAL / 1024))
        print_info "Total Memory: ${MEM_GB}GB"
        
        if [[ $MEM_GB -lt 4 ]]; then
            print_warning "Less than 4GB RAM detected. Performance may be affected."
        fi
    fi
    
    # Check disk space
    DISK_AVAIL=$(df -m . | awk 'NR==2{print $4}')
    DISK_GB=$((DISK_AVAIL / 1024))
    print_info "Available Disk Space: ${DISK_GB}GB"
    
    if [[ $DISK_GB -lt 10 ]]; then
        print_warning "Less than 10GB disk space available."
    fi
    
    print_success "Resource check complete"
}

# Create environment file
create_env_file() {
    print_step "Creating Environment Configuration"
    
    # Generate secure passwords
    if command -v openssl &> /dev/null; then
        DB_PASSWORD=$(openssl rand -base64 32)
        JWT_SECRET=$(openssl rand -base64 64)
    else
        DB_PASSWORD=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 32)
        JWT_SECRET=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 64)
    fi
    
    # Get IP address
    IP_ADDRESS=$(hostname -I | awk '{print $1}')
    
    cat > .env << EOF
# HelseJournal Environment Configuration
# Generated: $(date)

# Database Configuration
POSTGRES_USER=helsejournal
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=helsejournal

# JWT Secret (keep this secure!)
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

# Default User Credentials (CHANGE THESE!)
DEFAULT_USERNAME=admin
DEFAULT_PASSWORD=admin

# Backup Settings
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_DESTINATION=/backup

# CORS Origins
CORS_ORIGINS=http://localhost:3000,http://localhost,http://$IP_ADDRESS
EOF
    
    chmod 600 .env
    
    print_success "Environment file created: .env"
    print_warning "Default credentials: admin / admin"
    print_warning "Please change the default password after first login!"
}

# Create necessary directories
create_directories() {
    print_step "Creating Directories"
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p uploads
    mkdir -p nginx/ssl
    
    print_success "Directories created"
}

# Build and start services
start_services() {
    print_step "Building and Starting Services"
    
    print_info "Pulling Docker images..."
    docker-compose pull 2>/dev/null || true
    
    print_info "Building services..."
    docker-compose build --no-cache
    
    print_info "Starting services..."
    docker-compose up -d
    
    print_info "Waiting for services to initialize..."
    sleep 15
}

# Check service health
check_health() {
    print_step "Checking Service Health"
    
    local retries=30
    local count=0
    
    # Check PostgreSQL
    print_info "Checking PostgreSQL..."
    while [[ $count -lt $retries ]]; do
        if docker-compose exec -T postgres pg_isready -U helsejournal &> /dev/null; then
            print_success "PostgreSQL is ready"
            break
        fi
        count=$((count + 1))
        sleep 2
    done
    
    if [[ $count -eq $retries ]]; then
        print_error "PostgreSQL failed to start"
        return 1
    fi
    
    # Check Elasticsearch
    count=0
    print_info "Checking Elasticsearch..."
    while [[ $count -lt $retries ]]; do
        if curl -s http://localhost:9200/_cluster/health 2>/dev/null | grep -q '"status":"green\|yellow"'; then
            print_success "Elasticsearch is ready"
            break
        fi
        count=$((count + 1))
        sleep 3
    done
    
    if [[ $count -eq $retries ]]; then
        print_error "Elasticsearch failed to start"
        print_info "You may need to increase vm.max_map_count:"
        print_info "  sudo sysctl -w vm.max_map_count=262144"
        return 1
    fi
    
    # Check Backend
    count=0
    print_info "Checking Backend API..."
    while [[ $count -lt $retries ]]; do
        if curl -s http://localhost:8000/health 2>/dev/null | grep -q '"status":"healthy"'; then
            print_success "Backend API is ready"
            break
        fi
        count=$((count + 1))
        sleep 2
    done
    
    if [[ $count -eq $retries ]]; then
        print_error "Backend API failed to start"
        return 1
    fi
    
    print_success "All services are healthy!"
    return 0
}

# Print access information
print_access_info() {
    print_step "Installation Complete!"
    
    IP_ADDRESS=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           HelseJournal is now running!                     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "🌐 ${CYAN}Access the application:${NC}"
    echo "   • Local:     http://localhost"
    echo "   • Network:   http://$IP_ADDRESS"
    echo ""
    echo -e "📚 ${CYAN}API Documentation:${NC}"
    echo "   • Swagger UI: http://$IP_ADDRESS:8000/docs"
    echo "   • ReDoc:      http://$IP_ADDRESS:8000/redoc"
    echo ""
    echo -e "🔐 ${CYAN}Default Login Credentials:${NC}"
    echo "   • Username: admin"
    echo "   • Password: admin"
    echo ""
    echo -e "⚙️  ${CYAN}Configuration:${NC}"
    echo "   • Environment: .env"
    echo "   • Uploads:     ./uploads"
    echo "   • Backups:     $BACKUP_DIR"
    echo ""
    echo -e "🛠️  ${CYAN}Useful Commands:${NC}"
    echo "   docker-compose logs -f     # View logs"
    echo "   docker-compose ps          # Check status"
    echo "   docker-compose down        # Stop services"
    echo "   docker-compose up -d       # Start services"
    echo "   docker-compose restart     # Restart services"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Please change the default password after first login!${NC}"
    echo ""
}

# Main installation process
main() {
    print_header
    
    # Check prerequisites
    print_step "Checking Prerequisites"
    
    if ! check_docker; then
        print_warning "Docker is not installed"
        read -p "Would you like to install Docker? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_docker
        else
            print_error "Docker is required. Please install Docker and try again."
            exit 1
        fi
    fi
    
    if ! check_docker_compose; then
        print_warning "Docker Compose is not installed"
        read -p "Would you like to install Docker Compose? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_docker_compose
        else
            print_error "Docker Compose is required. Please install Docker Compose and try again."
            exit 1
        fi
    fi
    
    # Check resources
    check_resources
    
    # Create environment
    if [[ -f .env ]]; then
        print_warning "Environment file already exists"
        read -p "Would you like to recreate it? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            create_env_file
        fi
    else
        create_env_file
    fi
    
    # Create directories
    create_directories
    
    # Start services
    start_services
    
    # Check health
    if check_health; then
        print_access_info
    else
        print_error "Some services failed to start. Please check the logs:"
        echo "  docker-compose logs"
        exit 1
    fi
}

# Handle script interruption
trap 'print_error "Installation interrupted"; exit 1' INT TERM

# Run main function
main "$@"
