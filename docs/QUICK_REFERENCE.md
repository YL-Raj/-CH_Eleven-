# CH_Eleven Quick Reference Card

## 🚀 One-Minute Start

```bash
cd ch-eleven
docker compose up -d
open http://localhost:3000  # macOS/Linux
# Or: http://localhost:3000 in browser (Windows)
```

**Admin Key:** Check `.env` (default: `ch11-admin-2026`)

---

## 🎯 What to Do Next

| Action | Where | Steps |
|--------|-------|-------|
| **Set Match** | Admin → Match info | Fill in match details, click Save |
| **Add Players** | Admin → Add player | Enter player name/team/role, click Add |
| **Register Team** | Register tab | Pick 11 players, set C+VC, Register |
| **Upload Score** | Admin → Upload scorecard | Upload PDF/image, click Process |
| **View Results** | Leaderboard tab | See live rankings |

---

## 🔧 Common Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend      # API logs
docker compose logs -f ocr-service  # OCR logs

# Restart a service
docker compose restart backend
docker compose restart ocr-service

# Stop everything
docker compose down

# Access database
docker exec -it ch-eleven-db-1 psql -U admin -d ch_eleven

# Backup database
docker exec ch-eleven-db-1 pg_dump -U admin ch_eleven > backup.sql
```

---

## 📍 Service Locations

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | User app |
| **API** | http://localhost:3001 | Backend endpoints |
| **OCR** | http://localhost:5000 | Internal (not accessed directly) |
| **Database** | localhost:5432 | PostgreSQL (internal) |

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `.env` | Configuration (admin key, passwords) |
| `docker-compose.yml` | All services |
| `setup.sh` | Auto-setup script |
| `README.md` | Full documentation |
| `DEPLOYMENT.md` | Production guide |

---

## 🎪 File Upload

**Supported formats:**
- PDF, PNG, JPG, DOCX, CSV
- Max 50MB
- Cricket scorecard table format required

**Process:**
1. Admin Panel → "Upload scorecard"
2. Select inning (1st or 2nd)
3. Choose file
4. Click "Process scorecard"
5. Stats auto-updated ✨

---

## ⚠️ Important

- **Credentials:** Keep `.env` private
- **Data:** Database persists, temp files auto-delete
- **Backup:** Run `docker exec ch-eleven-db-1 pg_dump -U admin ch_eleven > backup.sql` regularly
- **Logs:** Check `docker compose logs -f` for errors

---

## 🆘 If Something Breaks

```bash
# Check status
docker compose ps

# View logs
docker compose logs -f

# Restart everything
docker compose restart

# Full reset (data loss!)
docker compose down -v
docker compose up -d
```

---

## 📞 Help

- `README.md` - Features & API
- `DEPLOYMENT.md` - Setup & troubleshooting
- `SCORECARD_UPLOAD.md` - OCR guide
- Logs: `docker compose logs -f`

---

**CH_Eleven — Fantasy Cricket Platform**  
Built with ❤️ using Docker
