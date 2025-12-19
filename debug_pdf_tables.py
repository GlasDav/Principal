import pdfplumber

file_path = "Test Statement.pdf"

print(f"--- Extracting tables from {file_path} ---")
try:
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages):
            print(f"--- Page {i+1} ---")
            tables = page.extract_tables()
            for table in tables:
                print("Table found:")
                for row in table:
                    # Print row, replacing None with "" for readability
                    clean_row = [str(cell) if cell else "" for cell in row]
                    print(clean_row)
            print("\n")
except Exception as e:
    print(f"Error: {e}")
