export type City = 'Mumbai' | 'Delhi'

export interface LiveResponse {
  city: City
  date: string
  pm25: number | null
  pm10: number | null
  no2: number | null
  so2: number | null
  co: number | null
  o3: number | null
  aqi: number | null
  aqi_category: string
}

export interface ForecastPoint {
  date: string
  predicted_pm25: number
  predicted_pm10: number
  predicted_no2: number
  predicted_so2: number
  predicted_co: number
  predicted_o3: number
  predicted_aqi: number
  aqi_category: string
}

export interface ModelStatsResponse {
  mae: number
  rmse: number
  r2: number
  mape: number
  training_date_range: string
  feature_count: number
  model_type: string
}
