# Air Pollution ForeCasting

AI-powered air quality forecasting web application for **Mumbai** and **Delhi**.

The project includes:
- A **FastAPI backend** that serves live AQI data and model-based forecasts.
- A **React + Vite + TypeScript frontend** with Dashboard, Analysis, and Compare views.
- A trained **TensorFlow/Keras model** with scaler/config artifacts for multi-pollutant prediction.

## What This Project Does

1. Fetches **live pollutant values** (PM2.5, PM10, NO2, SO2, CO, O3) from WAQI.
2. Uses the trained forecasting model on historical city data.
3. Predicts future values for the same 6 pollutants.
4. Converts predicted PM2.5 to AQI category.
5. Visualizes results with charts and city comparison tools.

## Tech Stack

### Backend
- Python 3.11
- FastAPI
- Uvicorn
- TensorFlow/Keras
- scikit-learn
- pandas, numpy
- requests
- python-dotenv

### Frontend
- React 19
- TypeScript
- Vite
- Recharts
- Axios
- Tailwind CSS (v4)
- Lucide icons

## Project Structure

```text
air-pollution-app/
  backend/
    main.py
    requirements.txt
    .env
    air_quality_forecasting_model.keras
    feature_scaler.pkl
    model_config.json
    mumbai_air_quality_real.csv
    delhi_air_quality_real.csv
  frontend/
    src/
    index.html
    package.json
  README.md
```

## How It Works (Data Flow)

1. On backend startup, `backend/main.py` loads:
   - model (`.keras`)
   - feature scaler (`.pkl`)
   - model config (`model_config.json`)
   - historical city datasets (`mumbai_*`, `delhi_*`)
2. Frontend calls backend APIs:
   - `GET /live?city=...`
   - `POST /forecast`
   - `GET /model-stats`
3. Backend returns JSON used by the UI cards/charts.
4. Frontend renders:
   - Dashboard: live AQI + 7-day strip
   - Analysis: 6 pollutant charts + AQI distribution + model metrics
   - Compare: Mumbai vs Delhi with pollutant selector

## Prerequisites

- Python 3.11 (recommended for TensorFlow compatibility)
- Node.js 18+
- npm
- WAQI API token

## Setup

### 1) Backend setup

```bash
cd backend
python3.11 -m venv .venv311
source .venv311/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
WAQI_TOKEN=your_waqi_token_here
```

Run backend:

```bash
source .venv311/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000
```

### 2) Frontend setup

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend URL: `http://127.0.0.1:5173`

## API Endpoints

### `GET /`
Health/info endpoint.

### `GET /live?city=Mumbai|Delhi`
Returns live pollutant values and AQI category.

### `POST /forecast`
Request body:

```json
{
  "city": "Delhi",
  "window": 7
}
```

- `window` allowed values: `3`, `7`, `14`, `30`
- Returns an array of forecast rows with:
  - `predicted_pm25`
  - `predicted_pm10`
  - `predicted_no2`
  - `predicted_so2`
  - `predicted_co`
  - `predicted_o3`
  - `predicted_aqi`
  - `aqi_category`

### `GET /model-stats`
Returns MAE, RMSE, R2, MAPE, feature count, date range, and model type.

## Notes

- If you open `http://127.0.0.1:8000` directly, it now returns a JSON status response.
- CORS is enabled for frontend dev origins:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  - `http://localhost:5174`
  - `http://127.0.0.1:5174`
- You may see a scikit-learn scaler version warning at startup if training and runtime versions differ.

## Quick Run Checklist

1. Start backend on `8000`.
2. Start frontend on `5173`.
3. Open `http://127.0.0.1:5173`.
4. Check backend docs at `http://127.0.0.1:8000/docs`.
