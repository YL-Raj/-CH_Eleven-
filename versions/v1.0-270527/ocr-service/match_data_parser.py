# Copyright (c) 2026 RAJ.Y — All rights reserved.
# CH_Eleven Fantasy Cricket Platform
# https://github.com/RAJ-Y/ch-eleven
"""
Complete Match Data Parser - Handles CSV and JSON scorecard uploads
Parses: Match summary, Squads, Innings (1st & 2nd), Bowling, Fall of Wickets
"""

import csv
import json
from io import StringIO
from typing import Dict, List, Any, Tuple

class MatchDataParser:
    """Parse complete cricket match data from CSV/JSON files"""

    def parse_file(self, content: str, file_type: str) -> Dict[str, Any]:
        """
        Parse complete match file (CSV or JSON)
        
        Args:
            content: File content (string)
            file_type: 'csv' or 'json'
            
        Returns:
            Structured match data with validation
        """
        try:
            if file_type == 'csv':
                return self._parse_csv(content)
            elif file_type == 'json':
                return self._parse_json(content)
            else:
                return {'error': 'Unsupported file type'}
        except Exception as e:
            return {'error': str(e), 'status': 'parse_error'}

    def _parse_json(self, content: str) -> Dict[str, Any]:
        """Parse JSON format"""
        data = json.loads(content)
        
        return {
            'match_summary': data.get('match_summary', {}),
            'squads': data.get('squads', {}),
            'innings': data.get('innings', {}),
            'fall_of_wickets': data.get('fall_of_wickets', {}),
            'match_officials': data.get('match_officials', {}),
            'validation': self._validate_match_data(data),
        }

    def _parse_csv(self, content: str) -> Dict[str, Any]:
        """Parse CSV format (custom structure)"""
        lines = content.strip().split('\n')
        reader = csv.reader(lines)
        
        match_data = {
            'match_summary': {},
            'squads': {'team1': {'players': []}, 'team2': {'players': []}},
            'innings': {
                'first_innings': {'batting': [], 'bowling': []},
                'second_innings': {'batting': [], 'bowling': []}
            },
            'fall_of_wickets': {'first_innings': [], 'second_innings': []},
            'match_officials': {},
        }
        
        current_section = None
        current_team = None
        current_inning = None
        
        for row in reader:
            if not row or not row[0]:
                continue
            
            section = row[0].strip()
            
            # Match Summary
            if section == 'MATCH SUMMARY':
                field = row[1].strip() if len(row) > 1 else ''
                value = row[2].strip() if len(row) > 2 else ''
                if field and value:
                    # Normalise key, then fix common mismatches (e.g. "team_1_name" → "team1_name")
                    key = field.lower().replace(' ', '_')
                    key = key.replace('team_1_', 'team1_').replace('team_2_', 'team2_')
                    match_data['match_summary'][key] = value
                continue
            
            # Squads
            if section == 'SQUAD':
                if len(row) > 2 and row[1].strip() and row[2].strip():
                    team = row[1].strip()
                    player = row[2].strip()
                    # Skip header row
                    if team in ('Team', '') or player in ('Player', ''):
                        continue
                    # Dynamically assign team1 / team2 by first-seen team name
                    t1_name = match_data['squads']['team1'].get('team_name')
                    if not t1_name:
                        match_data['squads']['team1']['team_name'] = team
                        t1_name = team
                    if team == t1_name:
                        match_data['squads']['team1']['players'].append(player)
                    else:
                        if not match_data['squads']['team2'].get('team_name'):
                            match_data['squads']['team2']['team_name'] = team
                        match_data['squads']['team2']['players'].append(player)
                continue
            
            # Innings
            if '1ST INNINGS' in section:
                current_inning = 'first_innings'
                if 'BATTING' in section:
                    if len(row) > 1 and row[1].strip() not in ['Batsman', '']:
                        bat_data = {
                            'batsman': row[1].strip() if len(row) > 1 else '',
                            'status': row[2].strip() if len(row) > 2 else '',
                            'runs': int(row[3]) if len(row) > 3 and row[3].isdigit() else 0,
                            'balls': int(row[4]) if len(row) > 4 and row[4].isdigit() else 0,
                            'fours': int(row[5]) if len(row) > 5 and row[5].isdigit() else 0,
                            'sixes': int(row[6]) if len(row) > 6 and row[6].isdigit() else 0,
                        }
                        if bat_data['batsman'] and bat_data['batsman'] not in ['Total', 'Extras']:
                            match_data['innings']['first_innings']['batting'].append(bat_data)
                elif 'BOWLING' in section:
                    if len(row) > 1 and row[1].strip() not in ['Bowler', '']:
                        bowl_data = {
                            'bowler': row[1].strip() if len(row) > 1 else '',
                            'overs': float(row[2]) if len(row) > 2 and row[2] else 0,
                            'runs': int(row[3]) if len(row) > 3 and row[3].isdigit() else 0,
                            'wickets': int(row[4]) if len(row) > 4 and row[4].isdigit() else 0,
                        }
                        if bowl_data['bowler']:
                            match_data['innings']['first_innings']['bowling'].append(bowl_data)
                continue
            
            if '2ND INNINGS' in section:
                current_inning = 'second_innings'
                if 'BATTING' in section:
                    if len(row) > 1 and row[1].strip() not in ['Batsman', '']:
                        bat_data = {
                            'batsman': row[1].strip() if len(row) > 1 else '',
                            'status': row[2].strip() if len(row) > 2 else '',
                            'runs': int(row[3]) if len(row) > 3 and row[3].isdigit() else 0,
                            'balls': int(row[4]) if len(row) > 4 and row[4].isdigit() else 0,
                            'fours': int(row[5]) if len(row) > 5 and row[5].isdigit() else 0,
                            'sixes': int(row[6]) if len(row) > 6 and row[6].isdigit() else 0,
                        }
                        if bat_data['batsman'] and bat_data['batsman'] not in ['Total', 'Extras']:
                            match_data['innings']['second_innings']['batting'].append(bat_data)
                elif 'BOWLING' in section:
                    if len(row) > 1 and row[1].strip() not in ['Bowler', '']:
                        bowl_data = {
                            'bowler': row[1].strip() if len(row) > 1 else '',
                            'overs': float(row[2]) if len(row) > 2 and row[2] else 0,
                            'runs': int(row[3]) if len(row) > 3 and row[3].isdigit() else 0,
                            'wickets': int(row[4]) if len(row) > 4 and row[4].isdigit() else 0,
                        }
                        if bowl_data['bowler']:
                            match_data['innings']['second_innings']['bowling'].append(bowl_data)
                continue
            
            # Fall of Wickets
            if section == 'FALL OF WICKETS':
                if len(row) > 2 and row[1].strip() in ['1', '2']:
                    inning_num = 'first_innings' if row[1].strip() == '1' else 'second_innings'
                    wkt_data = {
                        'wicket': row[2].strip() if len(row) > 2 else '',
                        'score': row[3].strip() if len(row) > 3 else '',
                        'over': row[4].strip() if len(row) > 4 else '',
                        'batsman': row[5].strip() if len(row) > 5 else '',
                    }
                    if wkt_data['wicket']:
                        match_data['fall_of_wickets'][inning_num].append(wkt_data)
                continue
            
            # Match Officials
            if section == 'MATCH OFFICIALS':
                role = row[1].strip() if len(row) > 1 else ''
                name = row[2].strip() if len(row) > 2 else ''
                if role and name:
                    match_data['match_officials'][role.lower().replace(' ', '_')] = name
                continue
        
        match_data['validation'] = self._validate_match_data(match_data)
        return match_data

    def _validate_match_data(self, data: Dict) -> Dict[str, Any]:
        """Validate parsed match data"""
        issues = []
        warnings = []
        
        # Check match summary
        if not data.get('match_summary', {}).get('match'):
            issues.append('Missing match name')
        if not data.get('match_summary', {}).get('team1_name'):
            issues.append('Missing Team 1 name')
        if not data.get('match_summary', {}).get('team2_name'):
            issues.append('Missing Team 2 name')
        
        # Check squads
        squads = data.get('squads', {})
        if not squads.get('team1', {}).get('players'):
            warnings.append('No Team 1 squad data')
        if not squads.get('team2', {}).get('players'):
            warnings.append('No Team 2 squad data')
        
        # Check innings
        innings = data.get('innings', {})
        if not innings.get('first_innings', {}).get('batting'):
            warnings.append('No 1st innings batting data')
        if not innings.get('second_innings', {}).get('batting'):
            warnings.append('No 2nd innings batting data')
        
        return {
            'valid': len(issues) == 0,
            'errors': issues,
            'warnings': warnings,
            'summary': {
                'teams': 2,
                'squad_size': len(squads.get('team1', {}).get('players', [])),
                'batting_records': len(innings.get('first_innings', {}).get('batting', [])) + len(innings.get('second_innings', {}).get('batting', [])),
                'bowling_records': len(innings.get('first_innings', {}).get('bowling', [])) + len(innings.get('second_innings', {}).get('bowling', [])),
            }
        }

    def extract_players_from_squad(self, squads: Dict) -> Tuple[List[str], List[str]]:
        """Extract player lists from squad data"""
        team1_players = squads.get('team1', {}).get('players', [])
        team2_players = squads.get('team2', {}).get('players', [])
        return team1_players, team2_players

    def extract_player_stats(self, innings_data: Dict) -> Dict[str, Dict]:
        """Extract player stats for database updates"""
        stats = {}
        
        for inning_key in ['first_innings', 'second_innings']:
            inning = innings_data.get(inning_key, {})
            
            # Batting stats
            for bat in inning.get('batting', []):
                player = bat.get('batsman', '')
                if player not in stats:
                    stats[player] = {
                        'runs': 0, 'balls': 0, 'fours': 0, 'sixes': 0,
                        'wickets': 0, 'overs': 0, 'runs_conceded': 0, 'maidens': 0
                    }
                stats[player]['runs'] += bat.get('runs', 0)
                stats[player]['balls'] += bat.get('balls', 0)
                stats[player]['fours'] += bat.get('fours', 0)
                stats[player]['sixes'] += bat.get('sixes', 0)
            
            # Bowling stats
            for bowl in inning.get('bowling', []):
                player = bowl.get('bowler', '')
                if player not in stats:
                    stats[player] = {
                        'runs': 0, 'balls': 0, 'fours': 0, 'sixes': 0,
                        'wickets': 0, 'overs': 0, 'runs_conceded': 0, 'maidens': 0
                    }
                stats[player]['wickets'] += bowl.get('wickets', 0)
                stats[player]['overs'] += bowl.get('overs', 0)
                stats[player]['runs_conceded'] += bowl.get('runs', 0)
        
        return stats
