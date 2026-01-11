path = r"c:\Users\David Glasser\OneDrive\Documents\Projects\DollarData\frontend\src\pages\NetWorth.jsx"
try:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Validation: Print the lines we are about to delete boundaries to be sure
    print(f"Line 456 (to delete): {lines[455].strip()}")
    print(f"Line 624 (to delete): {lines[623].strip()}")
    print(f"Line 625 (to keep): {lines[624].strip()}")
    
    # Remove lines 456 through 624 (1-based)
    # Indices: 455 through 623
    # Keep 0..454 (lines 1..455)
    # Keep 624..end (lines 625..end)
    new_lines = lines[:455] + lines[624:]
    
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        
    print("Successfully removed lines 456-624")
    
except Exception as e:
    print(f"Error: {e}")
