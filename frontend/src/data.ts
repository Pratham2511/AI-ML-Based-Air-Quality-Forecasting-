export interface AQIData {
  aqi: number;
  category: string;
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  co: number;
  o3: number;
  lastUpdated: string;
}

export interface ForecastData {
  date: string;
  actual_pm25: number;
  predicted_pm25: number;
  aqi: number;
  no2: number;
  o3: number;
  pm10: number;
}

export const CITIES = {
  MUMBAI: 'Mumbai',
  DELHI: 'Delhi',
};

export const MOCK_DATA: Record<string, AQIData> = {
  [CITIES.MUMBAI]: {
    aqi: 156,
    category: 'Unhealthy',
    pm25: 64.0,
    pm10: 82.0,
    no2: 45.0,
    so2: 12.5,
    co: 1.8,
    o3: 22.4,
    lastUpdated: '10:30 AM',
  },
  [CITIES.DELHI]: {
    aqi: 79,
    category: 'Moderate',
    pm25: 25.0,
    pm10: 52.0,
    no2: 1.7,
    so2: 11.9,
    co: 1.3,
    o3: 11.6,
    lastUpdated: '10:30 AM',
  },
};

export const SEVEN_DAY_STRIP = [
  { date: '2020-12-27', aqi: 158, category: 'Unhealthy' },
  { date: '2020-12-28', aqi: 158, category: 'Unhealthy' },
  { date: '2020-12-29', aqi: 158, category: 'Unhealthy' },
  { date: '2020-12-30', aqi: 158, category: 'Unhealthy' },
  { date: '2020-12-31', aqi: 158, category: 'Unhealthy' },
];

export const FORECAST_DATA: ForecastData[] = [
  { date: '2020-12-25', actual_pm25: 55, predicted_pm25: 52, aqi: 160, no2: 40, o3: 30, pm10: 70 },
  { date: '2020-12-26', actual_pm25: 35, predicted_pm25: 42, aqi: 160, no2: 35, o3: 25, pm10: 65 },
  { date: '2020-12-27', actual_pm25: 38, predicted_pm25: 58, aqi: 160, no2: 50, o3: 40, pm10: 80 },
  { date: '2020-12-28', actual_pm25: 68, predicted_pm25: 71, aqi: 160, no2: 60, o3: 50, pm10: 90 },
  { date: '2020-12-29', actual_pm25: 75, predicted_pm25: 65, aqi: 160, no2: 55, o3: 45, pm10: 85 },
  { date: '2020-12-30', actual_pm25: 110, predicted_pm25: 68, aqi: 160, no2: 63, o3: 55, pm10: 103 },
  { date: '2020-12-31', actual_pm25: 55, predicted_pm25: 72, aqi: 160, no2: 45, o3: 35, pm10: 75 },
];

export const COMPARISON_30_DAYS = Array.from({ length: 30 }, (_, i) => ({
  date: `2020-12-${String(i + 1).padStart(2, '0')}`,
  Mumbai: 40 + Math.random() * 40,
  Delhi: 10 + Math.random() * 20,
}));

export const RADAR_DATA = [
  { subject: 'PM2.5', Mumbai: 85, Delhi: 30, fullMark: 100 },
  { subject: 'PM10', Mumbai: 70, Delhi: 40, fullMark: 100 },
  { subject: 'NO2', Mumbai: 60, Delhi: 15, fullMark: 100 },
  { subject: 'SO2', Mumbai: 20, Delhi: 10, fullMark: 100 },
  { subject: 'CO', Mumbai: 45, Delhi: 25, fullMark: 100 },
  { subject: 'O3', Mumbai: 55, Delhi: 20, fullMark: 100 },
];
