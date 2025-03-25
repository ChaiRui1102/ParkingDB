import mysql.connector
import requests
import time

# === CONFIG ===
API_KEY = "AIzaSyBvO5uwwjJJc_l9S5fczHysFuko_Ji0v_4"  # ← Replace this
DB_PASSWORD = "114514"    # ← Replace this

db = mysql.connector.connect(
    host="localhost",
    user="root",
    password=DB_PASSWORD,
    database="parking_tickets"
)

def clean_address(location):
    """Convert vague or intersection addresses to clearer format."""
    location = location.strip()
    if "/" in location:
        parts = location.split("/")
        if len(parts) == 2:
            return f"{parts[0].strip()} ST & {parts[1].strip()} ST"
    return location

def geocode_address(address):
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": address + ", Los Angeles, CA",
        "key": API_KEY
    }
    response = requests.get(url, params=params).json()

    if response["status"] == "OK":
        location = response["results"][0]["geometry"]["location"]
        return location["lat"], location["lng"]
    return None, None

cursor = db.cursor()

# Get entries with placeholder coordinates
cursor.execute("""
    SELECT latitude, longitude, location
    FROM citations
    WHERE latitude BETWEEN 33 AND 35
      AND longitude BETWEEN -119 AND -117
    LIMIT 500;
""")



rows = cursor.fetchall()

for ticket_number, raw_location in rows:
    if raw_location:
        cleaned = clean_address(raw_location)
        print(f"Geocoding: {cleaned}")
        lat, lng = geocode_address(cleaned)
        if lat and lng:
            print(f" → {lat}, {lng}")
            cursor.execute(
                "UPDATE citations SET latitude = %s, longitude = %s WHERE ticket_number = %s",
                (lat, lng, ticket_number)
            )
            db.commit()
        else:
            print(f" [!] Failed: {cleaned}")
        time.sleep(0.2)  # Be kind to the API
    else:
        print(" [!] No location provided.")

cursor.close()
db.close()
