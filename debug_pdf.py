import pdfplumber

file_path = "Test Statement.pdf"

print(f"--- Extracting text from {file_path} ---")
try:
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages):
            print(f"--- Page {i+1} ---")
            text = page.extract_text()
            if text:
                print(text)
            else:
                print("[No text extracted]")
            print("\n")
except Exception as e:
    print(f"Error: {e}")
