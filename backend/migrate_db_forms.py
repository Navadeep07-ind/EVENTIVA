from app.database import engine
from sqlalchemy import text

with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE events ADD COLUMN form_schema JSON"))
        print("Successfully added form_schema to events")
    except Exception as e:
        print("events alter failed:", e)

    try:
        conn.execute(text("ALTER TABLE registrations ADD COLUMN custom_answers JSON"))
        print("Successfully added custom_answers to registrations")
    except Exception as e:
        print("registrations alter failed:", e)
