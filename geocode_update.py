import mysql.connector
import requests
import time

# === CONFIG ===
API_KEY = "YOUR_GOOGLE_API_KEY"  # Replace this
DB_PASSWORD = "114514"    # Replace this

db = mysql.connector.connect(
    host="localhost",
    user="root",
    password=DB_PASSWORD,
    database="parking_tickets"
)

def clean_address(location):
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

cursor.execute("SELECT ticket_number, location FROM citations WHERE latitude >= 90 OR latitude = 99999 LIMIT 50")
rows = cursor.fetchall()

if not rows:
    print("All records are already geocoded. Nothing to do.")
else:
    print(f"Updating {len(rows)} rows...")

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
        time.sleep(0.2)
    else:
        print(" [!] No location provided.")

cursor.close()
db.close()
