#!/bin/bash

# CH_Eleven Setup & Deployment Script
# Production-ready initialization for all platforms

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker not installed"
        echo "Install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker installed: $(docker --version)"
    
    # Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose not installed"
        echo "Install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    print_success "Docker Compose installed"
    
    # Git
    if command -v git &> /dev/null; then
        print_success "Git installed: $(git --version | cut -d' ' -f3)"
    else
        print_warning "Git not installed (optional)"
    fi
    
    # Check disk space
    available_space=$(df . | awk 'NR==2 {print $4}')
    required_space=$((50 * 1024 * 1024))  # 50GB in KB
    
    if [ "$available_space" -lt "$required_space" ]; then
        print_warning "Low disk space: $(numfmt --to=iec $available_space 2>/dev/null || echo "$available_space KB")"
        print_info "Recommended: 50GB free space"
    else
        print_success "Sufficient disk space available"
    fi
}

# Create environment file
setup_env() {
    print_header "Setting Up Environment"
    
    if [ -f .env ]; then
        print_warning ".env file already exists"
        read -p "Overwrite? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Keeping existing .env"
            return
        fi
    fi
    
    # Generate secure admin key
    admin_key=$(openssl rand -hex 16)
    db_password=$(openssl rand -hex 16)
    
    cat > .env << EOF
# Auto-generated on $(date)
POSTGRES_DB=ch_eleven
POSTGRES_USER=admin
POSTGRES_PASSWORD=$db_password
DATABASE_URL=postgres://admin:$db_password@db:5432/ch_eleven
PORT=3001
ADMIN_SECRET=$admin_key
NODE_ENV=production
DEBUG=false
OCR_PORT=5000
ENVIRONMENT=production
MAX_FILE_SIZE_MB=50
TEMP_FILE_RETENTION_HOURS=1
EOF
    
    print_success ".env file created"
    print_info "Admin Secret: $admin_key (save this!)"
    print_warning "Keep .env file secure - do not commit to git"
}

# Build Docker images
build_images() {
    print_header "Building Docker Images"
    
    print_info "This may take 5-15 minutes on first run..."
    
    if docker compose build --no-cache 2>&1; then
        print_success "All images built successfully"
    else
        print_error "Build failed"
        exit 1
    fi
}

# Start services
start_services() {
    print_header "Starting Services"
    
    print_info "Starting Docker containers..."
    
    if docker compose up -d 2>&1; then
        print_success "All services started"
    else
        print_error "Failed to start services"
        exit 1
    fi
    
    # Wait for services to be healthy
    print_info "Waiting for services to become healthy..."
    
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker compose ps | grep -q "unhealthy\|Exit"; then
            print_warning "Waiting for services (attempt $((attempt + 1))/$max_attempts)..."
            sleep 2
            ((attempt++))
        else
            print_success "All services are healthy"
            break
        fi
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_warning "Services did not become healthy in time. Checking logs..."
        docker compose logs --tail=20
    fi
}

# Verify installation
verify_installation() {
    print_header "Verifying Installation"
    
    # Check container status
    print_info "Service Status:"
    docker compose ps
    
    # Health checks
    print_info "Running health checks..."
    
    # Backend
    if curl -s http://localhost:3001/health | grep -q "ok"; then
        print_success "Backend API responding"
    else
        print_warning "Backend API not responding yet"
    fi
    
    # Frontend
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_success "Frontend accessible"
    else
        print_warning "Frontend not responding yet"
    fi
    
    # OCR Service
    if curl -s http://localhost:5000/health | grep -q "healthy"; then
        print_success "OCR service healthy"
    else
        print_warning "OCR service not responding yet"
    fi
    
    # Database
    if docker exec ch-eleven-db-1 pg_isready -U admin > /dev/null 2>&1; then
        print_success "Database ready"
    else
        print_warning "Database not ready"
    fi
}

# Show access information
show_info() {
    print_header "Setup Complete!"
    
    echo
    print_info "Access your application:"
    echo -e "  ${GREEN}Frontend:${NC}     http://localhost:3000"
    echo -e "  ${GREEN}Admin Key:${NC}    Check .env file (ADMIN_SECRET)"
    echo -e "  ${GREEN}Backend API:${NC}  http://localhost:3001"
    echo
    
    print_info "Useful commands:"
    echo -e "  ${GREEN}View logs:${NC}            docker compose logs -f"
    echo -e "  ${GREEN}Stop services:${NC}       docker compose down"
    echo -e "  ${GREEN}Restart service:${NC}     docker compose restart <service>"
    echo -e "  ${GREEN}Database shell:${NC}      docker exec -it ch-eleven-db-1 psql -U admin -d ch_eleven"
    echo -e "  ${GREEN}Backend shell:${NC}       docker exec -it ch-eleven-backend-1 bash"
    echo
    
    print_warning "SECURITY REMINDERS:"
    echo "  • Keep .env file private"
    echo "  • Change ADMIN_SECRET in production"
    echo "  • Use HTTPS in production"
    echo "  • Enable firewall rules"
    echo "  • Regular database backups"
    echo
    
    print_info "Next steps:"
    echo "  1. Open http://localhost:3000 in your browser"
    echo "  2. Click Admin tab"
    echo "  3. Enter admin key from .env"
    echo "  4. Add match details and players"
    echo "  5. Have users register teams"
    echo "  6. Upload scorecard PDFs after match"
    echo
}

# Cleanup on error
cleanup_on_error() {
    print_error "Setup failed!"
    print_info "Cleaning up..."
    docker compose down
    exit 1
}

trap cleanup_on_error ERR

# Main execution
main() {
    clear
    print_header "CH_Eleven Setup & Deployment"
    print_info "Production-ready installation script"
    echo
    
    check_prerequisites
    setup_env
    build_images
    start_services
    sleep 5  # Give services time to stabilize
    verify_installation
    show_info
}

# Run main
main
