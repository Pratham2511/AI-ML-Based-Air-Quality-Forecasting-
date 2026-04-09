import axios from 'axios'
import type { City, ForecastPoint, LiveResponse, ModelStatsResponse } from './types'

const API_BASE_URL = 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

export async function getLive(city: City): Promise<LiveResponse> {
  const response = await api.get<LiveResponse>('/live', { params: { city } })
  return response.data
}

export async function getForecast(city: City, window: 3 | 7 | 14 | 30): Promise<ForecastPoint[]> {
  const response = await api.post<ForecastPoint[]>('/forecast', { city, window })
  return response.data
}

export async function getModelStats(): Promise<ModelStatsResponse> {
  const response = await api.get<ModelStatsResponse>('/model-stats')
  return response.data
}
