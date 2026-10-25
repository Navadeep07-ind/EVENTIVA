import sqlite3
from app.database import engine, Base
from app import models

def migrate():
    con = sqlite3.connect('eventiva.db')
    cur = con.cursor()
    existing_cols = [c[1] for c in cur.execute('PRAGMA table_info(branding_kits)').fetchall()]
    new_cols = [
        ('institution_id', 'INTEGER'),
        ('status', "VARCHAR DEFAULT 'Discovered'"),
        ('version', 'INTEGER DEFAULT 1'),
        ('is_public', 'BOOLEAN DEFAULT 1'),
        ('description', 'TEXT'),
        ('updated_at', 'DATETIME')
    ]
    for col_name, col_type in new_cols:
        if col_name not in existing_cols:
            print(f'Adding column {col_name}')
            cur.execute(f'ALTER TABLE branding_kits ADD COLUMN {col_name} {col_type}')
    con.commit()
    con.close()

    models.Base.metadata.create_all(bind=engine)
    print('All tables and columns migrated successfully!')

if __name__ == '__main__':
    migrate()
