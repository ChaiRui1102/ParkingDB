from flask import Flask, jsonify, render_template
import mysql.connector

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

if __name__ == '__main__':
    app.run(debug=True)
