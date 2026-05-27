// Copyright (c) 2026 RAJ.Y — All rights reserved.
// CH_Eleven Fantasy Cricket Platform
// https://github.com/RAJ-Y/ch-eleven
// Scorecard Parser - Extracts player stats from CSV/JSON scorecard data
// Supports both inning formats and bulk uploads

function parseScorecard(data, format = 'json') {
  if (format === 'csv') {
    return parseCSV(data);
  } else if (format === 'json') {
    return parseJSON(data);
  }
  throw new Error('Unsupported format. Use csv or json.');
}

function parseJSON(jsonStr) {
  try {
    const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    
    const result = {
      matchInfo: data.match_info || {},
      batting: [],
      bowling: [],
      inning: data.inning || 1,
    };

    // Parse batting stats
    if (data.batting && Array.isArray(data.batting)) {
      result.batting = data.batting.map(b => ({
        player_name: b.batsman || b.name || '',
        runs: parseInt(b.runs || b.r || 0),
        balls_faced: parseInt(b.balls || b.b || 0),
        fours: parseInt(b.fours || b['4s'] || 0),
        sixes: parseInt(b.sixes || b['6s'] || 0),
        minutes: parseInt(b.minutes || b.m || 0),
        status: b.status || b.dismissal || '',
        team: b.team || '',
      }));
    }

    // Parse bowling stats
    if (data.bowling && Array.isArray(data.bowling)) {
      result.bowling = data.bowling.map(b => ({
        player_name: b.bowler || b.name || '',
        overs_bowled: parseFloat(b.overs || b.o || 0),
        maidens: parseInt(b.maidens || b.m || 0),
        runs_conceded: parseInt(b.runs || b.r || 0),
        wickets: parseInt(b.wickets || b.w || 0),
        team: b.team || '',
      }));
    }

    return result;
  } catch (e) {
    throw new Error(`JSON parse error: ${e.message}`);
  }
}

function parseCSV(csvStr) {
  const lines = csvStr.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have headers and at least one data row');

  const result = {
    matchInfo: {},
    batting: [],
    bowling: [],
    inning: 1,
  };

  let section = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Section headers
    if (line.toLowerCase().includes('[batting]')) {
      section = 'batting';
      i++; // skip header row
      continue;
    }
    if (line.toLowerCase().includes('[bowling]')) {
      section = 'bowling';
      i++; // skip header row
      continue;
    }

    const parts = line.split(',').map(p => p.trim());

    if (section === 'batting' && parts.length >= 3) {
      result.batting.push({
        player_name: parts[0],
        runs: parseInt(parts[1]) || 0,
        balls_faced: parseInt(parts[2]) || 0,
        fours: parseInt(parts[3]) || 0,
        sixes: parseInt(parts[4]) || 0,
        minutes: parseInt(parts[5]) || 0,
        status: parts[6] || '',
        team: parts[7] || '',
      });
    }

    if (section === 'bowling' && parts.length >= 5) {
      result.bowling.push({
        player_name: parts[0],
        overs_bowled: parseFloat(parts[1]) || 0,
        maidens: parseInt(parts[2]) || 0,
        runs_conceded: parseInt(parts[3]) || 0,
        wickets: parseInt(parts[4]) || 0,
        team: parts[5] || '',
      });
    }
  }

  return result;
}

// Match player name from scorecard to DB player
function matchPlayer(playerName, dbPlayers) {
  if (!playerName) return null;
  
  const normalized = playerName.toLowerCase().trim();
  
  // Exact match
  let match = dbPlayers.find(p => p.name.toLowerCase() === normalized);
  if (match) return match;
  
  // Partial match (first/last name)
  match = dbPlayers.find(p => 
    p.name.toLowerCase().includes(normalized) || 
    normalized.includes(p.name.toLowerCase())
  );
  
  return match || null;
}

// Build update payload for a player from scorecard data
function buildPlayerUpdate(scorecardPlayer, dbPlayer, type) {
  if (!dbPlayer) return null;
  
  const update = {
    id: dbPlayer.id,
    ...dbPlayer,
  };

  if (type === 'batting') {
    update.runs = (update.runs || 0) + scorecardPlayer.runs;
    update.balls_faced = (update.balls_faced || 0) + scorecardPlayer.balls_faced;
    update.fours = (update.fours || 0) + scorecardPlayer.fours;
    update.sixes = (update.sixes || 0) + scorecardPlayer.sixes;
    if (scorecardPlayer.status && scorecardPlayer.status.toLowerCase().includes('duck')) {
      update.duck = true;
    }
  }

  if (type === 'bowling') {
    update.wickets = (update.wickets || 0) + scorecardPlayer.wickets;
    update.overs_bowled = (update.overs_bowled || 0) + scorecardPlayer.overs_bowled;
    update.runs_conceded = (update.runs_conceded || 0) + scorecardPlayer.runs_conceded;
    update.maidens = (update.maidens || 0) + scorecardPlayer.maidens;
  }

  return update;
}

module.exports = {
  parseScorecard,
  parseJSON,
  parseCSV,
  matchPlayer,
  buildPlayerUpdate,
};
