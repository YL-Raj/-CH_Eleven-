// Copyright (c) 2026 RAJ.Y — All rights reserved.
// CH_Eleven Fantasy Cricket Platform
// https://github.com/RAJ-Y/ch-eleven
// CH_Eleven Backend — Express + PostgreSQL

const express  = require("express");
const { Pool } = require("pg");
const cors     = require("cors");
const multer   = require("multer");
const fs       = require("fs");
const FormData = require("form-data");
const path     = require("path");

const app = express();
app.use(express.json());
app.use(cors());
const templateDir = fs.existsSync(path.join(__dirname, "templates"))
  ? path.join(__dirname, "templates")       // Railway: /app/templates
  : path.join(__dirname, "../templates");   // local docker: backend/../templates
app.use("/templates", express.static(templateDir));

const upload = multer({ dest: "/tmp/uploads", limits: { fileSize: 50 * 1024 * 1024 } });

const pool         = new Pool({ connectionString: process.env.DATABASE_URL });
const MAX_ENTRIES  = parseInt(process.env.MAX_ENTRIES || "100", 10);
const ADMIN_SECRET = process.env.ADMIN_SECRET || "ch11-admin-2026";

// Health — instant 200, no DB (Railway + docker healthcheck)
app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Admin key verification — lets frontend confirm key is correct before showing panel
app.get("/api/admin/ping", adminOnly, (req, res) => res.json({ ok: true }));

// ── Startup: schema init + migrations ────────────────────────────────────────
(async () => {
  // Step 1: run schema.sql — critical for Railway fresh deploys (no init script)
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    if (fs.existsSync(schemaPath)) {
      const stmts = fs.readFileSync(schemaPath, "utf8")
        .split(";").map(s => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        try { await pool.query(stmt); } catch (_) {}
      }
      console.log("Schema init OK");
    }
  } catch (e) { console.warn("Schema init skip:", e.message); }

  // Step 2: column migrations (idempotent)
  const migrations = [
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS innings_loaded INTEGER DEFAULT 0`,
    `ALTER TABLE players    ADD COLUMN IF NOT EXISTS did_not_play  BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS result        TEXT DEFAULT ''`,
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS team_a_score  TEXT DEFAULT ''`,
    `ALTER TABLE match_info ADD COLUMN IF NOT EXISTS team_b_score  TEXT DEFAULT ''`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='unique_owner_name' AND conrelid='contest_teams'::regclass) THEN ALTER TABLE contest_teams ADD CONSTRAINT unique_owner_name UNIQUE (owner_name); END IF; END $$`,
  ];
  let ok = 0;
  for (const sql of migrations) {
    try { await pool.query(sql); ok++; } catch (e) { console.warn("Migration skip:", sql.slice(0,60)); }
  }
  console.log(`DB migrations OK (${ok}/${migrations.length})`);
})();

// ── Auth ─────────────────────────────────────────────────────────────────────
function adminOnly(req, res, next) {
  if (req.headers["x-admin-key"] !== ADMIN_SECRET) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ── Scoring ───────────────────────────────────────────────────────────────────
function calcPoints(p) {
  if (p.manual_points !== null && p.manual_points !== undefined) return parseFloat(p.manual_points);
  let pts = 0;
  const r = p.runs||0, bf = parseFloat(p.balls_faced)||0, w = p.wickets||0;
  const ob = parseFloat(p.overs_bowled)||0, rc = p.runs_conceded||0;
  pts += r + (p.fours||0) + (p.sixes||0)*2;
  if (r>=100) pts+=16; else if (r>=50) pts+=8;
  if (p.duck) pts-=2;
  if (bf>=10) { const sr=(r/bf)*100; if(sr<50)pts-=6; else if(sr<60)pts-=4; else if(sr<70)pts-=2; else if(sr>=150)pts+=4; else if(sr>=130)pts+=2; else if(sr>=120)pts+=1; }
  pts += w*25;
  if (w>=5) pts+=16; else if(w>=4) pts+=8; else if(w>=3) pts+=4;
  pts += (p.maidens||0)*8;
  if (ob>=2) { const eco=rc/ob; if(eco<5)pts+=6; else if(eco<6)pts+=4; else if(eco<=7)pts+=2; else if(eco>=12)pts-=6; else if(eco>=11)pts-=4; else if(eco>=10)pts-=2; }
  pts += (p.catches||0)*8 + (p.stumpings||0)*12 + (p.ro_direct||0)*12 + (p.ro_indirect||0)*6;
  return Math.round(pts*10)/10;
}

function teamTotal(team, ptsMap) {
  let total = 0;
  for (const pid of team.player_ids) {
    const pp = ptsMap[pid]||0;
    total += pid===team.captain_id ? pp*2 : pid===team.vc_id ? pp*1.5 : pp;
  }
  return Math.round(total*10)/10;
}

// ── Match ─────────────────────────────────────────────────────────────────────
app.get("/api/match", async (req,res) => {
  try { const {rows}=await pool.query("SELECT * FROM match_info ORDER BY id LIMIT 1"); res.json(rows[0]||{}); }
  catch(e){ res.status(500).json({error:e.message}); }
});
app.put("/api/match", adminOnly, async (req,res) => {
  try {
    const {name,team_a,team_b,match_date,venue,overs,status}=req.body;
    const {rows}=await pool.query(
      `UPDATE match_info SET name=$1,team_a=$2,team_b=$3,match_date=$4,venue=$5,overs=$6,status=$7 WHERE id=1 RETURNING *`,
      [name,team_a,team_b,match_date,venue,overs,status]);
    res.json(rows[0]);
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ── Players ───────────────────────────────────────────────────────────────────
app.get("/api/players", async (req,res) => {
  try { const {rows}=await pool.query("SELECT * FROM players ORDER BY id"); res.json(rows.map(p=>({...p,fantasy_points:calcPoints(p)}))); }
  catch(e){ res.status(500).json({error:e.message}); }
});
app.post("/api/players", adminOnly, async (req,res) => {
  try {
    const {name,cric_team,role}=req.body;
    const {rows}=await pool.query("INSERT INTO players (name,cric_team,role) VALUES ($1,$2,$3) RETURNING *",[name,cric_team||"",role||"BAT"]);
    res.json({...rows[0],fantasy_points:calcPoints(rows[0])});
  } catch(e){ res.status(500).json({error:e.message}); }
});
app.put("/api/players/:id", adminOnly, async (req,res) => {
  try {
    const {id}=req.params;
    const {name,cric_team,role,runs,balls_faced,fours,sixes,duck,wickets,overs_bowled,runs_conceded,maidens,catches,stumpings,ro_direct,ro_indirect,manual_points}=req.body;
    const {rows}=await pool.query(
      `UPDATE players SET name=$1,cric_team=$2,role=$3,runs=$4,balls_faced=$5,fours=$6,sixes=$7,duck=$8,wickets=$9,overs_bowled=$10,runs_conceded=$11,maidens=$12,catches=$13,stumpings=$14,ro_direct=$15,ro_indirect=$16,manual_points=$17 WHERE id=$18 RETURNING *`,
      [name,cric_team,role,runs||0,balls_faced||0,fours||0,sixes||0,!!duck,wickets||0,overs_bowled||0,runs_conceded||0,maidens||0,catches||0,stumpings||0,ro_direct||0,ro_indirect||0,manual_points??null,id]);
    if (!rows[0]) return res.status(404).json({error:"Not found"});
    res.json({...rows[0],fantasy_points:calcPoints(rows[0])});
  } catch(e){ res.status(500).json({error:e.message}); }
});
app.delete("/api/players/:id", adminOnly, async (req,res) => {
  try { await pool.query("DELETE FROM players WHERE id=$1",[req.params.id]); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});
app.delete("/api/players", adminOnly, async (req,res) => {
  try { await pool.query("DELETE FROM players"); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

// ── Teams ─────────────────────────────────────────────────────────────────────
app.get("/api/teams", async (req,res) => {
  try { const {rows}=await pool.query("SELECT * FROM contest_teams ORDER BY registered_at"); res.json(rows); }
  catch(e){ res.status(500).json({error:e.message}); }
});
app.get("/api/teams/count", async (req,res) => {
  try {
    const settings=await pool.query("SELECT max_entries FROM contest_settings WHERE id=1");
    const count=await pool.query("SELECT COUNT(*) FROM contest_teams");
    res.json({count:parseInt(count.rows[0].count),max:settings.rows[0]?.max_entries||50});
  } catch(e){ res.status(500).json({error:e.message}); }
});
app.post("/api/teams", async (req,res) => {
  try {
    const {owner_name,player_ids,captain_id,vc_id}=req.body;
    const {rows:mRows}=await pool.query("SELECT status FROM match_info ORDER BY id LIMIT 1");
    const ms=mRows[0]?.status||"upcoming";
    if (ms==="live"||ms==="completed") return res.status(409).json({error:`Cannot register: match is ${ms}`});
    if (!owner_name?.trim()) return res.status(400).json({error:"owner_name required"});
    if (!Array.isArray(player_ids)||player_ids.length!==11) return res.status(400).json({error:"Exactly 11 players required"});
    if (!captain_id||!vc_id) return res.status(400).json({error:"captain_id and vc_id required"});
    if (!player_ids.includes(parseInt(captain_id))||!player_ids.includes(parseInt(vc_id))) return res.status(400).json({error:"Captain/VC must be in player_ids"});
    const settings=await pool.query("SELECT max_entries FROM contest_settings WHERE id=1");
    const count=await pool.query("SELECT COUNT(*) FROM contest_teams");
    const max=settings.rows[0]?.max_entries||50;
    if (parseInt(count.rows[0].count)>=max) return res.status(409).json({error:`Contest full (${max} max entries)`});
    const {rows}=await pool.query(
      `INSERT INTO contest_teams (owner_name,player_ids,captain_id,vc_id) VALUES ($1,$2,$3,$4)
       ON CONFLICT (owner_name) DO UPDATE SET player_ids=EXCLUDED.player_ids,captain_id=EXCLUDED.captain_id,vc_id=EXCLUDED.vc_id,registered_at=NOW()
       RETURNING *,(xmax<>0) AS updated`,
      [owner_name.trim(),player_ids.map(Number),parseInt(captain_id),parseInt(vc_id)]);
    res.status(rows[0].updated?200:201).json(rows[0]);
  } catch(e){ res.status(500).json({error:e.message}); }
});
app.delete("/api/teams/:id", adminOnly, async (req,res) => {
  try { await pool.query("DELETE FROM contest_teams WHERE id=$1",[req.params.id]); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

// ── Leaderboard ───────────────────────────────────────────────────────────────
app.get("/api/leaderboard", async (req,res) => {
  try {
    const [{rows:players},{rows:teams}]=await Promise.all([pool.query("SELECT * FROM players"),pool.query("SELECT * FROM contest_teams")]);
    const ptsMap={};
    for (const p of players) ptsMap[p.id]=calcPoints(p);
    const ranked=teams
      .map(t=>({...t,total:teamTotal(t,ptsMap),captain_name:players.find(p=>p.id===t.captain_id)?.name||"?",vc_name:players.find(p=>p.id===t.vc_id)?.name||"?"}))
      .sort((a,b)=>b.total-a.total).map((t,i)=>({...t,rank:i+1}));
    res.json(ranked);
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ── Settings ──────────────────────────────────────────────────────────────────
app.get("/api/settings", async (req,res) => {
  try { const {rows}=await pool.query("SELECT * FROM contest_settings WHERE id=1"); res.json(rows[0]||{max_entries:50}); }
  catch(e){ res.status(500).json({error:e.message}); }
});
app.put("/api/settings", adminOnly, async (req,res) => {
  try {
    const capped=Math.min(Math.max(10,parseInt(req.body.max_entries)||50),100);
    await pool.query("UPDATE contest_settings SET max_entries=$1,updated_at=NOW() WHERE id=1",[capped]);
    res.json({max_entries:capped});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ── Match Reset ───────────────────────────────────────────────────────────────
app.post("/api/match/reset", adminOnly, async (req,res) => {
  try {
    await pool.query("DELETE FROM contest_teams");
    await pool.query("DELETE FROM players");
    await pool.query(
      `UPDATE match_info SET name=$1,team_a=$2,team_b=$3,match_date=CURRENT_DATE,venue=$4,overs=$5,status='upcoming',innings_loaded=0,result='',team_a_score='',team_b_score='' WHERE id=1`,
      [req.body.name||"New Match",req.body.team_a||"Team A",req.body.team_b||"Team B",req.body.venue||"",parseInt(req.body.overs)||10]);
    res.json({ok:true,message:"Match reset complete."});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ── Squad Upload ──────────────────────────────────────────────────────────────
app.post("/api/squad/upload", adminOnly, upload.single("file"), async (req,res) => {
  if (!req.file) return res.status(400).json({error:"No file uploaded"});
  const filePath=req.file.path;
  try {
    const ext=req.file.originalname.split(".").pop().toLowerCase();
    const content=fs.readFileSync(filePath,"utf-8");
    let players=[];

    if (ext==="json") {
      const data=JSON.parse(content);
      const t1=data.team1||{}, t2=data.team2||{};
      (t1.players||[]).slice(0,15).forEach(p=>players.push({name:p.name||p,cric_team:t1.name||"Team A",role:p.role||"BAT"}));
      (t2.players||[]).slice(0,15).forEach(p=>players.push({name:p.name||p,cric_team:t2.name||"Team B",role:p.role||"BAT"}));
    } else if (ext==="csv") {
      const lines=content.replace(/^﻿/,"").replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
      const ROLES=["BAT","BOWL","AR","WK"];
      const hasTeamHdr  =lines.some(l=>l.trim().split(",")[0].trim().toUpperCase()==="TEAM");
      const hasSquadHdr =lines.some(l=>l.trim().split(",")[0].trim().toUpperCase()==="SQUAD");
      const hasRoleCol  =lines.some(l=>{const c=l.trim().split(",");return c[2]&&ROLES.includes(c[2].trim().toUpperCase());});
      const useBlankSep =!hasTeamHdr&&!hasSquadHdr&&!hasRoleCol;
      let cur=""; const tc={}; let prevBlank=true;
      for (const line of lines) {
        const t=line.trim();
        if (!t){prevBlank=true;continue;}
        const cols=t.split(",").map(c=>c.trim());
        const c0=cols[0]||"", c0u=c0.toUpperCase(), c1u=(cols[1]||"").toUpperCase(), c2u=(cols[2]||"").toUpperCase();
        if (useBlankSep){
          if (prevBlank){cur=c0;if(!(cur in tc))tc[cur]=0;}
          else if(c0&&cur&&(tc[cur]||0)<15){players.push({name:c0,cric_team:cur,role:"BAT"});tc[cur]++;}
          prevBlank=false;continue;
        }
        prevBlank=false;
        if(["player","name","batsman","bowler"].includes(c0.toLowerCase()))continue;
        if(c0u==="TEAM"){cur=cols[1]||"";if(cur&&!(cur in tc))tc[cur]=0;continue;}
        if(c0u==="SQUAD"){const sq=cols[1]||"",sp=cols[2]||"";if(!sq||!sp||sq==="Team"||sp==="Player")continue;if(!(sq in tc))tc[sq]=0;if(tc[sq]<15){players.push({name:sp.trim(),cric_team:sq,role:"BAT"});tc[sq]++;}continue;}
        if(cols[2]&&ROLES.includes(c2u)){const ft=cols[1]||cur;if(!ft)continue;if(!(ft in tc))tc[ft]=0;if(tc[ft]<15){players.push({name:c0,cric_team:ft,role:c2u});tc[ft]++;}continue;}
        const role=ROLES.includes(c1u)?c1u:"BAT";
        if(!c0||!cur)continue;
        if((tc[cur]||0)<15){players.push({name:c0,cric_team:cur,role});tc[cur]=(tc[cur]||0)+1;}
      }
    } else { return res.status(400).json({error:"Use CSV or JSON"}); }

    if (players.length===0) return res.status(400).json({error:"No players found in file"});
    if (players.length>30)  players=players.slice(0,30);
    await pool.query("DELETE FROM players");
    const inserted=[];
    for (const p of players) {
      const {rows}=await pool.query("INSERT INTO players (name,cric_team,role) VALUES ($1,$2,$3) RETURNING *",[p.name.trim(),p.cric_team,p.role]);
      inserted.push(rows[0]);
    }
    res.json({ok:true,created:inserted.length,players_loaded:inserted.length,players:inserted});
  } catch(e){ console.error("Squad upload error:",e); res.status(500).json({error:e.message}); }
  finally { try{fs.unlinkSync(filePath);}catch(_){} }
});

// ── Bulk Match Upload ─────────────────────────────────────────────────────────
app.post("/api/match/bulk-upload", adminOnly, upload.single("file"), async (req,res) => {
  if (!req.file) return res.status(400).json({error:"No file uploaded"});
  const filePath=req.file.path;
  try {
    const ext=req.file.originalname.split(".").pop().toLowerCase();
    const content=fs.readFileSync(filePath,"utf-8");
    let matchData=ext==="json"?JSON.parse(content):ext==="csv"?await parseCSVViaPython(content):null;
    if (!matchData) return res.status(400).json({error:"Use CSV or JSON"});

    const inningNum=parseInt(matchData.match_summary?.inning||req.query.inning||"1",10)||1;
    const is2nd=inningNum===2;
    const validation=validateMatchData(matchData);
    if (!validation.valid) return res.status(400).json({error:"Validation failed",details:validation.errors});

    const {rows:players}=await pool.query("SELECT * FROM players");

    if (matchData.match_summary) {
      const s=matchData.match_summary;
      const resultStr=s.winner?`${s.winner} won${s.win_margin?" by "+s.win_margin:""}`:"";
      await pool.query(
        `UPDATE match_info SET name=$1,team_a=$2,team_b=$3,match_date=$4,venue=$5,overs=$6,status=$7,innings_loaded=$8,result=$9,team_a_score=$10,team_b_score=$11 WHERE id=1`,
        [s.match||"",s.team1_name||"",s.team2_name||"",s.date||new Date(),s.ground||"",parseInt(s.overs)||10,is2nd?"completed":"live",is2nd?2:1,resultStr,s.team1_score||"",s.team2_score||""]);
    }

    let playersCreated=0,statsUpdated=0;
    if (matchData.squads) {
      const allSquad=[...(matchData.squads.team1?.players||[]),...(matchData.squads.team2?.players||[])].slice(0,30);
      for (const pn of allSquad) {
        if (!fuzzyFindPlayer(players,pn)) {
          const team=(matchData.squads.team1?.players||[]).includes(pn)?matchData.match_summary?.team1_name||"":matchData.match_summary?.team2_name||"";
          await pool.query(`INSERT INTO players (name,cric_team,role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,[pn.trim(),team,"BAT"]);
          playersCreated++; players.push({name:pn,id:null});
        }
      }
    }

    const {rows:allPlayers}=await pool.query("SELECT * FROM players");
    if (matchData.innings) {
      const stats={},playerTeam={};
      const innKey=is2nd?"second_innings":"first_innings";
      const batHint=is2nd?matchData.match_summary?.team2_name||"":matchData.match_summary?.team1_name||"";
      const bowlHint=is2nd?matchData.match_summary?.team1_name||"":matchData.match_summary?.team2_name||"";
      for (const bat of matchData.innings[innKey]?.batting||[]) {
        const n=bat.batsman;if(!n)continue;
        if(!stats[n])stats[n]={runs:0,balls:0,fours:0,sixes:0,duck:false,wickets:0,overs:0,runs_conceded:0,maidens:0};
        playerTeam[n]=playerTeam[n]||batHint;
        stats[n].runs+=bat.runs||0;stats[n].balls+=bat.balls||0;stats[n].fours+=bat.fours||0;stats[n].sixes+=bat.sixes||0;
        const st=(bat.status||"").toLowerCase();
        if((bat.runs||0)===0&&st&&!["not out","dnb","did not bat","absent","retired","did not field"].some(x=>st.includes(x)))stats[n].duck=true;
      }
      for (const bowl of matchData.innings[innKey]?.bowling||[]) {
        const n=bowl.bowler;if(!n)continue;
        if(!stats[n])stats[n]={runs:0,balls:0,fours:0,sixes:0,duck:false,wickets:0,overs:0,runs_conceded:0,maidens:0};
        playerTeam[n]=playerTeam[n]||bowlHint;
        stats[n].wickets+=bowl.wickets||0;stats[n].overs+=parseCricketOvers(bowl.overs);stats[n].runs_conceded+=bowl.runs||0;stats[n].maidens+=bowl.maidens||0;
      }
      for (const [pn,ps] of Object.entries(stats)) {
        const dbP=fuzzyFindPlayer(allPlayers,pn,playerTeam[pn]);
        if(!dbP){console.warn(`[bulk] no match for "${pn}"`);continue;}
        if (is2nd) {
          await pool.query(`UPDATE players SET runs=runs+$1,balls_faced=balls_faced+$2,fours=fours+$3,sixes=sixes+$4,duck=duck OR $5,wickets=wickets+$6,overs_bowled=overs_bowled+$7,runs_conceded=runs_conceded+$8,maidens=maidens+$9,did_not_play=FALSE WHERE id=$10`,
            [ps.runs,ps.balls,ps.fours,ps.sixes,ps.duck,ps.wickets,ps.overs,ps.runs_conceded,ps.maidens,dbP.id]);
        } else {
          await pool.query(`UPDATE players SET runs=$1,balls_faced=$2,fours=$3,sixes=$4,duck=$5,wickets=$6,overs_bowled=$7,runs_conceded=$8,maidens=$9,did_not_play=FALSE WHERE id=$10`,
            [ps.runs,ps.balls,ps.fours,ps.sixes,ps.duck,ps.wickets,ps.overs,ps.runs_conceded,ps.maidens,dbP.id]);
        }
        statsUpdated++;
      }
      if (!is2nd) {
        const matched=new Set(Object.keys(stats).map(n=>{const d=fuzzyFindPlayer(allPlayers,n,playerTeam[n]);return d?.id;}).filter(Boolean));
        for (const p of allPlayers) if(!matched.has(p.id)) await pool.query("UPDATE players SET did_not_play=TRUE WHERE id=$1",[p.id]);
      }
    }

    res.json({success:true,inning:inningNum,match_status:is2nd?"completed":"live",players_created:playersCreated,stats_updated:statsUpdated,file:req.file.originalname,validation:validation.summary});
  } catch(e){ console.error("Bulk upload error:",e); res.status(500).json({error:`Processing failed: ${e.message}`}); }
  finally { try{fs.unlinkSync(filePath);}catch(_){} }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function validateMatchData(data) {
  const errors=[];
  if (!data.match_summary?.match)      errors.push("Missing match name");
  if (!data.match_summary?.team1_name) errors.push("Missing Team 1");
  if (!data.match_summary?.team2_name) errors.push("Missing Team 2");
  return {
    valid:errors.length===0, errors,
    summary:{
      match:data.match_summary?.match||"",
      squad_size:(data.squads?.team1?.players?.length||0)+(data.squads?.team2?.players?.length||0),
      batting_records:(data.innings?.first_innings?.batting?.length||0)+(data.innings?.second_innings?.batting?.length||0),
      bowling_records:(data.innings?.first_innings?.bowling?.length||0)+(data.innings?.second_innings?.bowling?.length||0),
    },
  };
}

function parseCricketOvers(raw) {
  const f=parseFloat(raw)||0, whole=Math.floor(f), bp=Math.round((f-whole)*10);
  if(bp===0)return whole; if(bp>=6)return f;
  return Math.round((whole+bp/6)*1000)/1000;
}

function fuzzyFindPlayer(all, csvName, teamHint) {
  const clean=s=>s.replace(/\s*\(C\)\s*|\s*\(VC\)\s*/gi,"").replace(/\s+/g," ").trim().toLowerCase();
  const needle=clean(csvName), tc=(teamHint||"").trim().toLowerCase();
  const tScore=p=>{ if(!tc||!p.cric_team)return 0; const pt=p.cric_team.trim().toLowerCase(); if(pt===tc)return 2; if(pt.includes(tc)||tc.includes(pt))return 1; return 0; };
  const best=arr=>{ if(!arr.length)return undefined; if(arr.length===1)return arr[0]; const r=[...arr].sort((a,b)=>tScore(b)-tScore(a)); return r[0]; };
  let hits=all.filter(p=>clean(p.name)===needle); if(hits.length)return best(hits);
  hits=all.filter(p=>clean(p.name).startsWith(needle)); if(hits.length)return best(hits);
  hits=all.filter(p=>needle.startsWith(clean(p.name))); if(hits.length)return best(hits);
  const fw=needle.split(/\s+/)[0];
  if(fw.length>=4){hits=all.filter(p=>clean(p.name).startsWith(fw));if(hits.length)return best(hits);}
  return undefined;
}

function parseCSVDirectly(csvContent) {
  const lines=csvContent.split("\n");
  const result={match_summary:{},squads:{team1:{players:[]},team2:{players:[]}},innings:{first_innings:{batting:[],bowling:[]},second_innings:{batting:[],bowling:[]}},match_officials:{}};
  for (const raw of lines) {
    const line=raw.trim(); if(!line||line.startsWith("#"))continue;
    const cols=line.split(",").map(c=>c.trim()); const sec=cols[0];
    if(sec==="MATCH SUMMARY"){let key=(cols[1]||"").toLowerCase().replace(/ /g,"_").replace(/^team_1_/,"team1_").replace(/^team_2_/,"team2_");if(key)result.match_summary[key]=cols[2]||"";continue;}
    if(sec==="INNING"){result.match_summary.inning=cols[1];continue;}
    if(sec==="SQUAD"){const team=cols[1],player=cols[2];if(!team||!player||team==="Team"||player==="Player")continue;const t1n=result.squads.team1.team_name;if(!t1n){result.squads.team1.team_name=team;result.squads.team1.players.push(player);}else if(team===t1n){result.squads.team1.players.push(player);}else{if(!result.squads.team2.team_name)result.squads.team2.team_name=team;result.squads.team2.players.push(player);}continue;}
    const is1B=sec.includes("1ST INNINGS")&&sec.includes("BATTING"),is2B=sec.includes("2ND INNINGS")&&sec.includes("BATTING");
    const is1Bw=sec.includes("1ST INNINGS")&&sec.includes("BOWLING"),is2Bw=sec.includes("2ND INNINGS")&&sec.includes("BOWLING");
    const toInt=s=>{const n=parseInt(s);return isNaN(n)?0:n;};
    if(is1B||is2B){const k=is1B?"first_innings":"second_innings";const bat=cols[1];if(!bat||["Batsman","Total","Extras",""].includes(bat))continue;result.innings[k].batting.push({batsman:bat,status:cols[2]||"",runs:toInt(cols[3]),balls:toInt(cols[4]),fours:toInt(cols[5]),sixes:toInt(cols[6])});continue;}
    if(is1Bw||is2Bw){const k=is1Bw?"first_innings":"second_innings";const bowl=cols[1];if(!bowl||bowl==="Bowler")continue;result.innings[k].bowling.push({bowler:bowl,overs:parseCricketOvers(cols[2]),runs:toInt(cols[3]),wickets:toInt(cols[4]),maidens:toInt(cols[5])});continue;}
  }
  return result;
}

async function parseCSVViaPython(csvContent) {
  try {
    const form=new FormData();
    form.append("csv_data",csvContent);
    const ocrUrl=process.env.OCR_SERVICE_URL||"http://ocr-service:5000";
    const r=await fetch(`${ocrUrl}/api/csv/parse`,{method:"POST",headers:{"x-admin-key":process.env.ADMIN_SECRET||"ch11-admin-2026",...form.getHeaders()},body:form});
    if(r.ok){const parsed=await r.json();if(parsed.match_summary?.match)return parsed;}
    throw new Error("OCR service returned incomplete data");
  } catch(e) {
    console.warn("[parseCSV] OCR unavailable, using JS parser:",e.message);
    return parseCSVDirectly(csvContent);
  }
}

// ── Static files (Railway: Express serves the frontend) ───────────────────────
app.use(express.static(path.join(__dirname,"public")));
app.get("*",(req,res,next)=>{
  if(req.path.startsWith("/api")||req.path.startsWith("/templates"))return next();
  res.sendFile(path.join(__dirname,"public","index.html"));
});

const PORT=parseInt(process.env.PORT||"3001",10);
app.listen(PORT,()=>console.log(`CH_Eleven API running on :${PORT}`));
