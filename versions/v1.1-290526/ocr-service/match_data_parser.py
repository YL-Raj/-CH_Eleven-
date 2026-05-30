#!/usr/bin/env python3
# Match Data Parser for CSV/JSON bulk uploads
# Handles complete match data with squads, innings, bowling, etc.

import csv
import json
import re
from io import StringIO

class MatchDataParser:
    def __init__(self):
        self.roles = ["BAT", "BOWL", "AR", "WK"]
    
    def parse_file(self, content, format_type="csv"):
        """Parse CSV or JSON match data"""
        try:
            if format_type == "csv":
                return self.parse_csv(content)
            elif format_type == "json":
                return self.parse_json(content)
            else:
                return {"error": "Unsupported format", "validation": {"valid": False, "errors": ["Use CSV or JSON"]}}
        except Exception as e:
            return {"error": str(e), "validation": {"valid": False, "errors": [str(e)]}}
    
    def parse_csv(self, content):
        """Parse CSV with sections like MATCH SUMMARY, SQUAD, 1ST INNINGS BATTING, etc."""
        result = {
            "match_summary": {},
            "squads": {"team1": {"players": []}, "team2": {"players": []}},
            "innings": {
                "first_innings": {"batting": [], "bowling": []},
                "second_innings": {"batting": [], "bowling": []}
            },
            "fall_of_wickets": {"first_innings": [], "second_innings": []},
            "match_officials": {}
        }
        
        lines = content.split("\n")
        current_section = None
        current_team = None
        team_count = {}
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            
            parts = [p.strip() for p in line.split(",")]
            section = parts[0].upper() if parts else ""
            
            # MATCH SUMMARY
            if section == "MATCH SUMMARY":
                field = parts[1] if len(parts) > 1 else ""
                value = parts[2] if len(parts) > 2 else ""
                if field:
                    key = field.lower().replace(" ", "_")
                    result["match_summary"][key] = value
                continue
            
            # SQUAD
            if section == "SQUAD":
                team = parts[1] if len(parts) > 1 else ""
                player = parts[2] if len(parts) > 2 else ""
                if team and player and team != "Team" and player != "Player":
                    # Track which players belong to team1 vs team2
                    if team not in team_count:
                        team_count[team] = 0
                        if team_count.get(list(team_count.keys())[0] if team_count else None, 0) < 15:
                            if "team1_name" not in result["match_summary"]:
                                result["match_summary"]["team1_name"] = team
                                result["squads"]["team1"]["team_name"] = team
                    if team == result["match_summary"].get("team1_name"):
                        result["squads"]["team1"]["players"].append(player)
                        team_count[team] += 1
                    else:
                        if "team2_name" not in result["match_summary"]:
                            result["match_summary"]["team2_name"] = team
                            result["squads"]["team2"]["team_name"] = team
                        result["squads"]["team2"]["players"].append(player)
                        team_count[team] = team_count.get(team, 0) + 1
                continue
            
            # 1ST INNINGS BATTING
            if "1ST INNINGS" in section and "BATTING" in section:
                batsman = parts[1] if len(parts) > 1 else ""
                if batsman and batsman not in ["Batsman", "Total", "Extras", ""]:
                    result["innings"]["first_innings"]["batting"].append({
                        "batsman": batsman,
                        "status": parts[2] if len(parts) > 2 else "",
                        "runs": int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 0,
                        "balls": int(parts[4]) if len(parts) > 4 and parts[4].isdigit() else 0,
                        "fours": int(parts[5]) if len(parts) > 5 and parts[5].isdigit() else 0,
                        "sixes": int(parts[6]) if len(parts) > 6 and parts[6].isdigit() else 0,
                    })
                continue
            
            # 1ST INNINGS BOWLING
            if "1ST INNINGS" in section and "BOWLING" in section:
                bowler = parts[1] if len(parts) > 1 else ""
                if bowler and bowler not in ["Bowler", ""]:
                    overs = self._parse_cricket_overs(parts[2]) if len(parts) > 2 else 0
                    result["innings"]["first_innings"]["bowling"].append({
                        "bowler": bowler,
                        "overs": overs,
                        "runs": int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 0,
                        "wickets": int(parts[4]) if len(parts) > 4 and parts[4].isdigit() else 0,
                        "maidens": int(parts[5]) if len(parts) > 5 and parts[5].isdigit() else 0,
                    })
                continue
            
            # 2ND INNINGS BATTING
            if "2ND INNINGS" in section and "BATTING" in section:
                batsman = parts[1] if len(parts) > 1 else ""
                if batsman and batsman not in ["Batsman", "Total", "Extras", ""]:
                    result["innings"]["second_innings"]["batting"].append({
                        "batsman": batsman,
                        "status": parts[2] if len(parts) > 2 else "",
                        "runs": int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 0,
                        "balls": int(parts[4]) if len(parts) > 4 and parts[4].isdigit() else 0,
                        "fours": int(parts[5]) if len(parts) > 5 and parts[5].isdigit() else 0,
                        "sixes": int(parts[6]) if len(parts) > 6 and parts[6].isdigit() else 0,
                    })
                continue
            
            # 2ND INNINGS BOWLING
            if "2ND INNINGS" in section and "BOWLING" in section:
                bowler = parts[1] if len(parts) > 1 else ""
                if bowler and bowler not in ["Bowler", ""]:
                    overs = self._parse_cricket_overs(parts[2]) if len(parts) > 2 else 0
                    result["innings"]["second_innings"]["bowling"].append({
                        "bowler": bowler,
                        "overs": overs,
                        "runs": int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 0,
                        "wickets": int(parts[4]) if len(parts) > 4 and parts[4].isdigit() else 0,
                        "maidens": int(parts[5]) if len(parts) > 5 and parts[5].isdigit() else 0,
                    })
                continue
            
            # FALL OF WICKETS
            if "FALL OF WICKETS" in section:
                innings = parts[1] if len(parts) > 1 else ""
                wicket_num = parts[2] if len(parts) > 2 else ""
                if innings and wicket_num:
                    inn_key = "first_innings" if "1" in innings else "second_innings"
                    result["fall_of_wickets"][inn_key].append({
                        "wicket": wicket_num,
                        "score": parts[3] if len(parts) > 3 else "",
                        "over": parts[4] if len(parts) > 4 else "",
                        "batsman": parts[5] if len(parts) > 5 else "",
                    })
                continue
            
            # MATCH OFFICIALS
            if section == "MATCH OFFICIALS":
                role = parts[1] if len(parts) > 1 else ""
                name = parts[2] if len(parts) > 2 else ""
                if role and name:
                    result["match_officials"][role.lower()] = name
                continue
        
        # Validate
        validation = self._validate(result)
        result["validation"] = validation
        
        return result
    
    def parse_json(self, content):
        """Parse JSON match data"""
        try:
            data = json.loads(content)
            # Ensure expected structure
            if "match_summary" not in data:
                data["match_summary"] = {}
            if "squads" not in data:
                data["squads"] = {"team1": {"players": []}, "team2": {"players": []}}
            if "innings" not in data:
                data["innings"] = {
                    "first_innings": {"batting": [], "bowling": []},
                    "second_innings": {"batting": [], "bowling": []}
                }
            if "fall_of_wickets" not in data:
                data["fall_of_wickets"] = {"first_innings": [], "second_innings": []}
            if "match_officials" not in data:
                data["match_officials"] = {}
            
            validation = self._validate(data)
            data["validation"] = validation
            
            return data
        except json.JSONDecodeError as e:
            return {"error": f"Invalid JSON: {str(e)}", "validation": {"valid": False, "errors": [str(e)]}}
    
    def _validate(self, data):
        """Validate parsed match data"""
        errors = []
        warnings = []
        
        # Check critical fields
        if not data.get("match_summary", {}).get("match"):
            errors.append("Missing match name")
        
        if not data.get("match_summary", {}).get("team1_name"):
            errors.append("Missing Team 1 name")
        
        if not data.get("match_summary", {}).get("team2_name"):
            errors.append("Missing Team 2 name")
        
        # Squads
        t1_squad = data.get("squads", {}).get("team1", {}).get("players", [])
        t2_squad = data.get("squads", {}).get("team2", {}).get("players", [])
        
        if not t1_squad:
            warnings.append("No Team 1 squad found")
        if not t2_squad:
            warnings.append("No Team 2 squad found")
        
        # Innings data
        bat1 = data.get("innings", {}).get("first_innings", {}).get("batting", [])
        bat2 = data.get("innings", {}).get("second_innings", {}).get("batting", [])
        
        if not bat1 and not bat2:
            warnings.append("No batting data found")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "summary": {
                "match": data.get("match_summary", {}).get("match", ""),
                "teams": 2,
                "squad_size": len(t1_squad) + len(t2_squad),
                "batting_records": len(bat1) + len(bat2),
                "bowling_records": (
                    len(data.get("innings", {}).get("first_innings", {}).get("bowling", [])) +
                    len(data.get("innings", {}).get("second_innings", {}).get("bowling", []))
                )
            }
        }
    
    def _parse_cricket_overs(self, overs_str):
        """Convert cricket notation (2.4 = 2 overs 4 balls) to decimal"""
        try:
            val = float(overs_str)
            whole = int(val)
            ball_part = round((val - whole) * 10)
            if ball_part == 0 or ball_part >= 6:
                return val
            # Convert 2.4 → 2 + 4/6 = 2.667
            return round((whole + ball_part / 6.0) * 1000) / 1000
        except:
            return 0.0
