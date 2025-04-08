from flask import Flask, jsonify, render_template, request, send_from_directory
import mysql.connector
import requests
import json
import secrets
from datetime import datetime

app = Flask(__name__)

# === Config ===
API_KEY = "YOUR_NEW_API_KEY"  # Replace with your actual key

def geocode_address(address):
    if not address:
        return None, None
        
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": address,  # Don't add Los Angeles - let user search anywhere
        "key": API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if data["status"] == "OK" and data["results"]:
            location = data["results"][0]["geometry"]["location"]
            return location["lat"], location["lng"]
        else:
            print(f"Geocoding failed: {data.get('status', 'Unknown error')}")
            print(f"For address: {address}")
            return None, None
    except Exception as e:
        print(f"Exception during geocoding: {str(e)}")
        return None, None

# === Database Connection ===
def get_db_connection():
    return mysql.connector.connect(
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
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    
    query = """
        SELECT 
            ticket_number as id,
            issue_date,
            issue_time,
            rp_state_plate as state,
            plate_expiry,
            make,
            body_style,
            color,
            location,
            latitude, 
            longitude,
            violation_code as description,
            fine_amount,
            'citation' as data_type
        FROM citations
        WHERE latitude BETWEEN 33 AND 35
          AND longitude BETWEEN -119 AND -117
        LIMIT 1000;
    """
    
    try:
        cursor.execute(query)
        results = cursor.fetchall()
        print(f"Retrieved {len(results)} citations")
    except mysql.connector.Error as e:
        print(f"Database error getting citations: {e}")
        results = []
    
    cursor.close()
    db.close()
    return jsonify(results)

@app.route("/api/crimes")
def get_crimes():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    
    # First, check if the crimes table exists
    cursor.execute("SHOW TABLES LIKE 'crimes'")
    if not cursor.fetchone():
        cursor.close()
        db.close()
        return jsonify([])  # Return empty array if table doesn't exist
    
    query = """
        SELECT 
            crime_id as id,
            crime_code,
            crime_desc as description,
            occurred_date as datetime,
            location_text as location,
            latitude, 
            longitude,
            'crime' as data_type
        FROM crimes
        WHERE latitude BETWEEN 33 AND 35
          AND longitude BETWEEN -119 AND -117
        LIMIT 1000;
    """
    
    try:
        cursor.execute(query)
        results = cursor.fetchall()
        print(f"Retrieved {len(results)} crimes")
    except mysql.connector.Error as e:
        print(f"Database error getting crimes: {e}")
        results = []
    
    cursor.close()
    db.close()
    return jsonify(results)

@app.route("/api/user-reports")
def get_user_reports():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    
    # First, check if the user_reports table exists
    cursor.execute("SHOW TABLES LIKE 'user_reports'")
    if not cursor.fetchone():
        cursor.close()
        db.close()
        return jsonify([])  # Return empty array if table doesn't exist
    
    query = """
        SELECT 
            id,
            issue_date,
            plate,
            state,
            make,
            model,
            body_style,
            color,
            violation_code,
            violation_desc as description,
            fine_amount,
            location,
            latitude, 
            longitude,
            'user_report' as data_type
        FROM user_reports
        WHERE latitude BETWEEN 33 AND 35
          AND longitude BETWEEN -119 AND -117
        LIMIT 1000;
    """
    
    try:
        cursor.execute(query)
        results = cursor.fetchall()
        print(f"Retrieved {len(results)} user reports")
    except mysql.connector.Error as e:
        print(f"Database error getting user reports: {e}")
        results = []
    
    cursor.close()
    db.close()
    return jsonify(results)

@app.route("/api/all-data")
def get_all_data():
    # Get data from all three sources
    citations = []
    crimes = []
    user_reports = []
    
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    
    # Get citations
    citation_query = """
        SELECT 
            ticket_number as id,
            issue_date,
            issue_time,
            rp_state_plate as state,
            plate_expiry,
            make,
            body_style,
            color,
            location,
            latitude, 
            longitude,
            violation_code as description,
            fine_amount,
            'citation' as data_type
        FROM citations
        WHERE latitude BETWEEN 33 AND 35
          AND longitude BETWEEN -119 AND -117
        LIMIT 1000;
    """
    
    try:
        cursor.execute(citation_query)
        citations = cursor.fetchall()
        print(f"Retrieved {len(citations)} citations for all-data")
    except mysql.connector.Error as e:
        print(f"Database error getting citations: {e}")
    
    # Check if crimes table exists before querying
    cursor.execute("SHOW TABLES LIKE 'crimes'")
    if cursor.fetchone():
        crime_query = """
            SELECT 
                crime_id as id,
                crime_code,
                crime_desc as description,
                occurred_date as datetime,
                location_text as location,
                latitude, 
                longitude,
                'crime' as data_type
            FROM crimes
            WHERE latitude BETWEEN 33 AND 35
              AND longitude BETWEEN -119 AND -117
            LIMIT 1000;
        """
        
        try:
            cursor.execute(crime_query)
            crimes = cursor.fetchall()
            print(f"Retrieved {len(crimes)} crimes for all-data")
        except mysql.connector.Error as e:
            print(f"Database error getting crimes: {e}")
    
    # Check if user_reports table exists before querying
    cursor.execute("SHOW TABLES LIKE 'user_reports'")
    if cursor.fetchone():
        user_report_query = """
            SELECT 
                id,
                issue_date,
                plate,
                state,
                make,
                model,
                body_style,
                color,
                violation_code,
                violation_desc as description,
                fine_amount,
                location,
                latitude, 
                longitude,
                'user_report' as data_type
            FROM user_reports
            WHERE latitude BETWEEN 33 AND 35
              AND longitude BETWEEN -119 AND -117
            LIMIT 1000;
        """
        
        try:
            cursor.execute(user_report_query)
            user_reports = cursor.fetchall()
            print(f"Retrieved {len(user_reports)} user reports for all-data")
        except mysql.connector.Error as e:
            print(f"Database error getting user reports: {e}")
    
    cursor.close()
    db.close()
    
    # Combine all data
    all_data = {
        "citations": citations,
        "crimes": crimes,
        "user_reports": user_reports
    }
    
    return jsonify(all_data)

@app.route("/api/search")
def search_by_address():
    address = request.args.get("address")
    data_types = request.args.get("types", "citations,crimes,user_reports").split(",")
    
    if not address:
        return jsonify({"error": "Address required"}), 400

    lat, lng = geocode_address(address)
    if not lat or not lng:
        return jsonify({"error": "Could not geocode address"}), 404

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    results = {"citations": [], "crimes": [], "user_reports": []}
    
    # Search citations if requested
    if "citations" in data_types:
        query = f"""
            SELECT 
                ticket_number as id,
                issue_date,
                issue_time,
                rp_state_plate as state,
                plate_expiry,
                make,
                body_style,
                color,
                location,
                latitude, 
                longitude,
                violation_code as description,
                fine_amount,
                (6371 * acos(
                    cos(radians({lat})) *
                    cos(radians(latitude)) *
                    cos(radians(longitude) - radians({lng})) +
                    sin(radians({lat})) *
                    sin(radians(latitude))
                )) AS distance_km,
                'citation' as data_type
            FROM citations
            HAVING distance_km < 1.0
            ORDER BY distance_km
            LIMIT 100;
        """
        
        try:
            cursor.execute(query)
            results["citations"] = cursor.fetchall()
        except mysql.connector.Error as e:
            print(f"Error searching citations: {e}")
    
    # Search crimes if requested
    if "crimes" in data_types:
        # Check if crimes table exists first
        cursor.execute("SHOW TABLES LIKE 'crimes'")
        if cursor.fetchone():
            query = f"""
                SELECT 
                    crime_id as id,
                    crime_code,
                    crime_desc as description,
                    occurred_date as datetime,
                    location_text as location,
                    latitude, 
                    longitude,
                    (6371 * acos(
                        cos(radians({lat})) *
                        cos(radians(latitude)) *
                        cos(radians(longitude) - radians({lng})) +
                        sin(radians({lat})) *
                        sin(radians(latitude))
                    )) AS distance_km,
                    'crime' as data_type
                FROM crimes
                HAVING distance_km < 1.0
                ORDER BY distance_km
                LIMIT 100;
            """
            
            try:
                cursor.execute(query)
                results["crimes"] = cursor.fetchall()
            except mysql.connector.Error as e:
                print(f"Error searching crimes: {e}")
    
    # Search user reports if requested
    if "user_reports" in data_types:
        # Check if user_reports table exists first
        cursor.execute("SHOW TABLES LIKE 'user_reports'")
        if cursor.fetchone():
            query = f"""
                SELECT 
                    id,
                    issue_date,
                    plate,
                    state,
                    make,
                    model,
                    body_style,
                    color,
                    violation_code,
                    violation_desc as description,
                    fine_amount,
                    location,
                    latitude, 
                    longitude,
                    (6371 * acos(
                        cos(radians({lat})) *
                        cos(radians(latitude)) *
                        cos(radians(longitude) - radians({lng})) +
                        sin(radians({lat})) *
                        sin(radians(latitude))
                    )) AS distance_km,
                    'user_report' as data_type
                FROM user_reports
                HAVING distance_km < 1.0
                ORDER BY distance_km
                LIMIT 100;
            """
            
            try:
                cursor.execute(query)
                results["user_reports"] = cursor.fetchall()
            except mysql.connector.Error as e:
                print(f"Error searching user reports: {e}")
    
    cursor.close()
    db.close()
    
    # Flatten results if all types are requested
    if len(data_types) == 3:
        flat_results = []
        for data_type in results:
            flat_results.extend(results[data_type])
        return jsonify(flat_results)
    
    return jsonify(results)

@app.route("/api/geocode")
def geocode_only():
    address = request.args.get("address")
    if not address:
        return jsonify({"error": "No address provided"}), 400

    try:
        lat, lng = geocode_address(address)
        if not lat or not lng:
            return jsonify({"error": "Could not geocode address"}), 404

        return jsonify({"lat": lat, "lng": lng})
    except Exception as e:
        print(f"Geocoding error: {e}")
        return jsonify({"error": str(e)}), 500

# === User Report CRUD Endpoints ===

@app.route("/api/user-reports", methods=["POST"])
def create_user_report():
    data = request.json
    
    # Validate required fields
    required_fields = ["location", "violation_desc", "fine_amount"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    # Generate edit key
    data["edit_key"] = secrets.token_hex(32)
    
    # Geocode address if lat/lng not provided
    if "latitude" not in data or "longitude" not in data:
        lat, lng = geocode_address(data["location"])
        if not lat or not lng:
            return jsonify({"error": "Could not geocode location"}), 400
        data["latitude"] = lat
        data["longitude"] = lng
    
    # Set default datetime if not provided
    if "issue_date" not in data:
        data["issue_date"] = datetime.now().strftime("%Y-%m-%d")
    
    # Insert into database
    db = get_db_connection()
    cursor = db.cursor()
    
    # Check if user_reports table exists and create if it doesn't
    cursor.execute("SHOW TABLES LIKE 'user_reports'")
    if not cursor.fetchone():
        create_query = """
        CREATE TABLE user_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            edit_key VARCHAR(64),
            issue_date DATE,
            plate VARCHAR(20),
            state VARCHAR(10),
            make VARCHAR(50),
            model VARCHAR(50),
            body_style VARCHAR(20),
            color VARCHAR(30),
            violation_code VARCHAR(20),
            violation_desc TEXT,
            fine_amount DECIMAL(10, 2),
            location VARCHAR(255),
            latitude DOUBLE,
            longitude DOUBLE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        try:
            cursor.execute(create_query)
            db.commit()
            print("Created user_reports table")
        except mysql.connector.Error as e:
            cursor.close()
            db.close()
            return jsonify({"error": f"Error creating user_reports table: {str(e)}"}), 500
    
    fields = ", ".join(data.keys())
    placeholders = ", ".join(["%s"] * len(data))
    
    query = f"INSERT INTO user_reports ({fields}) VALUES ({placeholders})"
    
    try:
        cursor.execute(query, list(data.values()))
        report_id = cursor.lastrowid
        db.commit()
    except mysql.connector.Error as e:
        cursor.close()
        db.close()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    
    cursor.close()
    db.close()
    
    return jsonify({
        "message": "Report created successfully", 
        "report_id": report_id,
        "edit_key": data["edit_key"]
    }), 201

@app.route("/api/user-reports/<int:report_id>", methods=["GET"])
def get_user_report(report_id):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    
    cursor.execute("SELECT * FROM user_reports WHERE id = %s", (report_id,))
    report = cursor.fetchone()
    
    cursor.close()
    db.close()
    
    if not report:
        return jsonify({"error": "Report not found"}), 404
    
    # Remove edit_key from response for security
    if "edit_key" in report:
        del report["edit_key"]
    
    return jsonify(report)

@app.route("/api/user-reports/<int:report_id>", methods=["PUT"])
def update_user_report(report_id):
    data = request.json
    edit_key = request.headers.get("X-Edit-Key")
    
    if not edit_key:
        return jsonify({"error": "Edit key required"}), 400
    
    # Verify edit key
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    
    cursor.execute("SELECT edit_key FROM user_reports WHERE id = %s", (report_id,))
    result = cursor.fetchone()
    
    if not result or result["edit_key"] != edit_key:
        cursor.close()
        db.close()
        return jsonify({"error": "Invalid edit key"}), 403
    
    # Don't allow updating the edit_key
    if "edit_key" in data:
        del data["edit_key"]
    
    # Geocode address if location was updated
    if "location" in data and ("latitude" not in data or "longitude" not in data):
        lat, lng = geocode_address(data["location"])
        if lat and lng:
            data["latitude"] = lat
            data["longitude"] = lng
    
    # Update database
    if data:
        # Build SET clause for SQL
        set_clause = ", ".join([f"{key} = %s" for key in data.keys()])
        values = list(data.values())
        values.append(report_id)  # For the WHERE clause
        
        query = f"UPDATE user_reports SET {set_clause} WHERE id = %s"
        
        try:
            cursor.execute(query, values)
            db.commit()
        except mysql.connector.Error as e:
            cursor.close()
            db.close()
            return jsonify({"error": f"Database error: {str(e)}"}), 500
    
    cursor.close()
    db.close()
    
    return jsonify({"message": "Report updated successfully"})

@app.route("/api/user-reports/<int:report_id>", methods=["DELETE"])
def delete_user_report(report_id):
    edit_key = request.headers.get("X-Edit-Key")
    
    if not edit_key:
        return jsonify({"error": "Edit key required"}), 400
    
    # Verify edit key
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    
    cursor.execute("SELECT edit_key FROM user_reports WHERE id = %s", (report_id,))
    result = cursor.fetchone()
    
    if not result or "edit_key" not in result or result["edit_key"] != edit_key:
        cursor.close()
        db.close()
        return jsonify({"error": "Invalid edit key"}), 403
    
    # Delete the report
    try:
        cursor.execute("DELETE FROM user_reports WHERE id = %s", (report_id,))
        db.commit()
    except mysql.connector.Error as e:
        cursor.close()
        db.close()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    
    cursor.close()
    db.close()
    
    return jsonify({"message": "Report deleted successfully"})

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    app.run(debug=True)