
import os

files = ["debug_test.txt", "error.txt", "payload_result.txt"]

for f in files:
    if os.path.exists(f):
        print(f"--- CONTENT OF {f} ---")
        try:
            # Try reading as utf-16
            with open(f, "r", encoding="utf-16") as file:
                print(file.read())
        except Exception as e:
            print(f"Failed to read as utf-16: {e}")
            try:
                # Try utf-8
                with open(f, "r", encoding="utf-8") as file:
                    print(file.read())
            except Exception as e2:
                print(f"Failed to read as utf-8: {e2}")
        print("\n\n")
