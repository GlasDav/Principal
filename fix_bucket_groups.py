"""
Fix legacy user buckets where child buckets don't have the correct group inherited from parent.
"""
import sqlite3

def migrate():
    db_path = "principal_v5.db"
    print(f"Fixing legacy bucket groups in: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Find all parent buckets and their groups
    cur.execute("""
        SELECT id, name, "group" 
        FROM budget_buckets 
        WHERE parent_id IS NULL
    """)
    parents = {row[0]: (row[1], row[2]) for row in cur.fetchall()}
    
    # Update children to match parent's group
    fixed_count = 0
    for parent_id, (parent_name, parent_group) in parents.items():
        cur.execute("""
            UPDATE budget_buckets 
            SET "group" = ?
            WHERE parent_id = ? AND "group" != ?
        """, (parent_group, parent_id, parent_group))
        fixed_count += cur.rowcount
    
    conn.commit()
    
    # Show Income buckets after fix
    cur.execute("""
        SELECT id, name, "group", parent_id
        FROM budget_buckets 
        WHERE "group" = 'Income'
    """)
    print("\nIncome group buckets after fix:")
    for row in cur.fetchall():
        print(f"  ID={row[0]}, Name='{row[1]}', Group='{row[2]}', Parent={row[3]}")
    
    conn.close()
    print(f"\nFixed {fixed_count} child buckets to inherit parent group.")

if __name__ == "__main__":
    migrate()
