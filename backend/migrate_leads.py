import sqlite3
import os

DB_PATH = '/opt/omni_seo/backend/campaigns.db'

def migrate():
    print(f"Migrating database at: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("Database file does not exist yet. Running init_db first.")
        # Try to locate init_db
        try:
            from init_db import init_db
            init_db()
        except ImportError:
            print("Could not import init_db. Exiting.")
            return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE campaigns ADD COLUMN scraped_leads TEXT DEFAULT '[]';")
        conn.commit()
        print("Successfully added scraped_leads column to campaigns table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
            print("Column scraped_leads already exists.")
        else:
            print(f"Operational error: {e}")
    conn.close()

if __name__ == '__main__':
    migrate()
