// Minimal working server - compile from git
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());
app.use("/templates", express.static(path.join(__dirname, "../templates")));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ADMIN_SECRET = process.env.ADMIN_SECRET || "ch11-admin-2026";

// ─── Startup migration
(async () => {
  const migrations = [
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS innings_loaded INTEGER DEFAULT 0`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS did_not_play BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS result TEXT DEFAULT ''`,
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS team_a_score TEXT DEFAULT ''`,
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS team_b_score TEXT DEFAULT ''`,
  ];
  let ok = 0;
  for (const sql of migrations) {
    try { await pool.query(sql); ok++; }
    catch (e) { console.warn("Migration skip:", sql.slice(0,60), "—", e.message); }
  }
  console.log(`DB migration OK (${ok}/${migrations.length})`);
})();

// Auth
function adminOnly(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_SECRET) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// Scoring
function calcPoints(p) {
  if (p.manual_points !== null && p.manual_points !== undefined) {
    return parseFloat(p.manual_points);
  }
  let pts = 0;
  const r = p.runs || 0;
  const bf = parseFloat(p.balls_faced) || 0;
  const w = p.wickets || 0;
  const ob = parseFloat(p.overs_bowled) || 0;
  const rc = p.runs_conceded || 0;
  pts += r + (p.fours || 0) + (p.sixes || 0) * 2;
  if (r >= 100) pts += 16; else if (r >= 50) pts += 8;
  if (p.duck) pts -= 2;
  if (bf >= 10) {
    const sr = (r / bf) * 100;
    if (sr < 50) pts -= 6; else if (sr < 60) pts -= 4; else if (sr < 70) pts -= 2;
    else if (sr >= 150) pts += 4; else if (sr >= 130) pts += 2; else if (sr >= 120) pts += 1;
  }
  pts += w * 25;
  if (w >= 5) pts += 16; else if (w >= 4) pts += 8; else if (w >= 3) pts += 4;
  pts += (p.maidens || 0) * 8;
  if (ob >= 2) {
    const eco = rc / ob;
    if (eco < 5) pts += 6; else if (eco < 6) pts += 4; else if (eco <= 7) pts += 2;
    else if (eco >= 12) pts -= 6; else if (eco >= 11) pts -= 4; else if (eco >= 10) pts -= 2;
  }
  pts += (p.catches || 0) * 8 + (p.stumpings || 0) * 12 + (p.ro_direct || 0) * 12 + (p.ro_indirect || 0) * 6;
  return Math.round(pts * 10) / 10;
}

function teamTotal(team, ptsMap) {
  let total = 0;
  for (const pid of team.player_ids) {
    const pp = ptsMap[pid] || 0;
    total += pid === team.captain_id ? pp * 2 : pid === team.vc_id ? pp * 1.5 : pp;
  }
  return Math.round(total * 10) / 10;
}

// Match
app.get("/api/match", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM match_info ORDER BY id LIMIT 1");
  res.json(rows[0] || {});
});

app.put("/api/match", adminOnly, async (req, res) => {
  const { name, team_a, team_b, match_date, venue, overs, status } = req.body;
  const { rows } = await pool.query(
    `UPDATE match_info SET name=$1,team_a=$2,team_b=$3,match_date=$4,venue=$5,overs=$6,status=$7
     WHERE id=1 RETURNING *`,
    [name, team_a, team_b, match_date, venue, overs, status]
  );
  res.json(rows[0]);
});

// Players
app.get("/api/players", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM players ORDER BY id");
  const enriched = rows.map(p => ({ ...p, fantasy_points: calcPoints(p) }));
  res.json(enriched);
});

app.post("/api/players", adminOnly, async (req, res) => {
  const { name, cric_team, role } = req.body;
  const { rows } = await pool.query(
    "INSERT INTO players (name, cric_team, role) VALUES ($1,$2,$3) RETURNING *",
    [name, cric_team || "", role || "BAT"]
  );
  res.json({ ...rows[0], fantasy_points: calcPoints(rows[0]) });
});

app.put("/api/players/:id", adminOnly, async (req, res) => {
  const { id } = req.params;
  const { name, cric_team, role, runs, balls_faced, fours, sixes, duck, wickets, overs_bowled, runs_conceded, maidens, catches, stumpings, ro_direct, ro_indirect, manual_points } = req.body;
  const { rows } = await pool.query(
    `UPDATE players SET name=$1,cric_team=$2,role=$3,runs=$4,balls_faced=$5,fours=$6,sixes=$7,duck=$8,
      wickets=$9,overs_bowled=$10,runs_conceded=$11,maidens=$12,catches=$13,stumpings=$14,ro_direct=$15,ro_indirect=$16,manual_points=$17
     WHERE id=$18 RETURNING *`,
    [name, cric_team, role, runs||0, balls_faced||0, fours||0, sixes||0, !!duck, wickets||0, overs_bowled||0, runs_conceded||0, maidens||0, catches||0, stumpings||0, ro_direct||0, ro_indirect||0, manual_points ?? null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json({ ...rows[0], fantasy_points: calcPoints(rows[0]) });
});

app.delete("/api/players/:id", adminOnly, async (req, res) => {
  await pool.query("DELETE FROM players WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

// Teams
app.get("/api/teams", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM contest_teams ORDER BY registered_at");
  res.json(rows);
});

app.post("/api/teams", async (req, res) => {
  const { owner_name, player_ids, captain_id, vc_id } = req.body;
  const { rows: matchRows } = await pool.query("SELECT status FROM match_info ORDER BY id LIMIT 1");
  const matchStatus = matchRows[0]?.status || "upcoming";
  if (matchStatus === "live" || matchStatus === "completed") {
    return res.status(409).json({ error: `Cannot register: match is ${matchStatus}` });
  }
  if (!owner_name?.trim()) return res.status(400).json({ error: "owner_name required" });
  if (!Array.isArray(player_ids) || player_ids.length !== 11) return res.status(400).json({ error: "Exactly 11 players required" });
  if (!captain_id || !vc_id) return res.status(400).json({ error: "captain_id and vc_id required" });
  const { rows } = await pool.query(
    `INSERT INTO contest_teams (owner_name, player_ids, captain_id, vc_id) VALUES ($1,$2,$3,$4) 
     ON CONFLICT (owner_name) DO UPDATE SET player_ids=EXCLUDED.player_ids,captain_id=EXCLUDED.captain_id,vc_id=EXCLUDED.vc_id,registered_at=NOW()
     RETURNING *`,
    [owner_name.trim(), player_ids.map(Number), parseInt(captain_id), parseInt(vc_id)]
  );
  res.status(201).json(rows[0]);
});

// Leaderboard
app.get("/api/leaderboard", async (req, res) => {
  const [{ rows: players }, { rows: teams }] = await Promise.all([
    pool.query("SELECT * FROM players"),
    pool.query("SELECT * FROM contest_teams"),
  ]);
  const ptsMap = {};
  for (const p of players) ptsMap[p.id] = calcPoints(p);
  const ranked = teams.map(t => ({ ...t, total: teamTotal(t, ptsMap), captain_name: players.find(p => p.id === t.captain_id)?.name || "?", vc_name: players.find(p => p.id === t.vc_id)?.name || "?" }))
    .sort((a, b) => b.total - a.total)
    .map((t, i) => ({ ...t, rank: i + 1 }));
  res.json(ranked);
});

// Settings
app.get("/api/settings", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM contest_settings WHERE id=1");
  res.json(rows[0] || { max_entries: 50 });
});

app.put("/api/settings", adminOnly, async (req, res) => {
  const { max_entries } = req.body;
  const capped = Math.min(Math.max(10, parseInt(max_entries) || 50), 100);
  await pool.query("UPDATE contest_settings SET max_entries=$1, updated_at=NOW() WHERE id=1", [capped]);
  res.json({ max_entries: capped });
});

// Health
app.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/templates")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = parseInt(process.env.PORT || "3001", 10);
app.listen(PORT, () => console.log(`CH_Eleven API running on :${PORT}`));
