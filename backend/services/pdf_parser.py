import pdfplumber
import re
from datetime import datetime
from typing import List, Dict, Optional, Any

# ==========================================
# CONSTANTS & PATTERNS
# ==========================================

# Generic Date Pattern (dd MMM or MMM dd)
# Matches: "Sep 5", "09 Nov"
DATE_PATTERN = re.compile(r'^((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}|\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))$', re.IGNORECASE)
DATE_SLASH_PATTERN = re.compile(r'\d{2}/\d{2}/\d{2,4}')

# ==========================================
# STRATEGIES
# ==========================================

class ParsingStrategy:
    def parse(self, pages: List[Any]) -> List[Dict]:
        raise NotImplementedError

class TableParsingStrategy(ParsingStrategy):
    """
    Robust strategy using PDF Table Extraction.
    Expected Columns: Date | Description | Debits | Credits | Balance
    Expected Columns: Date | Transaction Type | Description | Debits | Credits | Balance
    """
    def parse(self, pages: List[Any]) -> List[Dict]:
        transactions = []
        current_year = datetime.now().year
        
        for page in pages:
            # Try text-based strategy for better row detection without grid lines
            tables = page.extract_tables({"vertical_strategy": "text", "horizontal_strategy": "text", "snap_tolerance": 4})
            
            for table in tables:
                for row in table:
                    # Clean row
                    cleaned_row = [str(cell).strip() if cell else "" for cell in row]
                    
                    # Skip empty rows
                    if not any(cleaned_row): continue

                    # Check for Year Header (e.g. "Sep 2023")
                    # If row has limited data and first item looks like Month Year
                    if len(cleaned_row) > 0:
                        potential_year_header = cleaned_row[0]
                        # Check "Sep 2025" pattern -> Month Year
                        match = re.search(r'([A-Za-z]{3})\s+(\d{4})', potential_year_header)
                        if match:
                            try:
                                current_year = int(match.group(2))
                                continue # It's a header line
                            except: pass

                    # Ensure enough columns (Date, Trans, Desc, Debit, Credit)
                    # We expect at least 5 cols based on debug output
                    if len(cleaned_row) < 5: continue
                    
                    date_str = cleaned_row[0]
                    
                    # Fix: Strategy 'text' splits description words into columns
                    # We should parse from the end for Amounts
                    # Assumed structure based on debug:
                    # [Date, DescPart1, DescPart2..., Debit, Credit, Balance, CR/DR/Empty]
                    
                    # Determine end padding
                    # Check if last item is CR/DR or empty which are Balance modifiers/status
                    end_idx = -1
                    if cleaned_row[-1].upper() in ["CR", "DR"]:
                         # Balance is at -2, Credit at -3, Debit at -4
                         # Items to skip at end = 1 (the CR)
                         payment_idx = -3
                         debit_idx = -4
                         desc_end_idx = -4
                    else:
                        # Maybe last item IS Balance? or Empty
                        if cleaned_row[-1] == "":
                             # Balance at -2?
                             # Let's assume structure [... Debit, Credit, Balance, '']
                             payment_idx = -3
                             debit_idx = -4
                             desc_end_idx = -4
                        else:
                             # Balance at -1
                             payment_idx = -2
                             debit_idx = -3
                             desc_end_idx = -3

                    # Skip Header Rows
                    # Join all parts to check for header keywords
                    full_row_str = " ".join(cleaned_row)
                    if "Date" in full_row_str and "Description" in full_row_str:
                         continue

                    # Parse Date
                    if not DATE_PATTERN.match(date_str) and not DATE_SLASH_PATTERN.match(date_str):
                        continue

                    # Parse Amounts
                    try:
                        debit_str = cleaned_row[debit_idx]
                        credit_str = cleaned_row[payment_idx]
                    except IndexError:
                        continue
                    
                    # Description is everything between Date and Debit
                    try:
                        # Slice from 1 to desc_end_idx (exclusive)
                        # Note: slicing with negative index like [1:-4] works naturally
                        desc_parts = cleaned_row[1:desc_end_idx]
                        description = " ".join(desc_parts)
                    except:
                        description = "Unidentified"
                    
                    amount = 0.0

                    
                    # Try Parsing Debit
                    if debit_str:
                        try:
                            val = float(debit_str.replace(',', '').replace('$', ''))
                            amount -= abs(val)
                        except: pass
                        
                    # Try Parsing Credit
                    if credit_str:
                        try:
                            val = float(credit_str.replace(',', '').replace('$', ''))
                            amount += abs(val)
                        except: pass
                        
                    # Skip if no amount (unless it's a note line, but we usually want transactions)
                    if amount == 0.0 and not (debit_str or credit_str):
                        continue

                    # Determine Full Date
                    # Attempt to guess year or use current
                    # For "01 Sep", we might need the statement year.
                    # Default to current year for now, or infer from somewhere.
                    
                    try:
                        # Try parsing "dd MMM"
                        full_date_str = f"{date_str} {current_year}"
                        try:
                            date_obj = datetime.strptime(full_date_str, "%d %b %Y")
                        except ValueError:
                             date_obj = datetime.strptime(full_date_str, "%b %d %Y")
                    except:
                        # Fallback or skip
                        continue

                    # Finalize Transaction
                    # Filter unwanted
                    if "Opening balance" in description: continue

                    transactions.append({
                        "date": date_obj,
                        "description": description,
                        "raw_description": f"{date_str} | {description} | {debit_str} | {credit_str}",
                        "amount": amount,
                        "category_confidence": 0.0,
                        "is_verified": False
                    })
                    
        return transactions

class CoordinateParsingStrategy(ParsingStrategy):
    """
    Fallback: old word-coordinate based strategy.
    Combined Macquarie/CreditCard logic for fallback.
    """
    def parse(self, pages: List[Any]) -> List[Dict]:
         # ... (Not implemented here to save space, assuming Table is main)
         return []

# ==========================================
# MAIN PARSER
# ==========================================

def parse_pdf(file_path: str) -> List[Dict]:
    with pdfplumber.open(file_path) as pdf:
        # Try Table Strategy First
        try:
            strategy = TableParsingStrategy()
            results = strategy.parse(pdf.pages)
            if results:
                return results
        except Exception as e:
            print(f"Table parsing failed: {e}")
            
        return []
