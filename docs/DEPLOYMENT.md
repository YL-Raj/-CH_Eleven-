# CH_Eleven Production Deployment Guide

## Overview

Full-stack fantasy cricket application with OCR scorecard parsing, supporting 50-100 concurrent users on a single laptop server.

**Architecture:**
- **Frontend** (Nginx) - React-like single-page app on port 3000
- **Backend** (Node.js + PostgreSQL) - API server on port 3001
- **OCR Service** (Python Flask) - Tesseract OCR on port 5000 (internal)
- **Database** (PostgreSQL) - Local storage

**Features:**
- PDF/Image scorecard upload with automatic OCR parsing
- Bulk player stat updates from scorecards
- Real-time fantasy points calculation
- Concurrent user support (50-100)
- Secure file handling (auto-cleanup)
- Environment-based configuration (no hardcoded credentials)

---

## Prerequisites

### System Requirements
- **OS:** Linux (Ubuntu 20.04+), macOS, or Windows (WSL2)
- **RAM:** 8GB minimum (for concurrent users + OCR)
- **Storage:** 50GB (mostly for PostgreSQL and temp files)
- **Docker:** 20.10+ with Docker Compose 2.0+

### System Packages
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git curl

# Enable Docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# macOS (with Homebrew)
brew install docker docker-compose git
# Then start Docker Desktop
```

### Tesseract OCR (for OCR service)
Included in Docker image - no manual installation needed.

---

## Installation & Deployment

### Step 1: Clone/Setup Project

```bash
# Create project directory
mkdir -p /opt/ch-eleven
cd /opt/ch-eleven

# Clone repository (or copy files)
git clone <your-repo-url> .
# OR copy the entire project directory

# Ensure proper permissions
chmod +x /opt/ch-eleven
```

### Step 2: Configure Environment

Create `.env` file in project root:

```bash
cat > .env << 'EOF'
# Database
POSTGRES_DB=ch_eleven
POSTGRES_USER=admin
POSTGRES_PASSWORD=ch11secret
DATABASE_URL=postgres://admin:ch11secret@db:5432/ch_eleven

# Backend
PORT=3001
ADMIN_SECRET=ch11-admin-2026
NODE_ENV=production
DEBUG=false

# OCR Service
OCR_PORT=5000

# Security (change these in production!)
SECRET_KEY=$(openssl rand -hex 32)
EOF
```

**Security Note:** In production, use strong random values:
```bash
# Generate secure admin key
openssl rand -hex 32
```

### Step 3: Build & Start Services

```bash
# Build all images (first time only)
docker compose build

# Start all services in background
docker compose up -d

# Verify services are running
docker compose ps

# Expected output:
# NAME                  STATUS              PORTS
# ch-eleven-db-1        Up (healthy)        5432/tcp
# ch-eleven-backend-1   Up (healthy)        3001/tcp
# ch-eleven-ocr-service-1 Up (healthy)    5000/tcp
# ch-eleven-frontend-1  Up                  3000/tcp
```

### Step 4: Verify Installation

```bash
# Health checks
curl http://localhost:3001/health
curl http://localhost:5000/health

# Access frontend
open http://localhost:3000  # macOS
xdg-open http://localhost:3000  # Linux
# Or navigate to http://localhost:3000 in browser
```

### Step 5: Initialize Database

```bash
# Database schema loads automatically on first run
# Verify tables exist:
docker exec ch-eleven-db-1 psql -U admin -d ch_eleven -c "\dt"

# Expected: match_info, players, contest_teams, contest_settings tables
```

---

## Usage Guide

### Access Admin Panel

1. Open `http://localhost:3000`
2. Click "⚙ Admin" tab
3. Enter admin key: `ch11-admin-2026`
4. Click "Enter"

### Upload Scorecard (OCR)

1. In Admin panel, find "Upload scorecard (1st/2nd inning)" section
2. **NEW: File Upload Option**
   - Click "Choose file" button
   - Select PDF, PNG, JPG, DOCX, or CSV with scorecard
3. **Select inning:** 1st or 2nd
4. **Click:** "Process scorecard"
5. System will:
   - Extract text via OCR (Tesseract)
   - Parse batting/bowling tables
   - Match player names automatically
   - Update all stats
   - Show results (matched/unmatched players)

### Manual Scorecard (JSON)

If automatic OCR parsing needs adjustment:

1. Paste JSON scorecard data directly
2. Click "Process scorecard"
3. Stats update immediately

---

## Performance Tuning (50-100 Concurrent Users)

### Docker Compose Resource Limits

Edit `docker-compose.yml` services section:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

  ocr-service:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G
        reservations:
          cpus: '2'
          memory: 2G

  db:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 3G
        reservations:
          cpus: '1'
          memory: 2G
```

### PostgreSQL Optimization

```sql
-- Connect to database
docker exec ch-eleven-db-1 psql -U admin -d ch_eleven

-- Increase connection pool
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '1GB';

-- Restart database
docker restart ch-eleven-db-1
```

### OCR Service Tuning

Edit `ocr-service/ocr_service.py`:

```python
# Increase worker threads
if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=port,
        debug=False,
        threaded=True,
        max_workers=10,  # Add this
    )
```

---

## File Management

### Temporary Files

All uploaded files are automatically stored in `/tmp/uploads` inside containers:

- Auto-deleted after 1 hour
- On server restart, all temp files cleared
- No permanent storage of uploads

### View Uploaded Files

```bash
docker exec ch-eleven-ocr-service-1 ls -la /tmp/uploads/
```

### Manual Cleanup

```bash
# Clean all temp uploads
docker exec ch-eleven-ocr-service-1 rm -rf /tmp/uploads/*

# Or rebuild containers (removes all data except DB)
docker compose down
docker compose up -d
```

---

## Monitoring & Logs

### View Service Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f ocr-service

# Last 100 lines
docker compose logs --tail=100 backend
```

### Monitor Resource Usage

```bash
# Real-time stats
docker stats

# Specific container
docker stats ch-eleven-backend-1
```

### Check Database

```bash
# Connect to database
docker exec -it ch-eleven-db-1 psql -U admin -d ch_eleven

# Show tables
\dt

# Show players
SELECT name, runs, wickets, fantasy_points FROM players LIMIT 5;

# Show teams
SELECT owner_name, total FROM contest_teams ORDER BY total DESC LIMIT 5;

# Exit
\q
```

---

## Troubleshooting

### Issue: "Cannot connect to API"

```bash
# Check if backend is running
docker compose ps backend

# View logs
docker compose logs backend

# Restart backend
docker compose restart backend
```

### Issue: "OCR service not responding"

```bash
# Check OCR service health
curl http://localhost:5000/health

# View OCR logs
docker compose logs ocr-service

# Restart OCR
docker compose restart ocr-service
```

### Issue: "File upload fails"

Possible causes:
- File too large (>50MB) → Use smaller resolution
- Wrong file format → Use PDF, PNG, JPG, DOCX, CSV
- OCR service down → `docker compose restart ocr-service`
- No admin key → Check ADMIN_SECRET in `.env`

### Issue: "High memory usage"

```bash
# Check which service uses memory
docker stats

# Restart heavy service
docker compose restart ocr-service

# Or reduce resource limits in docker-compose.yml
```

### Issue: "Database connection error"

```bash
# Check database
docker compose ps db

# View database logs
docker compose logs db

# Reset database
docker compose down -v  # WARNING: Deletes all data
docker compose up -d
```

---

## Backup & Restore

### Backup Database

```bash
# Export database
docker exec ch-eleven-db-1 pg_dump -U admin ch_eleven > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker exec ch-eleven-db-1 pg_dump -U admin ch_eleven | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore Database

```bash
# From SQL file
docker exec -i ch-eleven-db-1 psql -U admin ch_eleven < backup_20240525_120000.sql

# From compressed file
gunzip -c backup_20240525_120000.sql.gz | docker exec -i ch-eleven-db-1 psql -U admin ch_eleven
```

---

## Security Considerations

### Production Checklist

- [ ] Change ADMIN_SECRET in `.env` to strong random value
- [ ] Disable DEBUG mode in `.env`
- [ ] Use firewall to restrict ports 3000, 3001 to trusted IPs
- [ ] Enable HTTPS (use reverse proxy like Nginx)
- [ ] Run on non-root user
- [ ] Regular database backups
- [ ] Monitor logs for unauthorized access

### Network Security

```bash
# Allow only localhost (development)
# Edit docker-compose.yml ports:
ports:
  - "127.0.0.1:3000:80"    # Frontend
  - "127.0.0.1:3001:3001"  # Backend only

# For LAN access, use firewall:
sudo ufw allow from 192.168.1.0/24 to any port 3000
sudo ufw allow from 192.168.1.0/24 to any port 3001
```

### Environment Security

Never commit `.env` to version control:

```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo "*.sql" >> .gitignore

# Keep .env.example as template
cp .env .env.example
sed 's/ch11secret/YOUR_PASSWORD/g' .env.example
```

---

## Scaling Beyond Single Server

### For 100+ concurrent users, consider:

1. **Load Balancer** (HAProxy/Nginx)
   - Route requests across multiple backend instances

2. **Database Replication**
   - PostgreSQL streaming replication
   - Read replicas for scale

3. **Separate OCR Service**
   - Dedicated server for OCR (CPU intensive)
   - Message queue (Redis) for job distribution

4. **Docker Swarm / Kubernetes**
   - Orchestrate multiple containers
   - Auto-scaling based on load

---

## Maintenance

### Regular Tasks

```bash
# Weekly: Backup database
0 2 * * 0 /path/to/ch-eleven/backup.sh

# Daily: Check logs for errors
docker compose logs backend | grep -i error

# Monthly: Prune unused Docker resources
docker system prune -a
```

### Updates

```bash
# Pull latest code
git pull

# Rebuild images
docker compose build --no-cache

# Restart services
docker compose up -d

# Database migrations (if any)
docker compose exec backend npm run migrate
```

---

## Support & Issues

### Common Commands Reference

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View status
docker compose ps

# View logs
docker compose logs -f

# Restart a service
docker compose restart backend

# Clean up everything
docker compose down -v

# Access container shell
docker exec -it ch-eleven-backend-1 bash

# Run command in container
docker exec ch-eleven-backend-1 npm --version
```

### Debug OCR Upload

```bash
# Check OCR service directly
curl -X POST http://localhost:5000/health

# Test with sample file
curl -X POST http://localhost:5000/api/ocr/extract \
  -H "x-admin-key: ch11-admin-2026" \
  -F "file=@scorecard.pdf" \
  -F "inning=1"
```

---

## Production Deployment (Cloud)

### Deploy to AWS/GCP/Azure

For cloud deployment:

1. **EC2/VM Instance** (Ubuntu 20.04+, 8GB RAM, 50GB storage)
2. **Install Docker** (same as above)
3. **Configure security groups/firewall**
4. **Set environment variables** (.env)
5. **Run `docker compose up -d`**
6. **Enable HTTPS** with Let's Encrypt
7. **Setup database backups** to cloud storage

Example AWS EC2:

```bash
# SSH into instance
ssh -i key.pem ubuntu@your-instance-ip

# Install Docker
sudo apt-get update && sudo apt-get install -y docker.io docker-compose git

# Clone and start
git clone <repo> /opt/ch-eleven
cd /opt/ch-eleven
docker compose up -d

# Access
http://your-instance-ip:3000
```

---

## End-to-End Workflow Example

```bash
# 1. Start all services
docker compose up -d

# 2. Create players via Admin panel
# (or upload CSV with player list)

# 3. Set match details (Teams, Date, Venue)

# 4. Users register teams (they pick 11 players + captain/VC)

# 5. During/After match:
#    - Upload 1st inning scorecard (PDF/Image)
#    - System auto-extracts and updates stats
#    - Users see live leaderboard updates
#    - Upload 2nd inning scorecard
#    - Final leaderboard calculated

# 6. Results declared

# 7. Backup data
docker exec ch-eleven-db-1 pg_dump -U admin ch_eleven > final_backup.sql
```

---

## Next Steps

- [ ] Customize branding/colors
- [ ] Add custom scoring rules
- [ ] Integration with live cricket APIs
- [ ] SMS/Email notifications
- [ ] Mobile app
- [ ] Payment integration for contests
- [ ] Advanced analytics dashboard

---

## Support

For issues or questions:
- Check logs: `docker compose logs -f`
- Review troubleshooting section above
- Verify `.env` configuration
- Ensure all ports (3000, 3001, 5432) are available

**Happy deploying! 🚀**
