# CH_Eleven Fantasy Cricket - Setup & Testing Guide

## Prerequisites
- Docker and Docker Compose installed
- Postman, curl, or a REST API client (or use browser for GET requests)
- Your data ready (players, match info, teams)

---

## Step 1: Start the Application

Run the Compose stack:
```bash
docker compose up -d
```

Verify all containers are running:
```bash
docker ps
```

You should see:
- `ch-eleven-db-1` (PostgreSQL) — Status: Up (healthy)
- `ch-eleven-backend-1` (Node.js API) — Status: Up
- `ch-eleven-frontend-1` (Nginx) — Status: Up

---

## Step 2: Verify Backend Connectivity

Test the health endpoint:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"ok":true,"time":"2026-05-25T..."}
```

---

## Step 3: Upload Match Information

**Endpoint:** `PUT http://localhost:3001/api/match`

**Headers:**
```
X-Admin-Key: ch11-admin-2026
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "India vs Pakistan T20",
  "team_a": "India",
  "team_b": "Pakistan",
  "match_date": "2026-05-25T19:00:00Z",
  "venue": "MCG, Melbourne",
  "overs": 20,
  "status": "live"
}
```

**Using curl:**
```bash
curl -X PUT http://localhost:3001/api/match \
  -H "X-Admin-Key: ch11-admin-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "India vs Pakistan T20",
    "team_a": "India",
    "team_b": "Pakistan",
    "match_date": "2026-05-25T19:00:00Z",
    "venue": "MCG, Melbourne",
    "overs": 20,
    "status": "live"
  }'
```

Verify:
```bash
curl http://localhost:3001/api/match
```

---

## Step 4: Upload Players

**Endpoint:** `POST http://localhost:3001/api/players`

**Headers:**
```
X-Admin-Key: ch11-admin-2026
Content-Type: application/json
```

**Request Body (add each player):**
```json
{
  "name": "Virat Kohli",
  "cric_team": "India",
  "role": "BAT"
}
```

**Using curl:**
```bash
curl -X POST http://localhost:3001/api/players \
  -H "X-Admin-Key: ch11-admin-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Virat Kohli",
    "cric_team": "India",
    "role": "BAT"
  }'
```

Repeat for all players. Note the returned `id` for each player—you'll need these IDs for contest teams.

**Verify all players:**
```bash
curl http://localhost:3001/api/players
```

---

## Step 5: Update Player Stats (After Match)

**Endpoint:** `PUT http://localhost:3001/api/players/{id}`

**Headers:**
```
X-Admin-Key: ch11-admin-2026
Content-Type: application/json
```

**Request Body (example for batter):**
```json
{
  "name": "Virat Kohli",
  "cric_team": "India",
  "role": "BAT",
  "runs": 75,
  "balls_faced": 52,
  "fours": 8,
  "sixes": 2,
  "duck": false,
  "catches": 1,
  "stumpings": 0,
  "ro_direct": 0,
  "ro_indirect": 0
}
```

**Request Body (example for bowler):**
```json
{
  "name": "Jasprit Bumrah",
  "cric_team": "India",
  "role": "BOWL",
  "wickets": 3,
  "overs_bowled": 4,
  "runs_conceded": 28,
  "maidens": 1
}
```

**Using curl:**
```bash
curl -X PUT http://localhost:3001/api/players/1 \
  -H "X-Admin-Key: ch11-admin-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Virat Kohli",
    "cric_team": "India",
    "role": "BAT",
    "runs": 75,
    "balls_faced": 52,
    "fours": 8,
    "sixes": 2
  }'
```

---

## Step 6: Create Contest Teams

**Endpoint:** `POST http://localhost:3001/api/teams`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "owner_name": "My Fantasy Team",
  "player_ids": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  "captain_id": 1,
  "vc_id": 2
}
```

**Using curl:**
```bash
curl -X POST http://localhost:3001/api/teams \
  -H "Content-Type: application/json" \
  -d '{
    "owner_name": "My Fantasy Team",
    "player_ids": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    "captain_id": 1,
    "vc_id": 2
  }'
```

**Notes:**
- `player_ids` must contain exactly 11 player IDs
- `captain_id` and `vc_id` must be in `player_ids`
- Player scores are automatically calculated and doubled for captain, 1.5x for vice-captain

---

## Step 7: View Leaderboard

**Endpoint:** `GET http://localhost:3001/api/leaderboard`

**Using curl:**
```bash
curl http://localhost:3001/api/leaderboard
```

Expected response: Teams ranked by total fantasy points.

```json
[
  {
    "id": 1,
    "owner_name": "My Fantasy Team",
    "player_ids": [1, 2, 3, ...],
    "captain_id": 1,
    "vc_id": 2,
    "total": 245.5,
    "rank": 1,
    "captain_name": "Virat Kohli",
    "vc_name": "Rohit Sharma"
  }
]
```

---

## Step 8: Update Contest Settings

**Endpoint:** `PUT http://localhost:3001/api/settings`

**Headers:**
```
X-Admin-Key: ch11-admin-2026
Content-Type: application/json
```

**Request Body:**
```json
{
  "max_entries": 100
}
```

**Using curl:**
```bash
curl -X PUT http://localhost:3001/api/settings \
  -H "X-Admin-Key: ch11-admin-2026" \
  -H "Content-Type: application/json" \
  -d '{"max_entries": 100}'
```

---

## Step 9: Access Frontend

Open your browser and navigate to:
```
http://localhost:3000
```

This displays the fantasy cricket interface with the leaderboard, team details, and live updates.

---

## Quick Reference: All Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/health` | ❌ | Health check |
| GET | `/api/match` | ❌ | Get match info |
| PUT | `/api/match` | ✅ | Update match info |
| GET | `/api/players` | ❌ | Get all players |
| POST | `/api/players` | ✅ | Add player |
| PUT | `/api/players/{id}` | ✅ | Update player stats |
| DELETE | `/api/players/{id}` | ✅ | Delete player |
| GET | `/api/teams` | ❌ | Get all contest teams |
| GET | `/api/teams/count` | ❌ | Get team count & capacity |
| POST | `/api/teams` | ❌ | Create contest team |
| DELETE | `/api/teams/{id}` | ✅ | Delete team |
| GET | `/api/leaderboard` | ❌ | Get ranked leaderboard |
| GET | `/api/settings` | ❌ | Get contest settings |
| PUT | `/api/settings` | ✅ | Update settings |

**✅ = Requires `X-Admin-Key: ch11-admin-2026` header**

---

## Troubleshooting

### Backend not responding
```bash
docker logs ch-eleven-backend-1
```

### Database connection issues
```bash
docker logs ch-eleven-db-1
```

### Frontend not loading
```bash
docker logs ch-eleven-frontend-1
```

### Stop all containers
```bash
docker compose down
```

### View all service logs
```bash
docker compose logs
```

---

## Testing Workflow

1. ✅ Start containers: `docker compose up -d`
2. ✅ Test health: `curl http://localhost:3001/health`
3. ✅ Upload match info (admin)
4. ✅ Upload players (admin)
5. ✅ Create contest teams (any user)
6. ✅ Update player stats after match (admin)
7. ✅ View leaderboard: `curl http://localhost:3001/api/leaderboard`
8. ✅ Open frontend: `http://localhost:3000`

---

## Admin Key
All admin endpoints require the header:
```
X-Admin-Key: ch11-admin-2026
```

Change this in `docker-compose.yml` under `ADMIN_SECRET` if needed.







Here are all the essential Docker and project commands you need:

## Docker Compose Commands

```bash
# Start all services in background
docker compose up -d

# Start and rebuild images
docker compose up -d --build

# Rebuild specific service
docker compose up -d --build backend

# Stop all containers (keep volumes)
docker compose stop

# Stop and remove all containers/networks
docker compose down

# Remove everything including volumes
docker compose down -v

# View logs from all services
docker compose logs

# View logs from specific service
docker compose logs backend
docker compose logs db
docker compose logs frontend

# Follow logs in real-time
docker compose logs -f backend

# View running containers
docker compose ps
```

## Docker Container Commands

```bash
# List all running containers
docker ps

# List all containers (including stopped)
docker ps -a

# View logs from a container
docker logs ch-eleven-backend-1
docker logs ch-eleven-db-1

# Follow logs in real-time
docker logs -f ch-eleven-backend-1

# Execute command inside running container
docker exec ch-eleven-backend-1 ls -la
docker exec -it ch-eleven-db-1 psql -U admin ch_eleven

# Stop a specific container
docker stop ch-eleven-backend-1

# Start a specific container
docker start ch-eleven-backend-1

# Remove a stopped container
docker rm ch-eleven-backend-1

# View container details (IP, ports, etc.)
docker inspect ch-eleven-backend-1
```

## Docker Image Commands

```bash
# List all images
docker images

# Build an image
docker build -t my-image:latest ./backend

# Remove an image
docker rmi ch-eleven-backend

# Remove unused images
docker image prune
```

## Database Backup & Restore

```bash
# Backup database to file
docker exec ch-eleven-db-1 pg_dump -U admin ch_eleven > backup.sql

# Backup with password prompt
docker exec -it ch-eleven-db-1 pg_dump -U admin ch_eleven > backup.sql

# Restore from backup
docker exec -i ch-eleven-db-1 psql -U admin ch_eleven < backup.sql

# Connect to PostgreSQL directly
docker exec -it ch-eleven-db-1 psql -U admin -d ch_eleven

# Run SQL query
docker exec ch-eleven-db-1 psql -U admin ch_eleven -c "SELECT * FROM players;"
```

## Cleanup Commands

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything unused (containers, images, networks, volumes)
docker system prune -a --volumes

# Show disk usage
docker system df
```

## Debugging Commands

```bash
# View container resource usage
docker stats

# View container processes
docker top ch-eleven-backend-1

# Copy file from container
docker cp ch-eleven-backend-1:/app/server.js ./

# Copy file to container
docker cp ./server.js ch-eleven-backend-1:/app/

# View container networks
docker network ls
docker network inspect ch-eleven_default
```

## Project-Specific Commands

```bash
# Health check
curl http://localhost:3001/health

# Get all players
curl http://localhost:3001/api/players

# Get leaderboard
curl http://localhost:3001/api/leaderboard

# Get match info
curl http://localhost:3001/api/match

# Add player (with admin key)
curl -X POST http://localhost:3001/api/players \
  -H "X-Admin-Key: ch11-admin-2026" \
  -H "Content-Type: application/json" \
  -d '{"name":"Player Name","cric_team":"Team","role":"BAT"}'

# Update player stats
curl -X PUT http://localhost:3001/api/players/1 \
  -H "X-Admin-Key: ch11-admin-2026" \
  -H "Content-Type: application/json" \
  -d '{"runs":50,"wickets":2}'

# Create contest team
curl -X POST http://localhost:3001/api/teams \
  -H "Content-Type: application/json" \
  -d '{"owner_name":"Team1","player_ids":[1,2,3,4,5,6,7,8,9,10,11],"captain_id":1,"vc_id":2}'
```

## Quick Workflow

```bash
# Development workflow
docker compose up -d          # Start all services
docker compose logs -f        # Monitor logs
# Make changes to code
docker compose up -d --build  # Rebuild and restart

# Testing workflow
docker logs ch-eleven-backend-1  # Check backend
docker exec -it ch-eleven-db-1 psql -U admin ch_eleven  # Access DB
curl http://localhost:3001/api/players  # Test API

# Backup workflow
docker compose down -v        # Stop and remove everything
docker exec ch-eleven-db-1 pg_dump -U admin ch_eleven > backup.sql  # Before cleanup
docker exec -i ch-eleven-db-1 psql -U admin ch_eleven < backup.sql  # Restore

# Production checklist
docker compose down           # Stop
docker compose up -d --build  # Rebuild
docker logs ch-eleven-backend-1  # Verify
curl http://localhost:3001/health  # Health check
docker system df              # Check disk usage
```

## Environment Variables (in docker-compose.yml)

```yaml
# Backend
DATABASE_URL: postgres://admin:ch11secret@db:5432/ch_eleven
PORT: 3001
MAX_ENTRIES: 100
ADMIN_SECRET: ch11-admin-2026

# Database
POSTGRES_DB: ch_eleven
POSTGRES_USER: admin
POSTGRES_PASSWORD: ch11secret
```

## File Locations

```
./docker-compose.yml          # Compose config
./backend/Dockerfile          # Backend image
./frontend/Dockerfile         # Frontend image
./backend/package.json        # Node dependencies
./backend/server.js           # Backend code
./SETUP.md                     # Setup guide
backup.sql                     # Database backup
```

## Key Ports

```
3000  → Frontend (Nginx)
3001  → Backend API (Node.js)
5432  → PostgreSQL Database
```

Keep this list handy for daily development and deployment tasks!
