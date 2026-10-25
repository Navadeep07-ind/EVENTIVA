import sqlite3
import secrets
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "eventiva.db")

def migrate():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Check existing columns in 'registrations'
    cursor.execute("PRAGMA table_info(registrations)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"Existing columns in registrations: {columns}")

    # 2. Add 'ticket_code' if not present
    if "ticket_code" not in columns:
        print("Adding column 'ticket_code' to registrations...")
        cursor.execute("ALTER TABLE registrations ADD COLUMN ticket_code VARCHAR")
    
    # 3. Add 'checked_in' if not present
    if "checked_in" not in columns:
        print("Adding column 'checked_in' to registrations...")
        cursor.execute("ALTER TABLE registrations ADD COLUMN checked_in BOOLEAN DEFAULT 0")

    # 4. Add 'checked_in_at' if not present
    if "checked_in_at" not in columns:
        print("Adding column 'checked_in_at' to registrations...")
        cursor.execute("ALTER TABLE registrations ADD COLUMN checked_in_at DATETIME")

    # 5. Create unique index on ticket_code
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_ticket_code ON registrations(ticket_code)")

    # 6. Backfill existing registrations where ticket_code IS NULL
    cursor.execute("SELECT id, email FROM registrations WHERE ticket_code IS NULL")
    missing_tickets = cursor.fetchall()
    print(f"Found {len(missing_tickets)} existing registrations needing ticket codes.")

    existing_codes = set(row[0] for row in cursor.execute("SELECT ticket_code FROM registrations WHERE ticket_code IS NOT NULL").fetchall())

    for reg_id, email in missing_tickets:
        while True:
            code = f"EVT-{secrets.token_hex(4).upper()}"
            if code not in existing_codes:
                existing_codes.add(code)
                break
        cursor.execute("UPDATE registrations SET ticket_code = ?, checked_in = 0 WHERE id = ?", (code, reg_id))
        print(f"  Assigned ticket_code={code} to registration id={reg_id} ({email})")

    conn.commit()
    conn.close()
    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()
