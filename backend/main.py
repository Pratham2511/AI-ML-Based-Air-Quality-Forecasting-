from __future__ import annotations

import json
import os
import pickle
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd
import requests
import tensorflow as tf
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
WAQI_BASE_URL = "https://api.waqi.info"

load_dotenv(BASE_DIR / ".env")
WAQI_TOKEN = os.getenv("WAQI_TOKEN", "")

CITY_SLUGS: dict[str, str] = {
    "Mumbai": "mumbai",
    "Delhi": "delhi",
}

PM25_AQI_BREAKPOINTS = [
    (0.0, 12.0, 0, 50, "Good"),
    (12.1, 35.4, 51, 100, "Moderate"),
    (35.5, 55.4, 101, 150, "USG"),
    (55.5, 150.4, 151, 200, "Unhealthy"),
    (150.5, 250.4, 201, 300, "Very Unhealthy"),
    (250.5, 500.4, 301, 500, "Hazardous"),
]

FORECAST_TARGETS = ["pm25", "pm10", "no2", "so2", "co", "o3"]


class ForecastRequest(BaseModel):
    city: str
    window: Literal[3, 7, 14, 30] = Field(default=7)


class AppState:
    model: Any = None
    scaler: Any = None
    model_config: dict[str, Any] = {}
    city_data: dict[str, pd.DataFrame] = {}
    feature_cols: list[str] = []
    target_col: str = "pm25"
    target_cols: list[str] = []
    sequence_length: int = 30
    forecast_steps: int = 30


state = AppState()


def normalize_city(city: str) -> str:
    normalized = city.strip().title()
    if normalized not in CITY_SLUGS:
        raise HTTPException(status_code=400, detail="City must be either Mumbai or Delhi")
    return normalized


def get_aqi_category(aqi: int) -> str:
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "USG"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"


def pm25_to_aqi(pm25: float | None) -> tuple[int | None, str]:
    if pm25 is None or np.isnan(pm25):
        return None, "Unknown"

    clamped = float(min(max(pm25, 0.0), 500.4))
    for c_low, c_high, i_low, i_high, category in PM25_AQI_BREAKPOINTS:
        if c_low <= clamped <= c_high:
            aqi = ((i_high - i_low) / (c_high - c_low)) * (clamped - c_low) + i_low
            return int(round(aqi)), category

    return 500, "Hazardous"


def resolve_artifact(preferred_names: list[str], glob_patterns: list[str], label: str) -> Path:
    for name in preferred_names:
        candidate = BASE_DIR / name
        if candidate.exists():
            return candidate

    for pattern in glob_patterns:
        matches = sorted(BASE_DIR.glob(pattern))
        if matches:
            return matches[0]

    raise RuntimeError(f"Unable to find {label} artifact in {BASE_DIR}")


def inverse_target_value(predicted_scaled: float, target_col: str = "pm25") -> float:
    feature_count = len(state.feature_cols)
    target_idx = state.feature_cols.index(target_col)

    # Inverse-transform only target value by placing it in a dummy scaled vector.
    scaled_vector = np.zeros((1, feature_count), dtype=np.float32)
    scaled_vector[0, target_idx] = predicted_scaled
    inverse_vector = state.scaler.inverse_transform(scaled_vector)
    return float(inverse_vector[0, target_idx])


def inverse_target_values(predicted_scaled: dict[str, float]) -> dict[str, float]:
    feature_count = len(state.feature_cols)
    scaled_vector = np.zeros((1, feature_count), dtype=np.float32)

    valid_targets: dict[str, int] = {}
    for target, scaled_value in predicted_scaled.items():
        if target in state.feature_cols:
            target_idx = state.feature_cols.index(target)
            scaled_vector[0, target_idx] = scaled_value
            valid_targets[target] = target_idx

    if not valid_targets:
        return {}

    inverse_vector = state.scaler.inverse_transform(scaled_vector)
    return {target: float(inverse_vector[0, idx]) for target, idx in valid_targets.items()}


def parse_prediction_matrix(prediction: np.ndarray, target_count: int) -> np.ndarray:
    arr = np.asarray(prediction, dtype=np.float32)

    if arr.ndim == 3:
        if arr.shape[0] == 1:
            arr = arr[0]
        else:
            arr = arr.reshape(arr.shape[0], -1)

    if arr.ndim == 2:
        if arr.shape[0] == 1:
            row = arr[0]
            if target_count > 1 and row.size % target_count == 0:
                return row.reshape(-1, target_count)
            return row.reshape(-1, 1)
        if arr.shape[1] == target_count:
            return arr
        if target_count > 1 and arr.shape[1] % target_count == 0:
            return arr.reshape(arr.shape[0], target_count, -1)[:, :, 0]
        return arr

    if arr.ndim == 1:
        if target_count > 1 and arr.size % target_count == 0:
            return arr.reshape(-1, target_count)
        return arr.reshape(-1, 1)

    raise RuntimeError(f"Unsupported prediction output shape: {arr.shape}")


def prepare_inference_frame(df: pd.DataFrame) -> pd.DataFrame:
    features_df = df.reindex(columns=state.feature_cols).copy()
    for column in state.feature_cols:
        features_df[column] = pd.to_numeric(features_df[column], errors="coerce")
    features_df = features_df.ffill().bfill().fillna(0.0)
    return features_df


def safe_optional_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return None


@asynccontextmanager
async def lifespan(_: FastAPI):
    model_path = resolve_artifact(
        preferred_names=["air_quality_forecasting_model.keras"],
        glob_patterns=["*.keras"],
        label="model",
    )
    scaler_path = resolve_artifact(
        preferred_names=["feature_scaler.pkl"],
        glob_patterns=["*scaler*.pkl"],
        label="feature scaler",
    )
    config_path = resolve_artifact(
        preferred_names=["model_config.json"],
        glob_patterns=["*config*.json"],
        label="model config",
    )
    mumbai_path = resolve_artifact(
        preferred_names=["mumbai_air_quality_real.csv"],
        glob_patterns=["*mumbai*.csv"],
        label="Mumbai historical data",
    )
    delhi_path = resolve_artifact(
        preferred_names=["delhi_air_quality_real.csv"],
        glob_patterns=["*delhi*.csv"],
        label="Delhi historical data",
    )

    state.model = tf.keras.models.load_model(model_path)

    with open(scaler_path, "rb") as scaler_file:
        state.scaler = pickle.load(scaler_file)

    with open(config_path, "r", encoding="utf-8") as config_file:
        state.model_config = json.load(config_file)

    state.feature_cols = state.model_config.get("feature_cols", [])
    state.target_col = state.model_config.get("target_col", "pm25")
    state.target_cols = state.model_config.get("target_cols", [state.target_col])
    state.target_cols = [target for target in state.target_cols if target in FORECAST_TARGETS]
    if not state.target_cols:
        state.target_cols = [state.target_col]
    state.sequence_length = int(state.model_config.get("sequence_length", 30))
    state.forecast_steps = int(state.model_config.get("forecast_steps", 30))

    mumbai_df = pd.read_csv(mumbai_path)
    delhi_df = pd.read_csv(delhi_path)

    for city, frame in {"Mumbai": mumbai_df, "Delhi": delhi_df}.items():
        frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
        frame = frame.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
        state.city_data[city] = frame

    yield


app = FastAPI(title="Air Pollution Forecasting API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "Air Pollution Forecasting API",
        "status": "ok",
        "endpoints": ["/live", "/forecast", "/model-stats"],
    }


@app.get("/live")
def get_live(city: str):
    normalized_city = normalize_city(city)

    if not WAQI_TOKEN:
        raise HTTPException(status_code=500, detail="WAQI_TOKEN is missing. Add it to backend/.env")

    slug = CITY_SLUGS[normalized_city]
    response = requests.get(
        f"{WAQI_BASE_URL}/feed/{slug}/",
        params={"token": WAQI_TOKEN},
        timeout=15,
    )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"WAQI request failed ({response.status_code}): {response.text[:200]}",
        )

    data = response.json()
    if data.get("status") != "ok":
        raise HTTPException(status_code=502, detail="WAQI returned no data")

    waqi_data = data.get("data") or {}
    iaqi = waqi_data.get("iaqi") or {}

    def get_val(key: str) -> float | None:
        return safe_optional_float((iaqi.get(key) or {}).get("v"))

    aqi_raw = waqi_data.get("aqi")
    aqi = int(aqi_raw) if isinstance(aqi_raw, (int, float)) else None
    aqi_category = get_aqi_category(aqi) if aqi is not None else "Unknown"

    return {
        "city": normalized_city,
        "date": str(date.today()),
        "pm25": get_val("pm25"),
        "pm10": get_val("pm10"),
        "no2": get_val("no2"),
        "so2": get_val("so2"),
        "co": get_val("co"),
        "o3": get_val("o3"),
        "aqi": aqi,
        "aqi_category": aqi_category,
    }


@app.post("/forecast")
def forecast(payload: ForecastRequest):
    city = normalize_city(payload.city)

    if city not in state.city_data:
        raise HTTPException(status_code=404, detail="City dataset not loaded")

    frame = state.city_data[city]
    sequence_length = state.sequence_length
    requested_window = payload.window

    if len(frame) < sequence_length:
        raise HTTPException(status_code=400, detail="Not enough historical rows for forecast context")

    context = frame.tail(sequence_length).reset_index(drop=True)
    feature_context = prepare_inference_frame(context)

    x_scaled = state.scaler.transform(feature_context)
    x_model = np.expand_dims(np.asarray(x_scaled, dtype=np.float32), axis=0)
    prediction_scaled = state.model.predict(x_model, verbose=0)

    target_count = len(state.target_cols)
    prediction_matrix = parse_prediction_matrix(prediction_scaled, target_count)
    if prediction_matrix.size == 0:
        raise HTTPException(status_code=500, detail="Model returned no forecast values")

    # Ensure enough forecast rows for requested window.
    if prediction_matrix.shape[0] < requested_window:
        repeat_row = prediction_matrix[-1:, :]
        repeats_needed = requested_window - prediction_matrix.shape[0]
        repeated = np.repeat(repeat_row, repeats_needed, axis=0)
        prediction_matrix = np.vstack([prediction_matrix, repeated])

    prediction_matrix = prediction_matrix[:requested_window]

    output: list[dict[str, Any]] = []
    today = date.today()
    last_context_row = feature_context.iloc[-1]

    for day_index in range(requested_window):
        row_scaled = prediction_matrix[day_index]
        scaled_targets: dict[str, float] = {}

        if row_scaled.ndim == 0:
            row_scaled = np.asarray([float(row_scaled)], dtype=np.float32)

        for idx, target_name in enumerate(state.target_cols):
            if idx < row_scaled.shape[0]:
                scaled_targets[target_name] = float(row_scaled[idx])

        inverse_targets = inverse_target_values(scaled_targets)

        predicted_values: dict[str, float] = {}
        for pollutant in FORECAST_TARGETS:
            if pollutant in inverse_targets:
                predicted_values[pollutant] = max(0.0, inverse_targets[pollutant])
            else:
                fallback = safe_optional_float(last_context_row.get(pollutant))
                predicted_values[pollutant] = max(0.0, fallback if fallback is not None else 0.0)

        predicted_pm25 = predicted_values["pm25"]
        predicted_aqi, category = pm25_to_aqi(predicted_pm25)

        output.append(
            {
                "date": (today + timedelta(days=day_index + 1)).isoformat(),
                "predicted_pm25": round(predicted_pm25, 2),
                "predicted_pm10": round(predicted_values["pm10"], 2),
                "predicted_no2": round(predicted_values["no2"], 2),
                "predicted_so2": round(predicted_values["so2"], 2),
                "predicted_co": round(predicted_values["co"], 2),
                "predicted_o3": round(predicted_values["o3"], 2),
                "predicted_aqi": predicted_aqi,
                "aqi_category": category,
            }
        )

    return output


@app.get("/model-stats")
def model_stats():
    metrics = state.model_config.get("metrics", {})

    all_dates = pd.concat(
        [
            state.city_data["Mumbai"]["date"],
            state.city_data["Delhi"]["date"],
        ]
    )

    training_date_range = (
        f"{all_dates.min().date().isoformat()} to {all_dates.max().date().isoformat()}"
        if not all_dates.empty
        else "unknown"
    )

    model_type = str(state.model_config.get("model_type", "Bidirectional LSTM")).replace("_", " ")

    return {
        "mae": round(float(metrics.get("MAE", 0.0)), 2),
        "rmse": round(float(metrics.get("RMSE", 0.0)), 2),
        "r2": round(float(metrics.get("R2", 0.0)), 4),
        "mape": round(float(metrics.get("MAPE", 0.0)), 2),
        "training_date_range": training_date_range,
        "feature_count": len(state.feature_cols),
        "model_type": model_type,
    }
