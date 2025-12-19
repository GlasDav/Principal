import pdfplumber

file_path = "Test Statement.pdf"

print(f"--- Extracting words from {file_path} ---")
try:
    with pdfplumber.open(file_path) as pdf:
        page = pdf.pages[1] # Use Page 2 as it has clear transactions
        words = page.extract_words()
        
        print("--- HEADER SEARCH ---")
        for word in words:
            if word['text'] in ['Date', 'Debits', 'Credits', 'Balance']:
                print(f"Word: {word['text']}, x0: {word['x0']}, top: {word['top']}")
        
        print("\n--- FIRST FEW ROWS ---")
        # Print first 50 words to see structure
        for word in words[:50]:
             print(f"'{word['text']}' @ x={word['x0']:.2f}, y={word['top']:.2f}")

except Exception as e:
    print(f"Error: {e}")
