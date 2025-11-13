import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

export function MainDashboard() {
  // Debug: Log component mount
  console.log('[MainDashboard] Component mounted - NEW VERSION WITHOUT IMAGES');
  
  const [detectedImages, setDetectedImages] = useState([]);
  const [imageCSVData, setImageCSVData] = useState({});
  const [latencyDurationData, setLatencyDurationData] = useState([]);
  const [attackDefenseTimes, setAttackDefenseTimes] = useState({ timeToAttack: 0, timeToDefense: 0 });
  const [teamDrones, setTeamDrones] = useState([]);
  const [weather, setWeather] = useState(null);
  const [peopleCount, setPeopleCount] = useState(0);
  const [selectedDrone, setSelectedDrone] = useState(null);
  const [cameraPositions, setCameraPositions] = useState([]);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2); // Distance in km
  };

  // Fetch CSV data for a specific image
  const fetchCSVForImage = async (imageFilename) => {
    try {
      const response = await fetch(`/api/csv/for-image/${imageFilename}`);
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setImageCSVData(prev => ({
            ...prev,
            [imageFilename]: data.data
          }));
        } else {
          setImageCSVData(prev => ({
            ...prev,
            [imageFilename]: null
          }));
        }
      }
    } catch (error) {
      console.error(`[MainDashboard] Error fetching CSV for ${imageFilename}:`, error);
      setImageCSVData(prev => ({
        ...prev,
        [imageFilename]: null
      }));
    }
  };

  // Fetch detected images from API
  const fetchDetectedImages = async () => {
    try {
      const response = await fetch("/api/detected/images");
      if (response.ok) {
        const data = await response.json();
        const images = data.images || [];
        setDetectedImages(images);
        
        // Fetch CSV data for all images
        images.forEach(imageFilename => {
          fetchCSVForImage(imageFilename);
        });
      }
    } catch (error) {
      console.error("[MainDashboard] Error fetching detected images:", error);
    }
  };

  // Fetch latency and duration data
  const fetchLatencyDuration = async () => {
    try {
      const response = await fetch("/api/metrics/latency-duration");
      if (response.ok) {
        const data = await response.json();
        const formattedData = data.data.map(item => ({
          time: new Date(item.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          latency: Math.round(item.latency),
          duration: Math.round(item.duration)
        }));
        setLatencyDurationData(formattedData);
      }
    } catch (error) {
      console.error("[MainDashboard] Error fetching latency/duration:", error);
    }
  };

  // Fetch attack and defense times
  const fetchAttackDefense = async () => {
    try {
      const response = await fetch("/api/metrics/attack-defense");
      if (response.ok) {
        const data = await response.json();
        setAttackDefenseTimes({
          timeToAttack: Math.round(data.timeToAttack),
          timeToDefense: Math.round(data.timeToDefense)
        });
      }
    } catch (error) {
      console.error("[MainDashboard] Error fetching attack/defense times:", error);
    }
  };

  // Fetch team drones
  const fetchTeamDrones = async () => {
    try {
      const response = await fetch("/api/team/drones");
      if (response.ok) {
        const data = await response.json();
        setTeamDrones(data.drones || []);
      }
    } catch (error) {
      console.error("[MainDashboard] Error fetching team drones:", error);
    }
  };

  // Fetch weather
  const fetchWeather = async () => {
    try {
      const response = await fetch("/api/weather");
      if (response.ok) {
        const data = await response.json();
        setWeather(data);
      }
    } catch (error) {
      console.error("[MainDashboard] Error fetching weather:", error);
    }
  };

  // Fetch people count
  const fetchPeopleCount = async () => {
    try {
      const response = await fetch("/api/area/people-count");
      if (response.ok) {
        const data = await response.json();
        setPeopleCount(data.count || 0);
      }
    } catch (error) {
      console.error("[MainDashboard] Error fetching people count:", error);
    }
  };

  // Fetch camera positions
  const fetchCameraPositions = async () => {
    try {
      const response = await fetch("/api/cameras");
      if (response.ok) {
        const data = await response.json();
        setCameraPositions(data.cameras || []);
      }
    } catch (error) {
      console.error("[MainDashboard] Error fetching camera positions:", error);
    }
  };

  // Fetch all data on mount and periodically
  useEffect(() => {
    fetchDetectedImages();
    fetchCameraPositions();
    fetchLatencyDuration();
    fetchAttackDefense();
    fetchTeamDrones();
    fetchWeather();
    fetchPeopleCount();
    
    // Refresh data every 5 seconds
    const interval = setInterval(() => {
      fetchDetectedImages();
      fetchLatencyDuration();
      fetchAttackDefense();
      fetchTeamDrones();
      fetchWeather();
      fetchPeopleCount();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Military color theme
  const colors = {
    primary: "#4A5D23",      // Olive drab dark
    secondary: "#6B8E23",    // Olive drab
    accent: "#8B9A46",       // Military green
    warning: "#DAA520",      // Goldenrod
    danger: "#8B0000",       // Dark red
    success: "#2F4F2F",      // Dark green
    bgDark: "#1C1F1A",       // Very dark green-black
    bgMedium: "#2D3028",     // Dark green-gray
    bgLight: "#3A3D35",      // Medium green-gray
    text: "#E8E8D3",         // Light beige
    textSecondary: "#B8B8A3", // Medium beige
    border: "#556B2F"        // Forest green
  };

  return (
    <div style={{ 
      background: colors.bgDark, 
      minHeight: "100vh", 
      padding: "20px",
      position: "relative",
      zIndex: 1
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&family=Orbitron:wght@400;500;600;700&display=swap');
        .main-dashboard {
          width: 100% !important;
          font-family: 'Kanit', sans-serif !important;
          background: ${colors.bgDark} !important;
        }
        .main-dashboard * {
          box-sizing: border-box;
        }
        .main-dashboard h1 {
          font-family: 'Orbitron', sans-serif;
          font-weight: 700;
          font-size: 28px;
          color: ${colors.text};
          margin-bottom: 24px;
          text-transform: uppercase;
          letter-spacing: 2px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
          border-bottom: 3px solid ${colors.primary};
          padding-bottom: 12px;
        }
        .main-dashboard .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .main-dashboard .stat-card {
          background: linear-gradient(135deg, ${colors.bgMedium} 0%, ${colors.bgLight} 100%);
          border: 2px solid ${colors.border};
          border-radius: 4px;
          padding: 16px;
          text-align: center;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .main-dashboard .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .main-dashboard .stat-card h3 {
          font-size: 12px;
          color: ${colors.textSecondary};
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
        }
        .main-dashboard .stat-card .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: ${colors.accent};
          font-family: 'Orbitron', sans-serif;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .main-dashboard .dashboard-grid {
          display: grid;
          grid-template-columns: 2fr 1.2fr 1.2fr;
          gap: 20px;
        }
        .main-dashboard .section {
          background: linear-gradient(135deg, ${colors.bgMedium} 0%, ${colors.bgLight} 100%);
          border: 2px solid ${colors.border};
          border-radius: 4px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .main-dashboard .section h2 {
          color: ${colors.text};
          font-weight: 600;
          margin-bottom: 16px;
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-family: 'Orbitron', sans-serif;
          border-bottom: 2px solid ${colors.primary};
          padding-bottom: 8px;
        }
        .main-dashboard .chart-container {
          background: ${colors.bgDark};
          border: 1px solid ${colors.primary};
          border-radius: 4px;
          padding: 16px;
          min-height: 320px;
        }
        .main-dashboard .info-card {
          background: ${colors.bgDark};
          border: 1px solid ${colors.border};
          border-radius: 4px;
          padding: 14px;
          margin-bottom: 12px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }
        .main-dashboard .info-card h3 {
          font-size: 13px;
          color: ${colors.text};
          margin-bottom: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .main-dashboard .info-card .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 13px;
          color: ${colors.textSecondary};
          padding: 6px 0;
          border-bottom: 1px solid rgba(85, 107, 47, 0.3);
        }
        .main-dashboard .info-card .info-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        .main-dashboard .info-card .info-row span:last-child {
          color: ${colors.text};
          font-weight: 600;
          font-family: 'Orbitron', sans-serif;
        }
        .main-dashboard .team-drone-item {
          background: ${colors.bgDark};
          border: 1px solid ${colors.border};
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 10px;
          font-size: 12px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }
        .main-dashboard .team-drone-item:last-child {
          margin-bottom: 0;
        }
        .main-dashboard .team-drone-item .status {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 3px;
          font-size: 10px;
          margin-left: 8px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .main-dashboard .team-drone-item .status.active {
          background: ${colors.success};
          color: ${colors.text};
          border: 1px solid #4A7C4A;
        }
        .main-dashboard .team-drone-item .status.standby {
          background: ${colors.warning};
          color: #1C1F1A;
          border: 1px solid #B8860B;
        }
        .main-dashboard .team-drone-item .status.maintenance {
          background: ${colors.danger};
          color: ${colors.text};
          border: 1px solid #A00000;
        }
        .main-dashboard .drone-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          max-height: 650px;
        }
        .main-dashboard .drone-item {
          background: ${colors.bgDark};
          border: 1px solid ${colors.border};
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          padding: 12px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }
        .main-dashboard .drone-item:hover {
          background: ${colors.bgLight};
          border-color: ${colors.accent};
          box-shadow: 0 2px 8px rgba(107, 142, 35, 0.3), inset 0 2px 4px rgba(0,0,0,0.3);
          transform: translateX(4px);
        }
        .main-dashboard .drone-info {
          font-size: 12px;
          color: ${colors.textSecondary};
          line-height: 1.6em;
        }
        .main-dashboard .drone-info strong {
          color: ${colors.text};
          font-weight: 600;
        }
        .main-dashboard .drone-list::-webkit-scrollbar { 
          width: 8px; 
        }
        .main-dashboard .drone-list::-webkit-scrollbar-thumb { 
          background: ${colors.border}; 
          border-radius: 4px; 
        }
        .main-dashboard .drone-list::-webkit-scrollbar-track { 
          background: ${colors.bgDark}; 
        }
      `}</style>
      
      <div className="main-dashboard">
        <h1>🎯 Main Command Dashboard</h1>
        
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3>⚠️ Detected Threats</h3>
            <div className="stat-value">{detectedImages.length}</div>
          </div>
          <div className="stat-card">
            <h3>🚁 Active Units</h3>
            <div className="stat-value">{teamDrones.length}</div>
          </div>
          <div className="stat-card">
            <h3>👥 Personnel Count</h3>
            <div className="stat-value">{peopleCount}</div>
          </div>
          <div className="stat-card">
            <h3>🌡️ Weather</h3>
            <div className="stat-value" style={{ fontSize: "24px" }}>
              {weather ? `${weather.temperature}°C` : "N/A"}
            </div>
            <div style={{ fontSize: "11px", color: colors.textSecondary, marginTop: "6px", textTransform: "uppercase" }}>
              {weather ? weather.condition : ""}
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          {/* Left Column - Performance Metrics */}
          <div>
            {/* Latency and Duration Graph */}
            <div className="section">
              <h2>📊 System Performance Metrics</h2>
              <div className="chart-container">
                {latencyDurationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={latencyDurationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} opacity={0.3} />
                      <XAxis 
                        dataKey="time" 
                        stroke={colors.textSecondary}
                        tick={{ fill: colors.textSecondary, fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke={colors.accent}
                        tick={{ fill: colors.accent, fontSize: 10 }}
                        label={{ value: "Latency (ms)", angle: -90, position: "insideLeft", fill: colors.accent, style: { fontSize: 11 } }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke={colors.warning}
                        tick={{ fill: colors.warning, fontSize: 10 }}
                        label={{ value: "Duration (ms)", angle: 90, position: "insideRight", fill: colors.warning, style: { fontSize: 11 } }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: colors.bgMedium, 
                          border: `1px solid ${colors.border}`, 
                          color: colors.text,
                          borderRadius: "4px"
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ color: colors.text, fontSize: "12px" }}
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="latency" 
                        stroke={colors.accent} 
                        strokeWidth={2}
                        dot={{ r: 3, fill: colors.accent }}
                        activeDot={{ r: 5 }}
                        name="Latency (ms)"
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="duration" 
                        stroke={colors.warning} 
                        strokeWidth={2}
                        dot={{ r: 3, fill: colors.warning }}
                        activeDot={{ r: 5 }}
                        name="Duration (ms)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "320px", color: colors.textSecondary }}>
                    Loading performance data...
                  </div>
                )}
              </div>
            </div>

            {/* Attack and Defense Times */}
            <div className="section">
              <h2>⏱️ Response Times</h2>
              <div className="info-card">
                <div className="info-row">
                  <span>⚔️ Time to Attack:</span>
                  <span style={{ color: colors.danger, fontWeight: "700", fontSize: "14px" }}>
                    {attackDefenseTimes.timeToAttack}s
                  </span>
                </div>
                <div className="info-row">
                  <span>🛡️ Time to Defense:</span>
                  <span style={{ color: colors.success, fontWeight: "700", fontSize: "14px" }}>
                    {attackDefenseTimes.timeToDefense}s
                  </span>
                </div>
              </div>
            </div>

            {/* Weather Information */}
            <div className="section">
              <h2>🌤️ Environmental Conditions</h2>
              {weather ? (
                <div className="info-card">
                  <div className="info-row">
                    <span>Condition:</span>
                    <span>{weather.condition}</span>
                  </div>
                  <div className="info-row">
                    <span>Temperature:</span>
                    <span>{weather.temperature}°C</span>
                  </div>
                  <div className="info-row">
                    <span>Humidity:</span>
                    <span>{weather.humidity}%</span>
                  </div>
                  <div className="info-row">
                    <span>Wind Speed:</span>
                    <span>{weather.windSpeed} km/h</span>
                  </div>
                  <div className="info-row">
                    <span>Visibility:</span>
                    <span>{weather.visibility} km</span>
                  </div>
                </div>
              ) : (
                <div style={{ color: colors.textSecondary, fontSize: "12px", padding: "20px", textAlign: "center" }}>
                  Loading environmental data...
                </div>
              )}
            </div>

            {/* People in Attacking Area */}
            <div className="section">
              <h2>👥 Personnel in Operational Zone</h2>
              <div className="info-card">
                <div style={{ 
                  fontSize: "48px", 
                  fontWeight: "700", 
                  color: colors.warning, 
                  textAlign: "center", 
                  padding: "20px",
                  fontFamily: "'Orbitron', sans-serif",
                  textShadow: `0 2px 8px rgba(218, 165, 32, 0.5)`
                }}>
                  {peopleCount}
                </div>
                <div style={{ textAlign: "center", color: colors.textSecondary, fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Personnel Detected
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Team Drones */}
          <div>
            <div className="section">
              <h2>🚁 Fleet Status ({teamDrones.length})</h2>
              <div style={{ maxHeight: "420px", overflowY: "auto" }}>
                {teamDrones.length > 0 ? (
                  teamDrones.map((drone) => (
                    <div key={drone.id} className="team-drone-item">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <strong style={{ color: colors.text, fontSize: "13px" }}>{drone.name}</strong>
                        <span className={`status ${drone.status}`}>
                          {drone.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: colors.textSecondary, marginBottom: "4px" }}>
                        🔋 Battery: <strong style={{ color: colors.text }}>{drone.battery}%</strong>
                      </div>
                      <div style={{ fontSize: "11px", color: colors.textSecondary }}>
                        📍 Loc: <strong style={{ color: colors.text }}>{drone.location.lat.toFixed(4)}, {drone.location.lng.toFixed(4)}</strong>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "30px", textAlign: "center", color: colors.textSecondary }}>
                    No active units available
                  </div>
                )}
              </div>
            </div>

            {/* Team Drones Status Summary */}
            <div className="section">
              <h2>📈 Unit Status Summary</h2>
              <div className="info-card">
                <div className="info-row">
                  <span>✅ Active:</span>
                  <span style={{ color: colors.success, fontWeight: "700" }}>
                    {teamDrones.filter(d => d.status === 'active').length}
                  </span>
                </div>
                <div className="info-row">
                  <span>⏸️ Standby:</span>
                  <span style={{ color: colors.warning, fontWeight: "700" }}>
                    {teamDrones.filter(d => d.status === 'standby').length}
                  </span>
                </div>
                <div className="info-row">
                  <span>🔧 Maintenance:</span>
                  <span style={{ color: colors.danger, fontWeight: "700" }}>
                    {teamDrones.filter(d => d.status === 'maintenance').length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Detected Drones Log */}
          <div>
            <div className="section">
              <h2>⚠️ Threat Log ({detectedImages.length})</h2>
              <div className="drone-list">
                {detectedImages.length > 0 ? (
                  detectedImages.map((imageFilename, index) => {
                    const csvData = imageCSVData[imageFilename];
                    const hasCSV = csvData !== undefined && csvData !== null;
                    const isLoading = csvData === undefined;
                    
                    // Get lat/lng for distance calculation
                    const lat = csvData?.latitude || csvData?.lat;
                    const lng = csvData?.longitude || csvData?.lng;
                    const latNum = lat ? parseFloat(lat) : null;
                    const lngNum = lng ? parseFloat(lng) : null;
                    const activeCameraPos = cameraPositions.length > 0 ? cameraPositions[0] : null;
                    const distance = (latNum && lngNum && activeCameraPos && activeCameraPos.lat && activeCameraPos.lng)
                      ? calculateDistance(activeCameraPos.lat, activeCameraPos.lng, latNum, lngNum)
                      : null;
                    
                    return (
                      <div
                        key={imageFilename}
                        className="drone-item"
                        onClick={() => {
                          if (hasCSV) {
                            setSelectedDrone({
                              imageFilename,
                              csvData,
                              lat: latNum,
                              lng: lngNum,
                              distance
                            });
                          }
                        }}
                        style={{ cursor: hasCSV ? "pointer" : "default" }}
                      >
                        <div className="drone-info">
                          <div style={{ 
                            fontSize: "11px", 
                            color: colors.accent, 
                            marginBottom: "6px", 
                            fontWeight: "700",
                            fontFamily: "'Orbitron', sans-serif",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px"
                          }}>
                            🎯 {imageFilename}
                          </div>
                          {isLoading ? (
                            <div style={{ fontSize: "11px", color: colors.textSecondary, fontStyle: "italic" }}>
                              Loading threat data...
                            </div>
                          ) : hasCSV ? (
                            <>
                              {distance && (
                                <div style={{ fontSize: "11px", color: colors.warning, marginBottom: "6px", fontWeight: "600" }}>
                                  📏 Distance: <strong>{distance} km</strong>
                                </div>
                              )}
                              {latNum && lngNum && (
                                <div style={{ fontSize: "10px", color: colors.textSecondary, marginBottom: "6px" }}>
                                  📍 Coordinates: {latNum.toFixed(4)}, {lngNum.toFixed(4)}
                                </div>
                              )}
                              {Object.entries(csvData)
                                .filter(([key]) => !['latitude', 'longitude', 'lat', 'lng', 'image_name', 'image_name'].includes(key.toLowerCase()))
                                .slice(0, 4)
                                .map(([key, value]) => (
                                  <div key={key} style={{ fontSize: "11px", marginBottom: "4px", color: colors.textSecondary }}>
                                    <strong style={{ color: colors.text }}>{key}:</strong> <span style={{ color: colors.text }}>{value || "N/A"}</span>
                                  </div>
                                ))}
                              {Object.entries(csvData).length > 4 && (
                                <div style={{ fontSize: "10px", color: colors.accent, fontStyle: "italic", marginTop: "6px", fontWeight: "600" }}>
                                  ▶ Click for detailed analysis
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: "11px", color: colors.text }}>
                                <strong>Status:</strong> Threat Detected
                              </div>
                              <div style={{ fontSize: "10px", color: colors.textSecondary, marginTop: "4px" }}>
                                No additional data available
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: "30px", textAlign: "center", color: colors.textSecondary, lineHeight: "1.6" }}>
                    No threats detected
                    <div style={{ fontSize: "11px", marginTop: "8px" }}>
                      System monitoring active
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Threat Detail Modal */}
      {selectedDrone && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px"
          }}
          onClick={() => setSelectedDrone(null)}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${colors.bgMedium} 0%, ${colors.bgLight} 100%)`,
              borderRadius: "4px",
              padding: "28px",
              maxWidth: "700px",
              maxHeight: "90vh",
              overflowY: "auto",
              border: `2px solid ${colors.border}`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)`,
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: colors.danger,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: "4px",
                width: "32px",
                height: "32px",
                cursor: "pointer",
                fontSize: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
              }}
              onClick={() => setSelectedDrone(null)}
            >
              ×
            </button>
            
            <h2 style={{ 
              color: colors.text, 
              marginBottom: "20px", 
              marginTop: "0",
              fontFamily: "'Orbitron', sans-serif",
              textTransform: "uppercase",
              letterSpacing: "1px",
              borderBottom: `2px solid ${colors.primary}`,
              paddingBottom: "12px"
            }}>
              🎯 Threat Analysis Report
            </h2>
            
            <div style={{ color: colors.text, fontSize: "14px", lineHeight: "1.8" }}>
              <div style={{ marginBottom: "16px", padding: "12px", background: colors.bgDark, borderRadius: "4px", border: `1px solid ${colors.border}` }}>
                <strong style={{ color: colors.accent, fontSize: "13px", textTransform: "uppercase" }}>Threat ID:</strong> 
                <div style={{ color: colors.text, marginTop: "4px", fontFamily: "'Orbitron', sans-serif" }}>{selectedDrone.imageFilename}</div>
              </div>
              
              {selectedDrone.lat && selectedDrone.lng && (
                <div style={{ marginBottom: "16px", padding: "12px", background: colors.bgDark, borderRadius: "4px", border: `1px solid ${colors.border}` }}>
                  <strong style={{ color: colors.accent, fontSize: "13px", textTransform: "uppercase" }}>📍 Location Coordinates:</strong>
                  <div style={{ color: colors.text, marginTop: "6px", fontFamily: "'Orbitron', sans-serif" }}>
                    Latitude: <strong>{selectedDrone.lat.toFixed(6)}</strong><br/>
                    Longitude: <strong>{selectedDrone.lng.toFixed(6)}</strong>
                  </div>
                </div>
              )}
              
              {selectedDrone.distance && (
                <div style={{ marginBottom: "16px", padding: "12px", background: colors.bgDark, borderRadius: "4px", border: `1px solid ${colors.warning}` }}>
                  <strong style={{ color: colors.warning, fontSize: "13px", textTransform: "uppercase" }}>📏 Distance from Command Center:</strong>
                  <div style={{ color: colors.text, marginTop: "6px", fontSize: "18px", fontWeight: "700", fontFamily: "'Orbitron', sans-serif" }}>
                    {selectedDrone.distance} km
                  </div>
                </div>
              )}
              
              {selectedDrone.csvData && (
                <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: `2px solid ${colors.border}` }}>
                  <strong style={{ color: colors.accent, fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px" }}>📊 Detailed Threat Data:</strong>
                  <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {Object.entries(selectedDrone.csvData)
                      .filter(([key]) => key !== 'latitude' && key !== 'longitude' && key !== 'image_name')
                      .map(([key, value]) => (
                        <div key={key} style={{ 
                          marginTop: "8px", 
                          padding: "8px", 
                          background: colors.bgDark, 
                          borderRadius: "4px",
                          border: `1px solid ${colors.border}`
                        }}>
                          <strong style={{ color: colors.textSecondary, fontSize: "11px", textTransform: "uppercase" }}>{key}:</strong>
                          <div style={{ color: colors.text, marginTop: "4px", fontWeight: "600" }}>{value || "N/A"}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
