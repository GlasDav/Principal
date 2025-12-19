import pandas as pd
import io
from typing import List, Dict, Any
from dateutil import parser as date_parser

def parse_preview(file_bytes: bytes) -> Dict[str, Any]:
    """
    Reads first few rows of CSV to let user map columns.
    """
    try:
        # Try default engine
        df = pd.read_csv(io.BytesIO(file_bytes), nrows=5, skipinitialspace=True)
    except Exception:
        # Fallback to python engine if C failing on encoding
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), nrows=5, engine='python', skipinitialspace=True)
        except Exception as e:
            raise ValueError(f"Failed to parse CSV: {str(e)}")
            
    df = df.fillna("")
    
    return {
        "headers": list(df.columns),
        "rows": df.to_dict(orient="records")
    }

def process_csv(file_bytes: bytes, mapping: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Reads entire CSV and maps columns to Transaction format.
    mapping: { "date": "ColName", "description": "ColName", "amount": "ColName" }
    """
    try:
        df = pd.read_csv(io.BytesIO(file_bytes), skipinitialspace=True)
    except Exception:
        df = pd.read_csv(io.BytesIO(file_bytes), engine='python', skipinitialspace=True)
        
    df = df.fillna("")
    
    transactions = []
    
    col_date = mapping.get("date")
    col_desc = mapping.get("description")
    col_amount = mapping.get("amount")
    col_debit = mapping.get("debit")
    col_credit = mapping.get("credit")
    
    # Validation: Date and Description are mandatory.
    # For numeric, either Amount OR (Debit + Credit) is required.
    if not (col_date and col_desc):
        raise ValueError("Date and Description columns are required")
        
    if not col_amount and not (col_debit or col_credit):
        raise ValueError("Either an Amount column OR Debit/Credit columns are required")
        
    def clean_num(val):
        """Helper to parse currency strings"""
        if pd.isna(val) or val == "": return 0.0
        s = str(val).replace("$", "").replace(",", "").strip()
        if not s: return 0.0
        try:
            return float(s)
        except:
            return 0.0

    for _, row in df.iterrows():
        try:
            # Parse Date
            raw_date = str(row[col_date])
            dt = date_parser.parse(raw_date)
            
            # Parse Amount
            amount = 0.0
            
            if col_amount:
                # Single Column Mode
                amount = clean_num(row[col_amount])
            else:
                # Split Column Mode
                # Logic: Credit is positive, Debit is negative.
                # Usually statements have "Dr" or just positive numbers in Debit col.
                # We assume values in columns are positive magnitudes usually.
                
                # Update: Use abs() because some CSVs put "-50.00" in Debit column, others "50.00".
                # Both mean "Outflow", so we force it to be negative.
                
                credit_val = abs(clean_num(row.get(col_credit))) if col_credit else 0.0
                debit_val = abs(clean_num(row.get(col_debit))) if col_debit else 0.0
                
                amount = credit_val - debit_val
            
            # Description
            desc = str(row[col_desc])
            
            transactions.append({
                "date": dt,
                "description": desc,
                "amount": amount
            })
        except Exception as e:
            # Skip malformed rows? Or Log?
            print(f"Skipping row due to error: {e}")
            continue
            
    return transactions
