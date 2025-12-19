from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
import yfinance as yf

router = APIRouter(
    prefix="/market",
    tags=["market"],
)

class TickerSearchResult(BaseModel):
    symbol: str
    shortname: Optional[str] = None
    exchange: Optional[str] = None
    type: Optional[str] = None
    currency: Optional[str] = None

class TickerQuote(BaseModel):
    symbol: str
    price: float
    currency: str
    exchange_rate: float

@router.get("/search", response_model=List[TickerSearchResult])
def search_tickers(q: str = Query(..., min_length=1)):
    try:
        # yfinance doesn't have a direct "search" method exposing the internal API clearly in 0.2.x without private methods or scraping.
        # However, Ticker object doesn't search. 
        # A common workaround is using the yahoo query API directly or a lightweight wrapper.
        # But for 'yfinance', we might need to rely on the user knowing the symbol or use a helper.
        # WAIT: yfinance Ticker("AAPL").info is for specific.
        # To SEARCH, we can use the undocumented Yahoo API or just let the frontend send partial queries if we had a local DB.
        # Actually, let's use a public Yahoo Finance autocomplete endpoint for search, which is what most tools do.
        import requests
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={q}"
        resp = requests.get(url, headers=headers)
        data = resp.json()
        
        results = []
        if 'quotes' in data:
            for item in data['quotes']:
                if not item.get('symbol'): continue
                results.append(TickerSearchResult(
                    symbol=item['symbol'],
                    shortname=item.get('shortname') or item.get('longname') or item['symbol'],
                    exchange=item.get('exchange'),
                    type=item.get('quoteType'),
                    currency=None # API doesn't always return currency in search, we get it in quote
                ))
        return results
    except Exception as e:
        print(f"Search Error: {e}")
        return []

@router.get("/quote", response_model=TickerQuote)
def get_quote(ticker: str):
    try:
        t = yf.Ticker(ticker)
        # fast_info is faster than info dict
        info = t.fast_info
        
        # Current price
        price = info.last_price
        if price is None:
             # Fallback
             price = t.info.get('regularMarketPrice') or t.info.get('currentPrice') or 0.0

        currency = t.fast_info.currency
        
        rate = 1.0
        if currency and currency != 'USD':
            # fetch FX
            # pair e.g. EURUSD=X
            fx_symbol = f"{currency}USD=X"
            fx = yf.Ticker(fx_symbol)
            rate = fx.fast_info.last_price
            if not rate:
                 rate = fx.info.get('regularMarketPrice') or 1.0
                 
        return TickerQuote(
            symbol=ticker,
            price=price,
            currency=currency,
            exchange_rate=rate
        )
            
    except Exception as e:
        print(f"Quote Error: {e}")
        raise HTTPException(status_code=404, detail="Could not fetch quote data")
