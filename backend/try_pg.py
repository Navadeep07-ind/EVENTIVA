import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

passwords = ["", "postgres", "password", "root", "admin", "1234", "123456"]

for p in passwords:
    try:
        conn = psycopg2.connect(user="postgres", password=p, host="localhost", port="5432")
        print(f"Success with password: '{p}'")
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        cursor.execute("CREATE DATABASE eventiva;")
        print("Database eventiva created.")
        cursor.close()
        conn.close()
        break
    except Exception as e:
        pass
