import sqlite3
import os

DB_PATH = '/opt/omni_seo/backend/campaigns.db'

def init_db():
    print(f"Initializing database at: {DB_PATH}")
    # Ensure directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create campaigns table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL,
            keyword TEXT NOT NULL,
            duration INTEGER NOT NULL,
            prompt TEXT,
            status TEXT DEFAULT 'queued',
            progress INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            artifact_html TEXT,
            backlinks_count INTEGER DEFAULT 0,
            tech_stack TEXT DEFAULT 'unknown',
            audit_only INTEGER DEFAULT 0,
            scraped_leads TEXT DEFAULT '[]'
        )
    ''')
    
    # Create campaign_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS campaign_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER,
            progress INTEGER,
            task TEXT,
            message TEXT,
            class_name TEXT,
            task_status TEXT,
            artifact TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    conn.close()
    print("Database initialized successfully.")

if __name__ == '__main__':
    init_db()
