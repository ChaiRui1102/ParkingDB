from flask import Flask, jsonify, render_template, request
import mysql.connector
import math
import requests
import json

app = Flask(__name__)  # ← THIS must be declared before @app.route

# === MySQL Connection ===
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="114514",         # Replace this
    database="parking_tickets"
)

@app.route("/")
def map_view():
    return render_template("index.html")

@app.route("/api/citations")
def get_citations():
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT latitude, longitude, location
        FROM citations
        WHERE latitude BETWEEN 33 AND 35
          AND longitude BETWEEN -119 AND -117
        LIMIT 500;
    """)
    results = cursor.fetchall()
    cursor.close()
    return jsonify(results)

def haversine_sql(lat, lng, radius_km=0.5):
    # Haversine distance formula in SQL (approximate)
    return f"""
        SELECT latitude, longitude, location,
        (6371 * acos(
            cos(radians({lat})) *
            cos(radians(latitude)) *
            cos(radians(longitude) - radians({lng})) +
            sin(radians({lat})) *
            sin(radians(latitude))
        )) AS distance_km
        FROM citations
        HAVING distance_km < {radius_km}
        ORDER BY distance_km
        LIMIT 100;
    """


API_KEY = "YOUR_GOOGLE_API_KEY"  # Replace with your actual key

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


@app.route("/api/search")
def search_by_address():
    address = request.args.get("address")
    if not address:
        return jsonify({"error": "Address required"}), 400

    lat, lng = geocode_address(address)  # Reuse your existing geocode function

    if not lat or not lng:
        return jsonify({"error": "Could not geocode address"}), 404

    cursor = db.cursor(dictionary=True)
    cursor.execute(haversine_sql(lat, lng))
    results = cursor.fetchall()
    cursor.close()
    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True)
