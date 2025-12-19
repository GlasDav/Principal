from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Float, ForeignKey
from backend.database import SQLALCHEMY_DATABASE_URL

def migrate():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    metadata = MetaData()

    # Define the table
    investment_holdings = Table(
        'investment_holdings', metadata,
        Column('id', Integer, primary_key=True, index=True),
        Column('account_id', Integer, ForeignKey("accounts.id")),
        Column('ticker', String),
        Column('name', String),
        Column('quantity', Float),
        Column('price', Float),
        Column('cost_basis', Float, nullable=True),
        Column('value', Float)
    )

    print("Starting Holdings Migration...")
    try:
        metadata.create_all(engine)
        print("Created investment_holdings table.")
    except Exception as e:
        print(f"Error creating table: {e}")
    
    print("Migration Complete.")

if __name__ == "__main__":
    migrate()
