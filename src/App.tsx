import { useState, useMemo, ReactNode, useEffect, useRef } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wind, Activity, BarChart3, Map, Info, RefreshCw, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Droplets, 
  CloudRain, Thermometer, Sun, Compass
} from 'lucide-react';
import { cn } from './lib/utils';
import { 
  MOCK_DATA, CITIES, SEVEN_DAY_STRIP, FORECAST_DATA, 
  COMPARISON_30_DAYS, RADAR_DATA, AQIData 
} from './data';

// --- Wind Animation Component ---

const WindBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<any[]>([]);
  const animationFrameId = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    // Initialize particles
    const createParticle = (x?: number, y?: number, isGust = false) => ({
      x: x ?? Math.random() * canvas.width,
      y: y ?? Math.random() * canvas.height,
      vx: (isGust ? 5 + Math.random() * 10 : 1 + Math.random() * 2),
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.1,
      life: isGust ? 100 : Infinity,
    });

    for (let i = 0; i < 50; i++) {
      particles.current.push(createParticle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.current.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x > canvas.width) {
          if (p.life === Infinity) {
            p.x = -10;
            p.y = Math.random() * canvas.height;
          } else {
            particles.current.splice(i, 1);
          }
        }

        if (p.life !== Infinity) {
          p.life--;
          if (p.life <= 0) particles.current.splice(i, 1);
        }

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 5, p.y - p.vy * 5);
        ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity * (p.life === Infinity ? 1.5 : p.life / 50)})`;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.stroke();
      });

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    const handleClick = (e: MouseEvent) => {
      for (let i = 0; i < 30; i++) {
        particles.current.push(createParticle(e.clientX, e.clientY, true));
      }
    };

    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0 opacity-60"
      style={{ filter: 'blur(0.5px)' }}
    />
  );
};

// --- Components ---

const GlassCard = ({ children, className, title }: { children: ReactNode, className?: string, title?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("glass rounded-3xl p-6 overflow-hidden relative", className)}
  >
    {title && <h3 className="text-lg font-semibold mb-4 text-indigo-100/80">{title}</h3>}
    {children}
  </motion.div>
);

const PollutantCard = ({ label, value, unit, icon: Icon }: { label: string, value: number | string, unit: string, icon: any }) => (
  <div className="glass-dark rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1">
    <span className="text-sm font-medium text-indigo-300/60">{label}</span>
    <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
    <span className="text-xs text-indigo-400/50">{unit}</span>
  </div>
);

const AQIGauge = ({ value, label, city }: { value: number, label: string, city: string }) => {
  const percentage = Math.min((value / 300) * 100, 100);
  const color = value > 150 ? '#f43f5e' : value > 100 ? '#f59e0b' : '#10b981';
  
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="80"
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            className="text-white/5"
          />
          <motion.circle
            cx="96"
            cy="96"
            r="80"
            stroke={color}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={502.4}
            initial={{ strokeDashoffset: 502.4 }}
            animate={{ strokeDashoffset: 502.4 - (502.4 * percentage) / 100 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-medium text-indigo-300/40 uppercase tracking-widest">AQI</span>
          <span className="text-5xl font-bold text-white tracking-tighter">{value}</span>
          <span className="text-sm font-medium mt-1" style={{ color }}>{label}</span>
        </div>
      </div>
      <h4 className="mt-4 text-xl font-semibold text-indigo-100">{city}</h4>
      <p className="text-xs text-indigo-400 mt-1 font-medium">PM2.5: {value * 0.4} µg/m³</p>
    </div>
  );
};

// --- Views ---

const DashboardView = ({ city, data }: { city: string, data: AQIData }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main AQI Card */}
      <GlassCard className="lg:col-span-5 flex flex-col items-center justify-center text-center py-12">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 opacity-50" />
        <h2 className="text-2xl font-light text-indigo-300 uppercase tracking-[0.2em] mb-2">Today's AQI</h2>
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-[120px] font-bold leading-none tracking-tighter text-white text-glow"
        >
          {data.aqi}
        </motion.div>
        <div className="mt-4 px-8 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-sm">
          <span className="text-xl font-semibold text-indigo-100 tracking-wide">{data.category}</span>
        </div>
        <div className="mt-8 space-y-1">
          <p className="text-lg text-indigo-300">PM2.5: <span className="text-white font-bold">{data.pm25} µg/m³</span></p>
          <p className="text-sm text-indigo-400/60 font-medium">Last updated: {data.lastUpdated}</p>
        </div>
      </GlassCard>

      {/* Pollutant Grid */}
      <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-4">
        <PollutantCard label="PM2.5" value={data.pm25} unit="µg/m³" icon={Wind} />
        <PollutantCard label="PM10" value={data.pm10} unit="µg/m³" icon={Activity} />
        <PollutantCard label="NO2" value={data.no2} unit="ppb" icon={Activity} />
        <PollutantCard label="SO2" value={data.so2} unit="ppb" icon={Activity} />
        <PollutantCard label="CO" value={data.co} unit="ppm" icon={Activity} />
        <PollutantCard label="O3" value={data.o3} unit="ppb" icon={Activity} />
      </div>

      {/* 7-Day Strip */}
      <div className="lg:col-span-12 mt-4">
        <h3 className="text-xl font-bold text-indigo-100 mb-6 px-2">7-Day Quick AQI Strip</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {SEVEN_DAY_STRIP.map((day, idx) => (
            <div key={idx}>
              <GlassCard className="p-4 flex flex-col items-center text-center space-y-2 hover:bg-white/10 transition-colors cursor-default">
                <span className="text-xs text-indigo-400 font-bold">{day.date}</span>
                <div className="text-2xl font-bold text-rose-400">AQI {day.aqi}</div>
                <span className="text-xs font-semibold text-indigo-300">{day.category}</span>
              </GlassCard>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ForecastView = ({ city }: { city: string }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard title="Predicted PM2.5 vs Actual PM2.5">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={FORECAST_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="date" stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 500, color: '#818cf8' }} />
                <Line type="monotone" dataKey="actual_pm25" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316' }} activeDot={{ r: 6 }} name="Actual PM2.5" />
                <Line type="monotone" dataKey="predicted_pm25" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, fill: '#38bdf8' }} activeDot={{ r: 6 }} name="Predicted PM2.5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard title="Daily AQI">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FORECAST_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="date" stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#ffffff05' }}
                  contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                />
                <Bar dataKey="aqi" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard title="Pollutants Trend (PM2.5, PM10, NO2, O3)">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={FORECAST_DATA}>
                <defs>
                  <linearGradient id="colorPm25" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="date" stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }} />
                <Area type="monotone" dataKey="actual_pm25" stroke="#38bdf8" fillOpacity={1} fill="url(#colorPm25)" name="PM2.5" />
                <Area type="monotone" dataKey="no2" stroke="#ec4899" fillOpacity={0} name="NO2" />
                <Area type="monotone" dataKey="o3" stroke="#a78bfa" fillOpacity={0} name="O3" />
                <Area type="monotone" dataKey="pm10" stroke="#34d399" fillOpacity={0} name="PM10" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard title="AQI Category Distribution">
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ name: 'Unhealthy', value: 100 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#f43f5e" />
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="py-8">
        <h4 className="text-center text-indigo-300 mb-8 uppercase tracking-widest text-xs font-bold">Model Accuracy</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 text-center">
          <div><div className="text-xs text-indigo-400 mb-1 font-bold">MAE</div><div className="text-xl font-bold text-white">7.95</div></div>
          <div><div className="text-xs text-indigo-400 mb-1 font-bold">RMSE</div><div className="text-xl font-bold text-white">10.38</div></div>
          <div><div className="text-xs text-indigo-400 mb-1 font-bold">R2</div><div className="text-xl font-bold text-white">0.7451</div></div>
          <div><div className="text-xs text-indigo-400 mb-1 font-bold">MAPE</div><div className="text-xl font-bold text-white">49.4%</div></div>
          <div><div className="text-xs text-indigo-400 mb-1 font-bold">Features</div><div className="text-xl font-bold text-white">24</div></div>
          <div><div className="text-xs text-indigo-400 mb-1 font-bold">Model</div><div className="text-xl font-bold text-sky-400">Bidirectional LSTM</div></div>
        </div>
      </GlassCard>
    </div>
  );
};

const ComparisonView = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="flex items-center justify-center py-8">
          <AQIGauge city="Mumbai" value={156} label="Unhealthy" />
        </GlassCard>
        <GlassCard className="flex items-center justify-center py-8">
          <AQIGauge city="Hyderabad" value={79} label="Moderate" />
        </GlassCard>
      </div>

      <GlassCard title="PM2.5 Comparison (30 Days)">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={COMPARISON_30_DAYS}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="date" stroke="#818cf8" fontSize={10} hide />
              <YAxis stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }} />
              <Legend verticalAlign="top" align="right" iconType="circle" />
              <Line type="monotone" dataKey="Mumbai" stroke="#38bdf8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Hyderabad" stroke="#ec4899" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard title="Normalized Pollutant Radar (0-100)">
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={RADAR_DATA}>
                <PolarGrid stroke="#ffffff10" />
                <PolarAngleAxis dataKey="subject" stroke="#818cf8" fontSize={12} fontWeight={600} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#ffffff10" tick={false} />
                <Radar name="Mumbai" dataKey="Mumbai" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.3} />
                <Radar name="Hyderabad" dataKey="Hyderabad" stroke="#ec4899" fill="#ec4899" fillOpacity={0.3} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard title="Today Summary">
          <div className="space-y-4 text-indigo-200 leading-relaxed font-medium">
            <p className="text-lg">
              <span className="text-sky-400 font-bold">Hyderabad</span> currently has significantly better air quality than <span className="text-pink-400 font-bold">Mumbai</span>, with a lower AQI and reduced PM2.5 levels.
            </p>
            <p>
              Mumbai is experiencing <span className="text-rose-400 font-bold">unhealthy</span> conditions, likely due to increased industrial activity or local weather patterns, while Hyderabad remains <span className="text-emerald-400 font-bold">moderate</span>.
            </p>
            <div className="pt-4 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 shadow-sm">
                <div className="text-xs text-indigo-400 uppercase mb-1 font-bold">Difference</div>
                <div className="text-2xl font-bold text-white">77 AQI</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 shadow-sm">
                <div className="text-xs text-indigo-400 uppercase mb-1 font-bold">Status</div>
                <div className="text-2xl font-bold text-emerald-400">Divergent</div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'forecast' | 'comparison'>('dashboard');
  const [selectedCity, setSelectedCity] = useState<string>(CITIES.MUMBAI);

  const currentData = useMemo(() => MOCK_DATA[selectedCity], [selectedCity]);

  return (
    <div className="min-h-screen bg-mesh p-4 md:p-8 lg:p-12 relative">
      <WindBackground />
      
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Header / Navigation */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white text-glow">
              {activeView === 'dashboard' && "Air Quality Dashboard"}
              {activeView === 'forecast' && "AI Pollution Forecasting"}
              {activeView === 'comparison' && "City Comparison View"}
            </h1>
            <p className="text-indigo-300 font-semibold">
              {activeView === 'forecast' ? "Mumbai & Hyderabad Air Quality" : "Real-time atmospheric monitoring"}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* View Switcher */}
            <div className="glass p-1 rounded-2xl flex items-center shadow-sm">
              <button 
                onClick={() => setActiveView('dashboard')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                  activeView === 'dashboard' ? "bg-white/20 text-white shadow-md" : "text-indigo-300 hover:text-white"
                )}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveView('forecast')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                  activeView === 'forecast' ? "bg-white/20 text-white shadow-md" : "text-indigo-300 hover:text-white"
                )}
              >
                Forecast
              </button>
              <button 
                onClick={() => setActiveView('comparison')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                  activeView === 'comparison' ? "bg-white/20 text-white shadow-md" : "text-indigo-300 hover:text-white"
                )}
              >
                Compare
              </button>
            </div>

            {/* City Toggle (only for non-comparison view) */}
            {activeView !== 'comparison' && (
              <div className="glass p-1 rounded-2xl flex items-center shadow-sm">
                <button 
                  onClick={() => setSelectedCity(CITIES.MUMBAI)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                    selectedCity === CITIES.MUMBAI ? "bg-indigo-500 text-white shadow-md" : "text-indigo-300 hover:text-white"
                  )}
                >
                  Mumbai
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button 
                  onClick={() => setSelectedCity(CITIES.HYDERABAD)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                    selectedCity === CITIES.HYDERABAD ? "bg-indigo-500 text-white shadow-md" : "text-indigo-300 hover:text-white"
                  )}
                >
                  Hyderabad
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView + selectedCity}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {activeView === 'dashboard' && <DashboardView city={selectedCity} data={currentData} />}
              {activeView === 'forecast' && <ForecastView city={selectedCity} />}
              {activeView === 'comparison' && <ComparisonView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="pt-12 pb-6 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-bold">
            <Wind size={16} />
            <span>Aura Atmospheric Intelligence v1.0</span>
          </div>
          <div className="flex items-center gap-6 text-indigo-400 text-sm font-bold">
            <a href="#" className="hover:text-indigo-200 transition-colors">Documentation</a>
            <a href="#" className="hover:text-indigo-200 transition-colors">API Access</a>
            <a href="#" className="hover:text-indigo-200 transition-colors">Privacy</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
