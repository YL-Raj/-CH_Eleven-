// Copyright (c) 2026 RAJ.Y — All rights reserved.
// CH_Eleven Fantasy Cricket Platform
// https://github.com/RAJ-Y/ch-eleven
// CH_Eleven Backend — Express + PostgreSQL
// All scoring logic lives here so the frontend is always consistent.

const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const FormData = require("form-data");

const path = require("path");
const app = express();
app.use(express.json());
app.use(cors());

// Serve downloadable templates (squad-template.csv, match-template.json, etc.)
app.use("/templates", express.static(path.join(__dirname, "../templates")));

// ─── Multer (file uploads) ────────────────────────────────────────────────────
const upload = multer({
  dest: "/tmp/uploads",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MAX_ENTRIES = parseInt(process.env.MAX_ENTRIES || "100", 10);
const ADMIN_SECRET = process.env.ADMIN_SECRET || "ch11-admin-2026";

// ─── Startup migration — each ALTER runs independently so one skip can't block others
(async () => {
  const migrations = [
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS innings_loaded INTEGER DEFAULT 0`,
    `ALTER TABLE players    ADD COLUMN IF NOT EXISTS did_not_play  BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS result        TEXT DEFAULT ''`,
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS team_a_score  TEXT DEFAULT ''`,
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS team_b_score  TEXT DEFAULT ''`,
    `DO $$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname = 'unique_owner_name'
         AND conrelid = 'contest_teams'::regclass
       ) THEN
         ALTER TABLE contest_teams ADD CONSTRAINT unique_owner_name UNIQUE (owner_name);
       END IF;
     END $$`,
  ];
  let ok = 0;
  for (const sql of migrations) {
    try { await pool.query(sql); ok++; }
    catch (e) { console.warn("Migration skip:", sql.slice(0,60), "—", e.message); }
  }
  console.log(`DB migration OK (${ok}/${migrations.length})`);
})();

// ─── Auth middleware ──────────────────────────────────────────────────────────
function adminOnly(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_SECRET) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ─── Scoring engine (mirrors the React UI) ───────────────────────────────────
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

  // Batting
  pts += r + (p.fours || 0) + (p.sixes || 0) * 2;
  if (r >= 100) pts += 16; else if (r >= 50) pts += 8;
  if (p.duck) pts -= 2;
  if (bf >= 10) {
    const sr = (r / bf) * 100;
    if (sr < 50) pts -= 6; else if (sr < 60) pts -= 4; else if (sr < 70) pts -= 2;
    else if (sr >= 150) pts += 4; else if (sr >= 130) pts += 2; else if (sr >= 120) pts += 1;
  }

  // Bowling
  pts += w * 25;
  if (w >= 5) pts += 16; else if (w >= 4) pts += 8; else if (w >= 3) pts += 4;
  pts += (p.maidens || 0) * 8;
  if (ob >= 2) {
    const eco = rc / ob;
    if (eco < 5) pts += 6; else if (eco < 6) pts += 4; else if (eco <= 7) pts += 2;
    else if (eco >= 12) pts -= 6; else if (eco >= 11) pts -= 4; else if (eco >= 10) pts -= 2;
  }

  // Fielding
  pts += (p.catches || 0) * 8 + (p.stumpings || 0) * 12 +
         (p.ro_direct || 0) * 12 + (p.ro_indirect || 0) * 6;

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

// ─── Match ───────────────────────────────────────────────────────────────────
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

// ─── Players ─────────────────────────────────────────────────────────────────
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
  const {
    name, cric_team, role,
    runs, balls_faced, fours, sixes, duck,
    wickets, overs_bowled, runs_conceded, maidens,
    catches, stumpings, ro_direct, ro_indirect, manual_points
  } = req.body;

  const { rows } = await pool.query(
    `UPDATE players SET
      name=$1, cric_team=$2, role=$3,
      runs=$4, balls_faced=$5, fours=$6, sixes=$7, duck=$8,
      wickets=$9, overs_bowled=$10, runs_conceded=$11, maidens=$12,
      catches=$13, stumpings=$14, ro_direct=$15, ro_indirect=$16,
      manual_points=$17
     WHERE id=$18 RETURNING *`,
    [
      name, cric_team, role,
      runs||0, balls_faced||0, fours||0, sixes||0, !!duck,
      wickets||0, overs_bowled||0, runs_conceded||0, maidens||0,
      catches||0, stumpings||0, ro_direct||0, ro_indirect||0,
      manual_points ?? null,
      id
    ]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json({ ...rows[0], fantasy_points: calcPoints(rows[0]) });
});

app.delete("/api/players/:id", adminOnly, async (req, res) => {
  await pool.query("DELETE FROM players WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

// ─── Contest Teams ────────────────────────────────────────────────────────────
app.get("/api/teams", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM contest_teams ORDER BY registered_at");
  res.json(rows);
});

app.get("/api/teams/count", async (req, res) => {
  const settings = await pool.query("SELECT max_entries FROM contest_settings WHERE id=1");
  const count = await pool.query("SELECT COUNT(*) FROM contest_teams");
  res.json({ count: parseInt(count.rows[0].count), max: settings.rows[0]?.max_entries || 50 });
});

app.post("/api/teams", async (req, res) => {
  const { owner_name, player_ids, captain_id, vc_id } = req.body;

  // CHECK MATCH STATUS FIRST — block if live or completed
  const { rows: matchRows } = await pool.query("SELECT status FROM match_info ORDER BY id LIMIT 1");
  const matchStatus = matchRows[0]?.status || "upcoming";
  if (matchStatus === "live" || matchStatus === "completed") {
    return res.status(409).json({ error: `Cannot register: match is ${matchStatus}` });
  }

  // Validate
  if (!owner_name?.trim()) return res.status(400).json({ error: "owner_name required" });
  if (!Array.isArray(player_ids) || player_ids.length !== 11)
    return res.status(400).json({ error: "Exactly 11 players required" });
  if (!captain_id || !vc_id) return res.status(400).json({ error: "captain_id and vc_id required" });
  if (!player_ids.includes(parseInt(captain_id)) || !player_ids.includes(parseInt(vc_id)))
    return res.status(400).json({ error: "Captain/VC must be in player_ids" });

  // Check capacity
  const settings = await pool.query("SELECT max_entries FROM contest_settings WHERE id=1");
  const count = await pool.query("SELECT COUNT(*) FROM contest_teams");
  const max = settings.rows[0]?.max_entries || 50;
  if (parseInt(count.rows[0].count) >= max)
    return res.status(409).json({ error: `Contest full (${max} max entries)` });

  const { rows } = await pool.query(
    `INSERT INTO contest_teams (owner_name, player_ids, captain_id, vc_id)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (owner_name) DO UPDATE
       SET player_ids   = EXCLUDED.player_ids,
           captain_id   = EXCLUDED.captain_id,
           vc_id        = EXCLUDED.vc_id,
           registered_at = NOW()
     RETURNING *, (xmax <> 0) AS updated`,
    [owner_name.trim(), player_ids.map(Number), parseInt(captain_id), parseInt(vc_id)]
  );
  const wasUpdate = rows[0].updated;
  res.status(wasUpdate ? 200 : 201).json({ ...rows[0], updated: wasUpdate });
});

app.delete("/api/teams/:id", adminOnly, async (req, res) => {
  await pool.query("DELETE FROM contest_teams WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────
app.get("/api/leaderboard", async (req, res) => {
  const [{ rows: players }, { rows: teams }] = await Promise.all([
    pool.query("SELECT * FROM players"),
    pool.query("SELECT * FROM contest_teams"),
  ]);

  const ptsMap = {};
  for (const p of players) ptsMap[p.id] = calcPoints(p);

  const ranked = teams
    .map(t => ({
      ...t,
      total: teamTotal(t, ptsMap),
      captain_name: players.find(p => p.id === t.captain_id)?.name || "?",
      vc_name: players.find(p => p.id === t.vc_id)?.name || "?",
    }))
    .sort((a, b) => b.total - a.total)
    .map((t, i) => ({ ...t, rank: i + 1 }));

  res.json(ranked);
});

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get("/api/settings", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM contest_settings WHERE id=1");
  res.json(rows[0] || { max_entries: 50 });
});

app.put("/api/settings", adminOnly, async (req, res) => {
  const { max_entries } = req.body;
  const capped = Math.min(Math.max(10, parseInt(max_entries) || 50), 100);
  await pool.query(
    "UPDATE contest_settings SET max_entries=$1, updated_at=NOW() WHERE id=1",
    [capped]
  );
  res.json({ max_entries: capped });
});

// ─── Match Reset (new game) ───────────────────────────────────────────────────
// Wipes squad, contest teams and resets match back to 'upcoming' with 0 innings loaded.
app.post("/api/match/reset", adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM contest_teams");
    await pool.query("DELETE FROM players");
    await pool.query(`
      UPDATE match_info SET
        name=$1, team_a=$2, team_b=$3,
        match_date=CURRENT_DATE, venue=$4, overs=$5,
        status='upcoming', innings_loaded=0,
        result='', team_a_score='', team_b_score=''
      WHERE id=1
    `, [
      req.body.name  || "New Match",
      req.body.team_a || "Team A",
      req.body.team_b || "Team B",
      req.body.venue  || "",
      parseInt(req.body.overs) || 10,
    ]);
    res.json({ ok: true, message: "Match reset — squad and contest teams cleared." });
  } catch (e) {
    console.error("Reset error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Squad Upload (players only, no stats) ────────────────────────────────────
// POST /api/squad/upload  — loads up to 30 players (15 per team) from CSV/JSON template.
app.post("/api/squad/upload", adminOnly, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const filePath = req.file.path;
  try {
    const ext = req.file.originalname.split(".").pop().toLowerCase();
    const content = fs.readFileSync(filePath, "utf-8");
    let players = [];

    if (ext === "json") {
      const data = JSON.parse(content);
      const team1 = data.team1 || {};
      const team2 = data.team2 || {};
      const t1name = team1.name || "Team A";
      const t2name = team2.name || "Team B";
      (team1.players || []).slice(0, 15).forEach(p =>
        players.push({ name: p.name || p, cric_team: t1name, role: p.role || "BAT" }));
      (team2.players || []).slice(0, 15).forEach(p =>
        players.push({ name: p.name || p, cric_team: t2name, role: p.role || "BAT" }));
    } else if (ext === "csv") {
      // Strip BOM, normalise line endings
      const lines = content
        .replace(/^﻿/, "")          // remove BOM if present
        .replace(/\r\n/g, "\n")          // Windows → Unix line endings
        .replace(/\r/g, "\n")            // old Mac line endings
        .split("\n");

      const ROLES = ["BAT","BOWL","AR","WK"];

      // Pre-scan to detect format
      const hasTeamHeader       = lines.some(l => l.trim().split(",")[0].trim().toUpperCase() === "TEAM");
      const hasSquadHeader      = lines.some(l => l.trim().split(",")[0].trim().toUpperCase() === "SQUAD");
      const hasRoleCol          = lines.some(l => {
        const c = l.trim().split(",");
        return c[2] && ROLES.includes(c[2].trim().toUpperCase());
      });
      // Format 4: "TEAM A — TeamName" style — whole line IS the team name, starts with "TEAM "
      const hasTeamPrefixHeader = lines.some(l => {
        const c0 = l.trim().split(",")[0].trim();
        return c0.toUpperCase().startsWith("TEAM ") && c0.length > 5;
      });
      // Format 5: blank-line-separated blocks (no TEAM keyword at all)
      const useBlankSep = !hasTeamHeader && !hasSquadHeader && !hasRoleCol && !hasTeamPrefixHeader;

      let currentTeam  = "";
      const teamCounts = {};
      let prevWasBlank = true; // treat file-start as "after blank"

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          prevWasBlank = true;
          continue;
        }

        const cols   = trimmed.split(",").map(c => c.trim());
        const c0     = cols[0] || "";
        const c0up   = c0.toUpperCase();
        const c1up   = (cols[1] || "").toUpperCase();
        const c2up   = (cols[2] || "").toUpperCase();

        // ── Format 4: blank-line-separated blocks ─────────────────────────────
        if (useBlankSep) {
          if (prevWasBlank) {
            // First non-blank after blank/start → team name
            currentTeam = c0;
            if (!(currentTeam in teamCounts)) teamCounts[currentTeam] = 0;
          } else {
            // Player line
            if (c0 && currentTeam && (teamCounts[currentTeam] || 0) < 15) {
              players.push({ name: c0, cric_team: currentTeam, role: "BAT" });
              teamCounts[currentTeam]++;
            }
          }
          prevWasBlank = false;
          continue;
        }

        prevWasBlank = false;

        // Skip common header rows
        if (["player","name","batsman","bowler"].includes(c0.toLowerCase())) continue;

        // ── Format 1: TEAM,TeamName header ────────────────────────────────────
        if (c0up === "TEAM") {
          currentTeam = cols[1] || "";
          if (currentTeam && !(currentTeam in teamCounts)) teamCounts[currentTeam] = 0;
          continue;
        }

        // ── Format 2: SQUAD,TeamName,PlayerName ───────────────────────────────
        if (c0up === "SQUAD") {
          const sqTeam = cols[1] || ""; const sqPlayer = cols[2] || "";
          if (!sqTeam || !sqPlayer || sqTeam === "Team" || sqPlayer === "Player") continue;
          if (!(sqTeam in teamCounts)) teamCounts[sqTeam] = 0;
          if (teamCounts[sqTeam] < 15) {
            players.push({ name: sqPlayer.trim(), cric_team: sqTeam, role: "BAT" });
            teamCounts[sqTeam]++;
          }
          continue;
        }

        // ── Format 3: PlayerName,TeamName,Role ────────────────────────────────
        if (cols[2] && ROLES.includes(c2up)) {
          const fTeam = cols[1] || currentTeam;
          if (!fTeam) continue;
          if (!(fTeam in teamCounts)) teamCounts[fTeam] = 0;
          if (teamCounts[fTeam] < 15) {
            players.push({ name: c0, cric_team: fTeam, role: c2up });
            teamCounts[fTeam]++;
          }
          continue;
        }

        // ── Format 4: "TEAM X — TeamName" — whole line is team name ──────────
        if (c0.toUpperCase().startsWith("TEAM ") && c0.length > 5) {
          currentTeam = c0;
          if (!(currentTeam in teamCounts)) teamCounts[currentTeam] = 0;
          prevWasBlank = false;
          continue;
        }

        // ── Format 1 fallback: PlayerName,Role — under a TEAM header ──────────
        const role = ROLES.includes(c1up) ? c1up : "BAT";
        if (!c0 || !currentTeam) continue;
        if ((teamCounts[currentTeam] || 0) < 15) {
          players.push({ name: c0, cric_team: currentTeam, role });
          teamCounts[currentTeam] = (teamCounts[currentTeam] || 0) + 1;
        }
      }
      console.log("[squad-upload] format:", useBlankSep ? "blank-sep" : "header", "| teams:", JSON.stringify(teamCounts));
    } else {
      return res.status(400).json({ error: "Use CSV or JSON" });
    }

    if (players.length === 0) return res.status(400).json({ error: "No players found in file" });
    if (players.length > 30)  players = players.slice(0, 30);

    // Insert players (clear existing first)
    await pool.query("DELETE FROM players");
    const inserted = [];
    for (const p of players) {
      const { rows } = await pool.query(
        "INSERT INTO players (name, cric_team, role) VALUES ($1,$2,$3) RETURNING *",
        [p.name.trim(), p.cric_team, p.role]
      );
      inserted.push(rows[0]);
    }
    res.json({ ok: true, created: inserted.length, skipped: 0, players_loaded: inserted.length, players: inserted });
  } catch (e) {
    console.error("Squad upload error:", e);
    res.status(500).json({ error: e.message });
  } finally {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
});

// ─── Clear all players ─────────────────────────────────────────────────────────
app.delete("/api/players", adminOnly, async (req, res) => {
  await pool.query("DELETE FROM players");
  res.json({ ok: true });
});

// ─── Bulk Match Upload ────────────────────────────────────────────────────────
app.post("/api/match/bulk-upload", adminOnly, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const filePath = req.file.path;

  try {
    const ext = req.file.originalname.split(".").pop().toLowerCase();
    const content = fs.readFileSync(filePath, "utf-8");
    let matchData = {};

    if (ext === "json") {
      matchData = JSON.parse(content);
    } else if (ext === "csv") {
      matchData = await parseCSVViaPython(content);
    } else {
      return res.status(400).json({ error: "Unsupported file type. Use CSV or JSON." });
    }

    // Determine which inning this file represents (1 or 2).
    // The template embeds "INNING,1" or "INNING,2" in MATCH SUMMARY; fallback to query param.
    const inningNum = parseInt(
      matchData.match_summary?.inning ||
      req.query.inning ||
      req.body?.inning ||
      "1"
    , 10) || 1;
    const isSecondInnings = inningNum === 2;

    // Validate structure
    const validation = validateMatchData(matchData);
    if (!validation.valid) {
      return res.status(400).json({ error: "Validation failed", details: validation.errors });
    }

    const { rows: players } = await pool.query("SELECT * FROM players");

    // 1. Update match info
    if (matchData.match_summary) {
      const s = matchData.match_summary;
      // 1st innings → live; 2nd innings → completed
      const newStatus = isSecondInnings ? "completed" : "live";
      const newInningsLoaded = isSecondInnings ? 2 : 1;
      const resultStr = s.winner
        ? `${s.winner} won${s.win_margin ? " by " + s.win_margin : ""}`
        : "";
      await pool.query(
        `UPDATE match_info SET
           name=$1, team_a=$2, team_b=$3,
           match_date=$4, venue=$5, overs=$6,
           status=$7, innings_loaded=$8,
           result=$9, team_a_score=$10, team_b_score=$11
         WHERE id=1`,
        [
          s.match || "",
          s.team1_name || "",
          s.team2_name || "",
          s.date || new Date(),
          s.ground || "",
          parseInt(s.overs) || 10,
          newStatus,
          newInningsLoaded,
          resultStr,
          s.team1_score || "",
          s.team2_score || "",
        ]
      );
    }

    let playersCreated = 0;
    let statsUpdated = 0;

    // 2. Auto-create any squad players not yet in DB
    if (matchData.squads) {
      const allSquad = [
        ...(matchData.squads.team1?.players || []),
        ...(matchData.squads.team2?.players || []),
      ].slice(0, 30);
  
      for (const playerName of allSquad) {
        const exists = fuzzyFindPlayer(players, playerName);
        if (!exists) {
          const team = (matchData.squads.team1?.players || []).includes(playerName)
            ? matchData.match_summary?.team1_name || ""
            : matchData.match_summary?.team2_name || "";
          await pool.query(
            `INSERT INTO players (name, cric_team, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [playerName.trim(), team, "BAT"]
          );
          playersCreated++;
          players.push({ name: playerName, id: null });
        }
      }
    }

    // Re-fetch to include newly created players
    const { rows: allPlayers } = await pool.query("SELECT * FROM players");

    // 3. Apply innings stats
    // inning=1 → SET (overwrite);  inning=2 → ADD (accumulate on top of 1st innings)
    if (matchData.innings) {
      const stats = {};
      // Track which team each CSV player belongs to for duplicate-name disambiguation
      const playerTeam = {};
      const innKey = isSecondInnings ? "second_innings" : "first_innings";
      // Batting team: team that bats 1st in 1st innings, team that bats 2nd in 2nd innings
      const battingTeamHint = isSecondInnings
        ? (matchData.match_summary?.team2_name || matchData.match_summary?.team_b || "")
        : (matchData.match_summary?.team1_name || matchData.match_summary?.team_a || "");
      const bowlingTeamHint = isSecondInnings
        ? (matchData.match_summary?.team1_name || matchData.match_summary?.team_a || "")
        : (matchData.match_summary?.team2_name || matchData.match_summary?.team_b || "");

      for (const bat of matchData.innings[innKey]?.batting || []) {
        const name = bat.batsman; if (!name) continue;
        if (!stats[name]) stats[name] = { runs:0,balls:0,fours:0,sixes:0,duck:false,wickets:0,overs:0,runs_conceded:0,maidens:0 };
        playerTeam[name] = playerTeam[name] || battingTeamHint;
        stats[name].runs  += bat.runs  || 0;
        stats[name].balls += bat.balls || 0;
        stats[name].fours += bat.fours || 0;
        stats[name].sixes += bat.sixes || 0;
        // Duck = dismissed for 0; exclude all non-dismissal statuses
        const st = (bat.status || "").toLowerCase();
        const notDismissed = ["not out","dnb","did not bat","absent","retired","did not field"].some(x => st.includes(x));
        if ((bat.runs || 0) === 0 && st && !notDismissed) {
          stats[name].duck = true;
        }
      }
      for (const bowl of matchData.innings[innKey]?.bowling || []) {
        const name = bowl.bowler; if (!name) continue;
        if (!stats[name]) stats[name] = { runs:0,balls:0,fours:0,sixes:0,duck:false,wickets:0,overs:0,runs_conceded:0,maidens:0 };
        playerTeam[name] = playerTeam[name] || bowlingTeamHint;
        stats[name].wickets       += bowl.wickets || 0;
        // Convert cricket notation overs (2.4 = 2 overs 4 balls) to real decimal overs
        stats[name].overs         += parseCricketOvers(bowl.overs);
        stats[name].runs_conceded += bowl.runs     || 0;
        stats[name].maidens       += bowl.maidens  || 0;
      }

      for (const [playerName, ps] of Object.entries(stats)) {
        const dbPlayer = fuzzyFindPlayer(allPlayers, playerName, playerTeam[playerName]);
        if (!dbPlayer) {
          console.warn(`[bulk-upload] No DB match for CSV player: "${playerName}" — skipping`);
          continue;
        }

        if (isSecondInnings) {
          // Accumulate — add 2nd innings on top of whatever 1st innings stored
          await pool.query(
            `UPDATE players SET
               runs          = runs + $1,
               balls_faced   = balls_faced + $2,
               fours         = fours + $3,
               sixes         = sixes + $4,
               duck          = duck OR $5,
               wickets       = wickets + $6,
               overs_bowled  = overs_bowled + $7,
               runs_conceded = runs_conceded + $8,
               maidens       = maidens + $9,
               did_not_play  = FALSE
             WHERE id=$10`,
            [ps.runs,ps.balls,ps.fours,ps.sixes,ps.duck,ps.wickets,ps.overs,ps.runs_conceded,ps.maidens,dbPlayer.id]
          );
        } else {
          // Overwrite — fresh 1st innings data
          await pool.query(
            `UPDATE players SET
               runs=$1,balls_faced=$2,fours=$3,sixes=$4,duck=$5,
               wickets=$6,overs_bowled=$7,runs_conceded=$8,maidens=$9,
               did_not_play=FALSE
             WHERE id=$10`,
            [ps.runs,ps.balls,ps.fours,ps.sixes,ps.duck,ps.wickets,ps.overs,ps.runs_conceded,ps.maidens,dbPlayer.id]
          );
        }
        statsUpdated++;
      }

      // Mark players absent from this innings file as did_not_play
      // Use fuzzy matching so "(C)" markers / truncated CSV names don't cause false absences
      if (!isSecondInnings) {
        const matchedDbIds = new Set();
        for (const csvName of Object.keys(stats)) {
          const dbP = fuzzyFindPlayer(allPlayers, csvName, playerTeam[csvName]);
          if (dbP) matchedDbIds.add(dbP.id);
        }
        for (const p of allPlayers) {
          if (!matchedDbIds.has(p.id)) {
            await pool.query("UPDATE players SET did_not_play=TRUE WHERE id=$1", [p.id]);
          }
        }
      }
    }

    res.json({
      success: true,
      inning: inningNum,
      match_status: isSecondInnings ? "completed" : "live",
      source: "bulk_upload",
      validation: validation.summary,
      players_created: playersCreated,
      stats_updated: statsUpdated,
      file: req.file.originalname,
    });

  } catch (e) {
    console.error("Bulk upload error:", e);
    res.status(500).json({ error: `Processing failed: ${e.message}` });
  } finally {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
});

// ─── Bulk Upload Helpers ──────────────────────────────────────────────────────
function validateMatchData(data) {
  const errors = [];
  const warnings = [];
  if (!data.match_summary?.match) errors.push("Missing match name");
  if (!data.match_summary?.team1_name) errors.push("Missing Team 1");
  if (!data.match_summary?.team2_name) errors.push("Missing Team 2");
  if (!data.squads?.team1?.players?.length) warnings.push("No Team 1 squad");
  if (!data.squads?.team2?.players?.length) warnings.push("No Team 2 squad");
  if (!data.innings?.first_innings?.batting?.length &&
      !data.innings?.second_innings?.batting?.length) warnings.push("No batting data found");
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      match: data.match_summary?.match || "",
      squad_size:
        (data.squads?.team1?.players?.length || 0) +
        (data.squads?.team2?.players?.length || 0),
      batting_records:
        (data.innings?.first_innings?.batting?.length || 0) +
        (data.innings?.second_innings?.batting?.length || 0),
      bowling_records:
        (data.innings?.first_innings?.bowling?.length || 0) +
        (data.innings?.second_innings?.bowling?.length || 0),
    },
  };
}

// ─── Cricket overs converter ─────────────────────────────────────────────────
// Cricket notation: 2.4 means 2 overs + 4 balls, NOT the decimal 2.4.
// Convert to real decimal overs so economy = runs / realOvers is accurate.
function parseCricketOvers(raw) {
  const f = parseFloat(raw) || 0;
  const whole = Math.floor(f);
  const ballPart = Math.round((f - whole) * 10); // e.g. 2.4 → ballPart = 4
  if (ballPart === 0) return whole;              // clean overs, no conversion needed
  if (ballPart >= 6) return f;                   // already a decimal, not cricket notation
  return Math.round((whole + ballPart / 6) * 1000) / 1000; // 2.4 → 2.667
}

// ─── Fuzzy player name matcher ────────────────────────────────────────────────
// Handles: case differences, "(C)"/"(VC)" captain markers, Excel truncation,
// parenthetical nicknames, and same-name players on different teams.
// teamHint (optional): cric_team string to disambiguate duplicate names.
function fuzzyFindPlayer(allPlayers, csvName, teamHint) {
  const clean = s => s.replace(/\s*\(C\)\s*|\s*\(VC\)\s*/gi, "").replace(/\s+/g," ").trim().toLowerCase();
  const needle = clean(csvName);
  const teamClean = (teamHint || "").trim().toLowerCase();

  // Score a candidate: higher = better team match
  const teamScore = p => {
    if (!teamClean || !p.cric_team) return 0;
    const pt = p.cric_team.trim().toLowerCase();
    if (pt === teamClean) return 2;
    if (pt.includes(teamClean) || teamClean.includes(pt)) return 1;
    return 0;
  };

  // Run a name-match pass; if multiple results, rank by team score
  const best = (candidates) => {
    if (!candidates.length) return undefined;
    if (candidates.length === 1) return candidates[0];
    // Prefer the one whose team best matches the hint
    const ranked = [...candidates].sort((a,b) => teamScore(b) - teamScore(a));
    if (teamScore(ranked[0]) > teamScore(ranked[1])) return ranked[0]; // clear winner
    // True ambiguity — warn and return first
    console.warn(`[fuzzyMatch] Ambiguous name "${csvName}" — matched ${candidates.map(p=>p.name+"("+p.cric_team+")").join(", ")}. Using first.`);
    return ranked[0];
  };

  // 1. Exact match (case-insensitive, markers stripped)
  let hits = allPlayers.filter(p => clean(p.name) === needle);
  if (hits.length) return best(hits);

  // 2. DB name starts-with CSV name (Excel truncation: "3AM (Prut" → "3am (pruthvi…)")
  hits = allPlayers.filter(p => clean(p.name).startsWith(needle));
  if (hits.length) return best(hits);

  // 3. CSV name starts-with DB name (reverse truncation)
  hits = allPlayers.filter(p => needle.startsWith(clean(p.name)));
  if (hits.length) return best(hits);

  // 4. First-word fallback (≥4 chars to avoid false matches like "Ali")
  const firstWord = needle.split(/\s+/)[0];
  if (firstWord.length >= 4) {
    hits = allPlayers.filter(p => clean(p.name).startsWith(firstWord));
    if (hits.length) return best(hits);
  }

  return undefined;
}

// ─── JS CSV parser (primary) — no OCR service needed ─────────────────────────
function parseCSVDirectly(csvContent) {
  const lines = csvContent.split("\n");
  const result = {
    match_summary: {},
    squads: { team1: { players: [] }, team2: { players: [] } },
    innings: {
      first_innings:  { batting: [], bowling: [] },
      second_innings: { batting: [], bowling: [] },
    },
    fall_of_wickets: { first_innings: [], second_innings: [] },
    match_officials: {},
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    // Split on comma, respect up to 7 columns
    const cols = line.split(",").map(c => c.trim());
    const sec = cols[0];

    // ── MATCH SUMMARY ─────────────────────────────────────────────────────
    if (sec === "MATCH SUMMARY") {
      const field = cols[1] || "";
      const val   = cols[2] || "";
      if (!field) continue;
      let key = field.toLowerCase().replace(/ /g, "_");
      key = key.replace(/^team_1_/, "team1_").replace(/^team_2_/, "team2_");
      result.match_summary[key] = val;
      continue;
    }

    // ── SQUAD ─────────────────────────────────────────────────────────────
    if (sec === "SQUAD") {
      const team = cols[1]; const player = cols[2];
      if (!team || !player || team === "Team" || player === "Player") continue;
      const t1name = result.squads.team1.team_name;
      if (!t1name) {
        result.squads.team1.team_name = team;
        result.squads.team1.players.push(player);
      } else if (team === t1name) {
        result.squads.team1.players.push(player);
      } else {
        if (!result.squads.team2.team_name) result.squads.team2.team_name = team;
        result.squads.team2.players.push(player);
      }
      continue;
    }

    // ── INNINGS BAT    // ── INNINGS BATTING ───────────────────────────────────────────────────
    const is1stBat  = sec.includes("1ST INNINGS") && sec.includes("BATTING");
    const is2ndBat  = sec.includes("2ND INNINGS") && sec.includes("BATTING");
    const is1stBowl = sec.includes("1ST INNINGS") && sec.includes("BOWLING");
    const is2ndBowl = sec.includes("2ND INNINGS") && sec.includes("BOWLING");

    if (is1stBat || is2ndBat) {
      const inKey = is1stBat ? "first_innings" : "second_innings";
      const batsman = cols[1];
      if (!batsman || ["Batsman","Total","Extras",""].includes(batsman)) continue;
      const toInt = s => { const n = parseInt(s); return isNaN(n) ? 0 : n; };
      result.innings[inKey].batting.push({
        batsman, status: cols[2] || "",
        runs: toInt(cols[3]), balls: toInt(cols[4]),
        fours: toInt(cols[5]), sixes: toInt(cols[6]),
      });
      continue;
    }

    if (is1stBowl || is2ndBowl) {
      const inKey = is1stBowl ? "first_innings" : "second_innings";
      const bowler = cols[1];
      if (!bowler || ["Bowler",""].includes(bowler)) continue;
      const toInt = s => { const n = parseInt(s); return isNaN(n) ? 0 : n; };
      result.innings[inKey].bowling.push({
        bowler, overs: parseCricketOvers(cols[2]),
        runs: toInt(cols[3]), wickets: toInt(cols[4]), maidens: toInt(cols[5]),
      });
      continue;
    }
  }
  return result;
}

async function parseCSVViaPython(csvContent) {
  // Try OCR service first (richer parsing), fall back to JS parser
  try {
    const form = new FormData();
    form.append("csv_data", csvContent);
    const ocrUrl = process.env.OCR_SERVICE_URL || "http://ocr-service:5000";
    const r = await fetch(`${ocrUrl}/api/csv/parse`, {
      method: "POST",
      headers: { "x-admin-key": process.env.ADMIN_SECRET || "ch11-admin-2026", ...form.getHeaders() },
      body: form,
    });
    if (r.ok) {
      const parsed = await r.json();
      if (parsed.match_summary?.match) return parsed;
    }
    throw new Er