from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def create_dummy_statement(filename, transactions):
    c = canvas.Canvas(filename, pagesize=letter)
    c.drawString(50, 750, "Bank of Principal Statement")
    c.drawString(50, 730, "Date             Description (Details)                           Amount")
    c.line(50, 725, 550, 725)
    
    y = 700
    for txn in transactions:
        # Construct line explicitly to match parser zones
        # Date < 90, Desc 90-400, Debit 400-460
        date_str = txn['date']
        desc_str = txn['desc']
        amt_str = txn['amount']
        
        c.drawString(50, y, date_str) 
        c.drawString(100, y, desc_str) 
        c.drawString(410, y, amt_str) # Debit Zone
        
        y -= 20
        
    c.save()

transactions = [
    {"date": "01 Jan", "desc": "COLES SUPERMARKET BOND", "amount": "-45.00"},
    {"date": "02 Jan", "desc": "UBER TRIP SYDNEY AU", "amount": "-18.50"},
    {"date": "03 Jan", "desc": "NETFLIX RECURRING", "amount": "-12.99"},
    {"date": "04 Jan", "desc": "ANYTIME FITNESS GYM", "amount": "-55.00"}
]

create_dummy_statement("dummy_statement.pdf", transactions)
print("Created dummy_statement.pdf")
