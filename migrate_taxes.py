from backend.database import engine
from backend.models import TaxSettings

print("Creating TaxSettings table...")
TaxSettings.metadata.create_all(bind=engine)
print("Done.")
