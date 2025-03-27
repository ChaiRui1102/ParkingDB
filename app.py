from flask import Flask, jsonify, render_template, request, send_from_directory
import mysql.connector
import requests

app = Flask(__name__)

# === Config ===
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

# === Database Connection ===
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="114514",  # Replace this
    database="parking_tickets"
)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/citations")
def get_citations():
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT latitude, longitude, location
        FROM citations
        WHERE latitude BETWEEN 33 AND 35
          AND longitude BETWEEN -119 AND -117
        LIMIT 1000;
    """)
    results = cursor.fetchall()
    cursor.close()
    return jsonify(results)

@app.route("/api/search")
def search_by_address():
    address = request.args.get("address")
    if not address:
        return jsonify({"error": "Address required"}), 400

    lat, lng = geocode_address(address)
    if not lat or not lng:
        return jsonify({"error": "Could not geocode address"}), 404

    query = f"""
        SELECT latitude, longitude, location,
        (6371 * acos(
            cos(radians({lat})) *
            cos(radians(latitude)) *
            cos(radians(longitude) - radians({lng})) +
            sin(radians({lat})) *
            sin(radians(latitude))
        )) AS distance_km
        FROM citations
        HAVING distance_km < 1.0
        ORDER BY distance_km
        LIMIT 100;
    """

    cursor = db.cursor(dictionary=True)
    cursor.execute(query)
    results = cursor.fetchall()
    cursor.close()
    return jsonify(results)

@app.route("/api/geocode")
def geocode_only():
    address = request.args.get("address")
    if not address:
        return jsonify({"error": "No address provided"}), 400

    lat, lng = geocode_address(address)
    if not lat or not lng:
        return jsonify({"error": "Could not geocode address"}), 404

    return jsonify({"lat": lat, "lng": lng})

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    app.run(debug=True)
