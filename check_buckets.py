"""Check if any transactions are categorized to Salaries bucket"""
import sqlite3

conn = sqlite3.connect('principal_v5.db')
cur = conn.cursor()

# Find the Salaries bucket
cur.execute("""
    SELECT id, name, "group", parent_id
    FROM budget_buckets 
    WHERE user_id=1 AND name LIKE '%Salar%'
""")
print("Salaries bucket:")
salaries_bucket = cur.fetchone()
if salaries_bucket:
    print(f"  ID={salaries_bucket[0]}, Name='{salaries_bucket[1]}', Group='{salaries_bucket[2]}', Parent={salaries_bucket[3]}")
    
    # Check for transactions in this bucket
    cur.execute("""
        SELECT COUNT(*), SUM(amount)
        FROM transactions
        WHERE user_id=1 AND bucket_id=?
    """, (salaries_bucket[0],))
    result = cur.fetchone()
    print(f"  Transactions: {result[0]}, Total amount: {result[1]}")
else:
    print("  No Salaries bucket found!")

# Check Income parent bucket
cur.execute("""
    SELECT id, name
    FROM budget_buckets 
    WHERE user_id=1 AND name = 'Income' AND parent_id IS NULL
""")
income_parent = cur.fetchone()
if income_parent:
    print(f"\nIncome parent bucket ID: {income_parent[0]}")
    
    # List all children of Income parent
    cur.execute("""
        SELECT id, name, "group"
        FROM budget_buckets 
        WHERE parent_id=?
    """, (income_parent[0],))
    print("Children of Income parent:")
    for row in cur.fetchall():
        print(f"  ID={row[0]}, Name='{row[1]}', Group='{row[2]}'")

conn.close()
