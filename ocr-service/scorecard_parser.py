# Copyright (c) 2026 RAJ.Y — All rights reserved.
# CH_Eleven Fantasy Cricket Platform
# https://github.com/RAJ-Y/ch-eleven
"""
Scorecard Parser - Extracts batting/bowling tables from OCR text
Handles cricket scorecards from PDFs, images, DOCX
"""

import re
import pandas as pd
from typing import Dict, List, Tuple, Any

class ScorecardParser:
    """Parse cricket scorecard text to extract batting and bowling stats"""

    def __init__(self):
        self.batting_keywords = ['batsman', 'batsmen', 'player', 'runs', 'balls', 'fours', 'sixes']
        self.bowling_keywords = ['bowler', 'overs', 'maidens', 'wickets', 'runs', 'economy']

    def parse_text(self, text: str, inning: int = 1) -> Dict[str, Any]:
        """
        Parse OCR extracted text into structured scorecard data
        
        Args:
            text: Raw OCR text from scorecard
            inning: 1 or 2 (match inning number)
            
        Returns:
            Dict with batting, bowling, and match info
        """
        result = {
            "inning": inning,
            "batting": [],
            "bowling": [],
            "match_info": {},
            "confidence": 0.0,
        }

        # Extract match details
        result["match_info"] = self._extract_match_info(text)
        
        # Extract batting table
        result["batting"] = self._extract_batting(text)
        
        # Extract bowling table
        result["bowling"] = self._extract_bowling(text)

        # Calculate confidence score
        result["confidence"] = self._calc_confidence(result)

        return result

    def _extract_match_info(self, text: str) -> Dict[str, str]:
        """Extract match details (teams, ground, date)"""
        info = {}
        
        # Try to find team names (usually capitalized phrases)
        lines = text.split('\n')
        for line in lines[:20]:  # Check first 20 lines
            if 'vs' in line.lower() or 'versus' in line.lower():
                info['match'] = line.strip()
        
        # Extract ground/venue
        for keyword in ['ground', 'venue', 'location', 'cricket ground']:
            pattern = rf'{keyword}.*?([A-Z][^,\n]+(?:,[^,\n]+)?)'
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                info['ground'] = match.group(1).strip()
                break

        # Extract date
        date_pattern = r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}'
        date_match = re.search(date_pattern, text)
        if date_match:
            info['date'] = date_match.group(0)

        return info

    def _extract_batting(self, text: str) -> List[Dict[str, Any]]:
        """Extract batting statistics from text"""
        batting_list = []
        
        # Split text into lines
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        # Look for batting section
        batting_start = -1
        for i, line in enumerate(lines):
            if re.search(r'(?:batsman|batting|inning.*batting)', line, re.IGNORECASE):
                batting_start = i + 1
                break
        
        if batting_start == -1:
            # No clear section header, try to find batting patterns
            batting_start = 0

        # Parse individual batting rows
        for i, line in enumerate(lines[batting_start:]):
            # Stop at bowling section
            if re.search(r'(?:bowler|bowling)', line, re.IGNORECASE):
                break

            # Match batting line pattern: Name Runs Balls 4s 6s Status
            # Example: "Raj007 30 7 1 2 not out"
            batting_match = re.match(
                r'^([A-Za-z0-9\s\(\)]+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*(.*?)$',
                line
            )

            if batting_match:
                batsman_name = batting_match.group(1).strip()
                
                # Skip if it's a header line
                if batsman_name.lower() in ['no', 'batsman', 'runs', 'balls']:
                    continue

                batting_data = {
                    "batsman": batsman_name,
                    "runs": int(batting_match.group(2)),
                    "balls": int(batting_match.group(3)),
                    "4s": int(batting_match.group(4)),
                    "6s": int(batting_match.group(5)),
                    "status": batting_match.group(6).strip() or "not out",
                }
                batting_list.append(batting_data)

        return batting_list

    def _extract_bowling(self, text: str) -> List[Dict[str, Any]]:
        """Extract bowling statistics from text"""
        bowling_list = []
        
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        # Find bowling section
        bowling_start = -1
        for i, line in enumerate(lines):
            if re.search(r'(?:bowler|bowling)', line, re.IGNORECASE):
                bowling_start = i + 1
                break

        if bowling_start == -1:
            return bowling_list

        # Parse individual bowling rows
        # Pattern: Bowler Overs Maidens Runs Wickets Economy
        # Example: "Monika Chill 1.0 0 12 4 12.00"
        for line in lines[bowling_start:]:
            # Stop at next section
            if re.search(r'(?:extras|total|fall of wickets)', line, re.IGNORECASE):
                break

            bowling_match = re.match(
                r'^([A-Za-z0-9\s\(\)]+?)\s+([\d.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s*(?:[\d.]+)?$',
                line
            )

            if bowling_match:
                bowler_name = bowling_match.group(1).strip()
                
                # Skip headers
                if bowler_name.lower() in ['no', 'bowler', 'overs', 'runs', 'wickets']:
                    continue

                bowling_data = {
                    "bowler": bowler_name,
                    "overs": float(bowling_match.group(2)),
                    "maidens": int(bowling_match.group(3)),
                    "runs": int(bowling_match.group(4)),
                    "wickets": int(bowling_match.group(5)),
                }
                bowling_list.append(bowling_data)

        return bowling_list

    def _calc_confidence(self, result: Dict) -> float:
        """Calculate parsing confidence score (0-1)"""
        score = 0.0
        max_score = 0.0

        # Match info confidence
        if result['match_info'].get('match'):
            score += 0.2
        max_score += 0.2

        # Batting data confidence
        if len(result['batting']) >= 11:
            score += 0.4
        elif len(result['batting']) >= 5:
            score += 0.2
        max_score += 0.4

        # Bowling data confidence
        if len(result['bowling']) >= 5:
            score += 0.4
        elif len(result['bowling']) >= 3:
            score += 0.2
        max_score += 0.4

        return round(score / max_score if max_score > 0 else 0, 2)

    def merge_innings(self, inning1: Dict, inning2: Dict) -> Dict:
        """Merge two innings into single scorecard"""
        return {
            "inning_1": inning1,
            "inning_2": inning2,
            "result": self._determine_result(inning1, inning2),
        }

    def _determine_result(self, inn1: Dict, inn2: Dict) -> str:
        """Determine match result"""
        inn1_runs = sum(b.get('runs', 0) for b in inn1.get('batting', []))
        inn2_runs = sum(b.get('runs', 0) for b in inn2.get('batting', []))
        
        if inn1_runs > inn2_runs:
            return f"Team 1 won by {inn1_runs - inn2_runs} runs"
        elif inn2_runs > inn1_runs:
            return f"Team 2 won by {inn2_runs - inn1_runs} runs"
        else:
            return "Match tied"
