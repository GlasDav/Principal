from sqlalchemy import create_engine, text
from backend.database import SQLALCHEMY_DATABASE_URL

def migrate():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        print("Starting Holdings V2 Migration (FX Support)...")
        
        # 1. Add currency
        try:
            conn.execute(text("ALTER TABLE investment_holdings ADD COLUMN currency VARCHAR DEFAULT 'USD'"))
            print("Added currency to investment_holdings")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column currency already exists.")
            else:
                print(f"Warning adding currency: {e}")

        # 2. Add exchange_rate
        try:
            conn.execute(text("ALTER TABLE investment_holdings ADD COLUMN exchange_rate FLOAT DEFAULT 1.0"))
            print("Added exchange_rate to investment_holdings")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column exchange_rate already exists.")
            else:
                print(f"Warning adding exchange_rate: {e}")
            
        conn.commit()
        print("Migration Complete.")

if __name__ == "__main__":
    migrate()
