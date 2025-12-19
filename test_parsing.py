from backend.services.pdf_parser import parse_pdf
import json

file_path = "Test Statement.pdf"

print(f"--- Testing Parsing on {file_path} ---")
try:
    results = parse_pdf(file_path)
    print(f"Found {len(results)} transactions.")
    for txn in results:
        print(f"{txn['date'].strftime('%Y-%m-%d')} | {txn['description'][:40]}... | ${txn['amount']}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
