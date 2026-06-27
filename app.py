import os
import pickle
import numpy as np
import math
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")


def load_model(filename):
    path = os.path.join(MODEL_DIR, filename)
    with open(path, "rb") as f:
        return pickle.load(f)


def engineer_features(data):
    """Replicate exactly the feature engineering used during training."""
    hour = int(data["hour"])
    day_of_week = data["day_of_week"]
    weather = data["weather"]
    road_type = data["road_type"]
    temperature = float(data["temperature"])
    humidity = float(data["humidity"])
    wind_speed = float(data["wind_speed"])
    visibility = float(data["visibility"])
    is_weekend = 1 if str(data["is_weekend"]).lower() in ("1", "yes", "true") else 0
    average_speed = float(data["average_speed"])
    traffic_volume = float(data["traffic_volume"])

    # Rush hour: 7–10 and 17–20
    is_rush_hour = 1 if (7 <= hour <= 10) or (17 <= hour <= 20) else 0

    # Night: <=5 or >=22
    is_night = 1 if hour <= 5 or hour >= 22 else 0

    # Cyclic encoding of hour
    hour_sin = math.sin(2 * math.pi * hour / 24)
    hour_cos = math.cos(2 * math.pi * hour / 24)

    # Encoders
    weather_encoder = load_model("weather_encoder.pkl")
    road_encoder = load_model("road_encoder.pkl")
    day_encoder = load_model("day_encoder.pkl")

    day_enc = day_encoder.transform([day_of_week])[0]
    weather_enc = weather_encoder.transform([weather])[0]
    road_enc = road_encoder.transform([road_type])[0]

    # Weather severity mapping
    weather_severity_map = {
        "Clear": 0,
        "Cloudy": 1,
        "Foggy": 2,
        "Rainy": 3,
        "Snowy": 4,
    }
    weather_severity = weather_severity_map.get(weather, 0)

    # Interaction features
    temp_humidity = temperature * humidity / 100
    wind_vis_risk = wind_speed / (visibility + 0.1)

    # Speed bucket: 0 if <=35, 1 if <=55, 2 otherwise
    if average_speed <= 35:
        speed_bucket = 0
    elif average_speed <= 55:
        speed_bucket = 1
    else:
        speed_bucket = 2

    # Volume bucket: 0 if <=1500, 1 if <=3500, 2 otherwise
    if traffic_volume <= 1500:
        volume_bucket = 0
    elif traffic_volume <= 3500:
        volume_bucket = 1
    else:
        volume_bucket = 2

    features = [
        hour,
        is_weekend,
        is_rush_hour,
        is_night,
        hour_sin,
        hour_cos,
        day_enc,
        weather_enc,
        weather_severity,
        temperature,
        humidity,
        wind_speed,
        visibility,
        temp_humidity,
        wind_vis_risk,
        road_enc,
        average_speed,
        traffic_volume,
        speed_bucket,
        volume_bucket,
    ]

    return np.array(features).reshape(1, -1)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        features = engineer_features(data)

        # Load prediction models
        congestion_model = load_model("congestion_model.pkl")
        volume_model = load_model("traffic_volume_model.pkl")
        accident_model = load_model("accident_model.pkl")
        congestion_encoder = load_model("congestion_encoder.pkl")

        # Predictions
        congestion_encoded = congestion_model.predict(features)[0]
        congestion_label = congestion_encoder.inverse_transform([congestion_encoded])[0]

        predicted_volume = volume_model.predict(features)[0]
        predicted_volume = max(0, round(float(predicted_volume)))

        # Accident risk as probability (0–100%)
        if hasattr(accident_model, "predict_proba"):
            accident_proba = accident_model.predict_proba(features)[0]
            accident_risk = round(float(max(accident_proba)) * 100, 1)
        else:
            raw = accident_model.predict(features)[0]
            accident_risk = round(float(raw) * 100, 1) if float(raw) <= 1 else round(float(raw), 1)

        # Recommendation logic
        level = congestion_label.strip().lower()
        if "high" in level:
            recommendation = "High congestion expected. Consider alternate routes."
            rec_type = "danger"
        elif "medium" in level or "moderate" in level or "mid" in level:
            recommendation = "Moderate traffic. Allow extra travel time."
            rec_type = "warning"
        else:
            recommendation = "Roads are clear. Enjoy the drive!"
            rec_type = "success"

        return jsonify(
            {
                "success": True,
                "congestion_level": congestion_label,
                "predicted_volume": predicted_volume,
                "accident_risk": accident_risk,
                "recommendation": recommendation,
                "rec_type": rec_type,
            }
        )

    except FileNotFoundError as e:
        return jsonify({"success": False, "error": f"Model file not found: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
