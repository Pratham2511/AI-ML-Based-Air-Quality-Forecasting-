import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import { Wind } from 'lucide-react'
import { getForecast, getLive, getModelStats } from './api'
import type { City, ForecastPoint, LiveResponse, ModelStatsResponse } from './types'

type ViewKey = 'dashboard' | 'forecast' | 'comparison'
type ForecastPollutantKey =
  | 'predicted_pm25'
  | 'predicted_pm10'
  | 'predicted_no2'
  | 'predicted_so2'
  | 'predicted_co'
  | 'predicted_o3'

type ComparePoint = {
  date: string
  Mumbai: number | null
  Delhi: number | null
}

const CITIES: City[] = ['Mumbai', 'Delhi']

const POLLUTANTS: ReadonlyArray<{
  key: keyof LiveResponse
  label: string
  unit: string
  forecastKey: ForecastPollutantKey
  color: string
}> = [
  { key: 'pm25', label: 'PM2.5', unit: 'ug/m3', forecastKey: 'predicted_pm25', color: '#38bdf8' },
  { key: 'pm10', label: 'PM10', unit: 'ug/m3', forecastKey: 'predicted_pm10', color: '#34d399' },
  { key: 'no2', label: 'NO2', unit: 'ppb', forecastKey: 'predicted_no2', color: '#fb7185' },
  { key: 'so2', label: 'SO2', unit: 'ppb', forecastKey: 'predicted_so2', color: '#f59e0b' },
  { key: 'co', label: 'CO', unit: 'ppm', forecastKey: 'predicted_co', color: '#14b8a6' },
  { key: 'o3', label: 'O3', unit: 'ppb', forecastKey: 'predicted_o3', color: '#a78bfa' },
] as const

const AQI_BANDS = [
  { min: 0, max: 50, label: 'Good', color: '#10b981' },
  { min: 51, max: 100, label: 'Moderate', color: '#f59e0b' },
  { min: 101, max: 150, label: 'USG', color: '#f97316' },
  { min: 151, max: 200, label: 'Unhealthy', color: '#f43f5e' },
  { min: 201, max: 300, label: 'Very Unhealthy', color: '#8b5cf6' },
  { min: 301, max: 500, label: 'Hazardous', color: '#7f1d1d' },
] as const

const chartTooltipStyle = {
  backgroundColor: '#1e1b4b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '16px',
}

function getAqiColor(aqi: number | null, category?: string): string {
  if (typeof aqi === 'number') {
    const byAqi = AQI_BANDS.find((band) => aqi >= band.min && aqi <= band.max)
    if (byAqi) return byAqi.color
  }

  if (category) {
    const normalized = category.toLowerCase()
    const byCategory = AQI_BANDS.find((band) => normalized.includes(band.label.toLowerCase()))
    if (byCategory) return byCategory.color
  }

  return '#94a3b8'
}

function formatValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return `N/A ${unit}`
  return `${value.toFixed(2)} ${unit}`
}

const WindBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Array<Record<string, number>>>([])
  const animationId = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)

    const makeParticle = (x?: number, y?: number, gust = false) => ({
      x: x ?? Math.random() * canvas.width,
      y: y ?? Math.random() * canvas.height,
      vx: gust ? 5 + Math.random() * 8 : 1 + Math.random() * 2,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 1.8 + 0.8,
      opacity: Math.random() * 0.4 + 0.1,
      life: gust ? 80 : Number.POSITIVE_INFINITY,
    })

    for (let i = 0; i < 50; i++) particles.current.push(makeParticle())

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.current = particles.current.filter((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy

        if (Number.isFinite(particle.life)) {
          particle.life -= 1
          if (particle.life <= 0) return false
        }

        if (particle.x > canvas.width + 10) {
          if (Number.isFinite(particle.life)) return false
          particle.x = -10
          particle.y = Math.random() * canvas.height
        }

        ctx.beginPath()
        ctx.moveTo(particle.x, particle.y)
        ctx.lineTo(particle.x - particle.vx * 5, particle.y - particle.vy * 5)
        ctx.strokeStyle = `rgba(255,255,255,${particle.opacity})`
        ctx.lineWidth = particle.size
        ctx.lineCap = 'round'
        ctx.stroke()
        return true
      })

      animationId.current = requestAnimationFrame(animate)
    }

    animate()

    const clickBurst = (event: MouseEvent) => {
      for (let i = 0; i < 24; i++) {
        particles.current.push(makeParticle(event.clientX, event.clientY, true))
      }
    }

    window.addEventListener('click', clickBurst)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('click', clickBurst)
      cancelAnimationFrame(animationId.current)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-60" />
}

const GlassCard = ({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) => (
  <div className={`glass rounded-3xl p-6 overflow-hidden relative ${className}`}>
    {title ? <h3 className="text-lg font-semibold mb-4 text-indigo-100/80">{title}</h3> : null}
    {children}
  </div>
)

const AQIGauge = ({ city, data }: { city: City; data: LiveResponse }) => {
  const value = data.aqi ?? 0
  const percentage = Math.min((value / 300) * 100, 100)
  const color = getAqiColor(data.aqi, data.aqi_category)

  return (
    <GlassCard className="flex items-center justify-center py-8">
      <div className="flex flex-col items-center justify-center p-4">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/10" />
            <circle
              cx="96"
              cy="96"
              r="80"
              stroke={color}
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={502.4}
              strokeDashoffset={502.4 - (502.4 * percentage) / 100}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-sm font-medium text-indigo-300/50 uppercase tracking-widest">AQI</span>
            <span className="text-5xl font-bold text-white tracking-tighter">{data.aqi ?? 'N/A'}</span>
            <span className="text-sm font-medium mt-1" style={{ color }}>
              {data.aqi_category}
            </span>
          </div>
        </div>
        <h4 className="mt-4 text-xl font-semibold text-indigo-100">{city}</h4>
      </div>
    </GlassCard>
  )
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>('dashboard')
  const [selectedCity, setSelectedCity] = useState<City>('Mumbai')

  const [liveByCity, setLiveByCity] = useState<Record<City, LiveResponse | null>>({ Mumbai: null, Delhi: null })
  const [forecastByCity, setForecastByCity] = useState<Record<City, ForecastPoint[]>>({ Mumbai: [], Delhi: [] })
  const [stats, setStats] = useState<ModelStatsResponse | null>(null)

  const [analysisWindow, setAnalysisWindow] = useState<3 | 7 | 14 | 30>(7)
  const [comparePollutant, setComparePollutant] = useState<ForecastPollutantKey>('predicted_pm25')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const [mumbaiLive, delhiLive, mumbaiForecast, delhiForecast, modelStats] = await Promise.all([
          getLive('Mumbai'),
          getLive('Delhi'),
          getForecast('Mumbai', 30),
          getForecast('Delhi', 30),
          getModelStats(),
        ])

        if (cancelled) return

        setLiveByCity({ Mumbai: mumbaiLive, Delhi: delhiLive })
        setForecastByCity({ Mumbai: mumbaiForecast, Delhi: delhiForecast })
        setStats(modelStats)
      } catch {
        if (!cancelled) {
          setError('Unable to load live forecast data. Ensure backend is running on localhost:8000.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 60_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const currentLive = liveByCity[selectedCity]
  const currentForecast = useMemo(() => forecastByCity[selectedCity].slice(0, analysisWindow), [forecastByCity, selectedCity, analysisWindow])
  const quickStrip = useMemo(() => forecastByCity[selectedCity].slice(0, 7), [forecastByCity, selectedCity])

  const categoryPie = useMemo(() => {
    const counts = currentForecast.reduce<Record<string, number>>((acc, row) => {
      acc[row.aqi_category] = (acc[row.aqi_category] ?? 0) + 1
      return acc
    }, {})
    const total = currentForecast.length || 1

    return Object.entries(counts).map(([name, count]) => ({
      name,
      value: Number(((count / total) * 100).toFixed(1)),
      color: getAqiColor(null, name),
    }))
  }, [currentForecast])

  const compareSeries = useMemo<ComparePoint[]>(() => {
    const mumbaiRows = forecastByCity.Mumbai.slice(0, analysisWindow)
    const delhiRows = forecastByCity.Delhi.slice(0, analysisWindow)

    const map: Record<string, ComparePoint> = {}

    mumbaiRows.forEach((row) => {
      map[row.date] = {
        ...(map[row.date] ?? { date: row.date, Mumbai: null, Delhi: null }),
        Mumbai: row[comparePollutant],
      }
    })

    delhiRows.forEach((row) => {
      map[row.date] = {
        ...(map[row.date] ?? { date: row.date, Mumbai: null, Delhi: null }),
        Delhi: row[comparePollutant],
      }
    })

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [forecastByCity, analysisWindow, comparePollutant])

  const compareRadar = useMemo(() => {
    const mumbai = liveByCity.Mumbai
    const delhi = liveByCity.Delhi
    if (!mumbai || !delhi) return []

    return POLLUTANTS.map((pollutant) => {
      const mValue = (mumbai[pollutant.key] as number | null) ?? 0
      const dValue = (delhi[pollutant.key] as number | null) ?? 0
      const scale = Math.max(mValue, dValue, 1)

      return {
        pollutant: pollutant.label,
        Mumbai: Number(((mValue / scale) * 100).toFixed(1)),
        Delhi: Number(((dValue / scale) * 100).toFixed(1)),
      }
    })
  }, [liveByCity])

  const selectedPollutantLabel = useMemo(
    () => POLLUTANTS.find((pollutant) => pollutant.forecastKey === comparePollutant)?.label ?? 'PM2.5',
    [comparePollutant],
  )

  const summary = useMemo(() => {
    const mAqi = liveByCity.Mumbai?.aqi
    const dAqi = liveByCity.Delhi?.aqi

    if (mAqi === null || mAqi === undefined || dAqi === null || dAqi === undefined) {
      return 'At least one city has missing live AQI data right now, so summary is limited.'
    }

    if (mAqi === dAqi) {
      return 'Mumbai and Delhi currently report the same AQI level.'
    }

    const betterCity = mAqi < dAqi ? 'Mumbai' : 'Delhi'
    const diff = Math.abs(mAqi - dAqi)
    return `${betterCity} currently has better air quality by ${diff} AQI points.`
  }, [liveByCity])

  return (
    <div className="min-h-screen bg-mesh p-4 md:p-8 lg:p-12 relative">
      <WindBackground />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <header className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white text-glow">
              {activeView === 'dashboard' && 'Air Quality Dashboard'}
              {activeView === 'forecast' && 'AI Pollution Forecasting'}
              {activeView === 'comparison' && 'City Comparison View'}
            </h1>
            <p className="text-indigo-300 font-semibold">
              {activeView === 'forecast' ? 'Mumbai & Delhi Air Quality' : 'Real-time atmospheric monitoring'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="glass p-1 rounded-2xl flex items-center shadow-sm">
              <button
                onClick={() => setActiveView('dashboard')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${activeView === 'dashboard' ? 'bg-white/20 text-white shadow-md' : 'text-indigo-300 hover:text-white'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveView('forecast')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${activeView === 'forecast' ? 'bg-white/20 text-white shadow-md' : 'text-indigo-300 hover:text-white'}`}
              >
                Analysis
              </button>
              <button
                onClick={() => setActiveView('comparison')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${activeView === 'comparison' ? 'bg-white/20 text-white shadow-md' : 'text-indigo-300 hover:text-white'}`}
              >
                Compare
              </button>
            </div>

            {activeView !== 'comparison' && (
              <div className="glass p-1 rounded-2xl flex items-center shadow-sm">
                {CITIES.map((city) => (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${selectedCity === city ? 'bg-indigo-500 text-white shadow-md' : 'text-indigo-300 hover:text-white'}`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {loading ? (
          <GlassCard>
            <p className="text-indigo-200">Loading air quality data...</p>
          </GlassCard>
        ) : error ? (
          <GlassCard>
            <p className="text-rose-300 font-semibold">{error}</p>
          </GlassCard>
        ) : (
          <main className="relative space-y-6">
            {activeView === 'dashboard' && currentLive && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <GlassCard className="lg:col-span-5 flex flex-col items-center justify-center text-center py-12">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 opacity-50" />
                  <h2 className="text-2xl font-light text-indigo-300 uppercase tracking-[0.2em] mb-2">Today's AQI</h2>
                  <div className="text-[92px] md:text-[110px] font-bold leading-none tracking-tighter text-white text-glow">
                    {currentLive.aqi ?? 'N/A'}
                  </div>
                  <div className="mt-4 px-8 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-sm">
                    <span className="text-xl font-semibold text-indigo-100 tracking-wide">{currentLive.aqi_category}</span>
                  </div>
                  <div className="mt-8 space-y-1">
                    <p className="text-lg text-indigo-300">
                      PM2.5: <span className="text-white font-bold">{formatValue(currentLive.pm25, 'ug/m3')}</span>
                    </p>
                    <p className="text-sm text-indigo-400/70 font-medium">Date: {currentLive.date}</p>
                  </div>
                </GlassCard>

                <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {POLLUTANTS.map((pollutant) => (
                    <div key={pollutant.key} className="glass-dark rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1">
                      <span className="text-sm font-medium text-indigo-300/70">{pollutant.label}</span>
                      <div className="text-xl md:text-2xl font-bold text-white tracking-tight">
                        {formatValue(currentLive[pollutant.key] as number | null, pollutant.unit)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-12 mt-4">
                  <h3 className="text-xl font-bold text-indigo-100 mb-6 px-2">7-Day Quick AQI Strip</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {quickStrip.map((day) => (
                      <GlassCard key={day.date} className="p-4 flex flex-col items-center text-center space-y-2">
                        <span className="text-xs text-indigo-400 font-bold">{day.date}</span>
                        <div className="text-xl font-bold" style={{ color: getAqiColor(day.predicted_aqi, day.aqi_category) }}>
                          AQI {day.predicted_aqi}
                        </div>
                        <span className="text-xs font-semibold text-indigo-300">{day.aqi_category}</span>
                      </GlassCard>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeView === 'forecast' && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  {[3, 7, 14, 30].map((window) => (
                    <button
                      key={window}
                      type="button"
                      onClick={() => setAnalysisWindow(window as 3 | 7 | 14 | 30)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 border ${analysisWindow === window ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-white/10 text-indigo-200 border-white/15 hover:bg-white/20'}`}
                    >
                      {window} days
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GlassCard title="All 6 Pollutants Forecast (Line)">
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={currentForecast}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="date" stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Legend iconType="circle" />
                          {POLLUTANTS.map((pollutant) => (
                            <Line
                              key={pollutant.forecastKey}
                              type="monotone"
                              dataKey={pollutant.forecastKey}
                              name={pollutant.label}
                              stroke={pollutant.color}
                              strokeWidth={2.2}
                              dot={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </GlassCard>

                  <GlassCard title="Daily AQI Forecast">
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={currentForecast}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="date" stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Bar dataKey="predicted_aqi" radius={[6, 6, 0, 0]}>
                            {currentForecast.map((entry) => (
                              <Cell key={entry.date} fill={getAqiColor(entry.predicted_aqi, entry.aqi_category)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </GlassCard>

                  <GlassCard title="All 6 Pollutants Trend (Area)">
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={currentForecast}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="date" stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Legend iconType="circle" />
                          {POLLUTANTS.map((pollutant) => (
                            <Area
                              key={pollutant.forecastKey}
                              type="monotone"
                              dataKey={pollutant.forecastKey}
                              name={pollutant.label}
                              stroke={pollutant.color}
                              fill={pollutant.color}
                              fillOpacity={0.14}
                            />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </GlassCard>

                  <GlassCard title="AQI Category Distribution">
                    <div className="h-[320px] w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryPie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={85} paddingAngle={3}>
                            {categoryPie.map((slice) => (
                              <Cell key={slice.name} fill={slice.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Legend verticalAlign="bottom" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </GlassCard>
                </div>

                <GlassCard className="py-8">
                  <h4 className="text-center text-indigo-300 mb-8 uppercase tracking-widest text-xs font-bold">Model Accuracy</h4>
                  {stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 text-center">
                      <div><div className="text-xs text-indigo-400 mb-1 font-bold">MAE</div><div className="text-xl font-bold text-white">{stats.mae}</div></div>
                      <div><div className="text-xs text-indigo-400 mb-1 font-bold">RMSE</div><div className="text-xl font-bold text-white">{stats.rmse}</div></div>
                      <div><div className="text-xs text-indigo-400 mb-1 font-bold">R2</div><div className="text-xl font-bold text-white">{stats.r2}</div></div>
                      <div><div className="text-xs text-indigo-400 mb-1 font-bold">MAPE</div><div className="text-xl font-bold text-white">{stats.mape}%</div></div>
                      <div><div className="text-xs text-indigo-400 mb-1 font-bold">Features</div><div className="text-xl font-bold text-white">{stats.feature_count}</div></div>
                      <div><div className="text-xs text-indigo-400 mb-1 font-bold">Model</div><div className="text-lg font-bold text-sky-400">{stats.model_type}</div></div>
                    </div>
                  ) : (
                    <p className="text-indigo-300 text-center">Model stats are currently unavailable.</p>
                  )}
                </GlassCard>
              </>
            )}

            {activeView === 'comparison' && liveByCity.Mumbai && liveByCity.Delhi && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AQIGauge city="Mumbai" data={liveByCity.Mumbai} />
                  <AQIGauge city="Delhi" data={liveByCity.Delhi} />
                </div>

                <GlassCard title={`${selectedPollutantLabel} Comparison (${analysisWindow}-Day Forecast)`}>
                  <div className="mb-4 flex items-center gap-3">
                    <label className="text-indigo-200 text-sm font-semibold" htmlFor="pollutant-selector">
                      Pollutant
                    </label>
                    <select
                      id="pollutant-selector"
                      className="bg-indigo-950/80 border border-white/20 rounded-lg px-3 py-2 text-sm text-indigo-100"
                      value={comparePollutant}
                      onChange={(event) => setComparePollutant(event.target.value as ForecastPollutantKey)}
                    >
                      {POLLUTANTS.map((pollutant) => (
                        <option key={pollutant.forecastKey} value={pollutant.forecastKey}>
                          {pollutant.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={compareSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="date" stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Legend iconType="circle" />
                        <Line type="monotone" dataKey="Mumbai" stroke="#38bdf8" strokeWidth={2.4} dot={false} />
                        <Line type="monotone" dataKey="Delhi" stroke="#f472b6" strokeWidth={2.4} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GlassCard title="Normalized Pollutant Radar (0-100)">
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={compareRadar}>
                          <PolarGrid stroke="#ffffff10" />
                          <PolarAngleAxis dataKey="pollutant" stroke="#818cf8" fontSize={12} fontWeight={600} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#ffffff10" tick={false} />
                          <Radar name="Mumbai" dataKey="Mumbai" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.3} />
                          <Radar name="Delhi" dataKey="Delhi" stroke="#f472b6" fill="#f472b6" fillOpacity={0.28} />
                          <Legend />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </GlassCard>

                  <GlassCard title="Today Summary">
                    <div className="space-y-4 text-indigo-200 leading-relaxed font-medium">
                      <p className="text-lg">{summary}</p>
                      <div className="pt-4 grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 shadow-sm">
                          <div className="text-xs text-indigo-400 uppercase mb-1 font-bold">Mumbai AQI</div>
                          <div className="text-2xl font-bold text-white">{liveByCity.Mumbai.aqi ?? 'N/A'}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 shadow-sm">
                          <div className="text-xs text-indigo-400 uppercase mb-1 font-bold">Delhi AQI</div>
                          <div className="text-2xl font-bold text-white">{liveByCity.Delhi.aqi ?? 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}
          </main>
        )}

        <footer className="pt-12 pb-6 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-bold">
            <Wind size={16} />
            <span>Aura Atmospheric Intelligence v1.1</span>
          </div>
          <div className="text-indigo-400 text-sm font-bold">Forecasting for Mumbai and Delhi</div>
        </footer>
      </div>
    </div>
  )
}
