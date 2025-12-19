from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import settings, ingestion, transactions, analytics, net_worth, auth, market

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Principal Finance API")

# CORS setup for frontend
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings.router)
app.include_router(ingestion.router)
app.include_router(transactions.router)
app.include_router(analytics.router)
app.include_router(net_worth.router)
app.include_router(market.router)

app.include_router(auth.router)
from .routers import rules
app.include_router(rules.router)
from .routers import goals
app.include_router(goals.router)
from .routers import taxes
app.include_router(taxes.router)
from .routers import connections
app.include_router(connections.router)
from .routers import investments
app.include_router(investments.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Principal API"}
