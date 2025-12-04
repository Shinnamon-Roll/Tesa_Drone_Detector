import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { TacticalCard, GaugeWidget, colorsTactical } from "../components/tactical";

export function MainDashboard() {
  const navigate = useNavigate();
  const [detectedImages, setDetectedImages] = useState([]);
  const [imageCSVData, setImageCSVData] = useState({});
  const [latencyDurationData, setLatencyDurationData] = useState([]);
  const [attackDefenseTimes, setAttackDefenseTimes] = useState({ timeToAttack: 0, timeToDefense: 0 });
  const [teamDrones, setTeamDrones] = useState([]);
  const [weather, setWeather] = useState(null);
  const [peopleCount, setPeopleCount] = useState(0);
  const [selectedDrone, setSelectedDrone] = useState(null);
  const [cameraPositions, setCameraPositions] = useState([]);


  // Calculate distance between two points
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
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

  // Calculate threat level
  const getThreatLevel = () => {
    if (detectedImages.length > 10) return { level: "HIGH", color: colorsTactical.danger };
    if (detectedImages.length > 5) return { level: "MEDIUM", color: colorsTactical.warning };
    return { level: "LOW", color: colorsTactical.success };
  };


  const threat = getThreatLevel();

  // Calculate unit stats for pie chart
  const unitStats = [
    { name: "Active", value: teamDrones.slice(0, 4).filter(d => d.status === 'active').length, color: colorsTactical.success },
    { name: "Standby", value: teamDrones.slice(0, 4).filter(d => d.status === 'standby').length, color: colorsTactical.warning },
    { name: "Maintenance", value: teamDrones.slice(0, 4).filter(d => d.status === 'maintenance').length, color: colorsTactical.danger },
  ].filter(s => s.value > 0);

  return (
    <div style={{
      background: `linear-gradient(135deg, ${colorsTactical.bgDark} 0%, #0F140F 100%)`,
      minHeight: "100vh",
      padding: "30px",
      position: "relative"
    }}>
      {/* Background grid effect */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          linear-gradient(${colorsTactical.accent}15 1px, transparent 1px),
          linear-gradient(90deg, ${colorsTactical.accent}15 1px, transparent 1px)
        `,
        backgroundSize: "50px 50px",
        zIndex: 0,
        opacity: 0.3,
        pointerEvents: "none"
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* Top Stats Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "20px",
          marginBottom: "30px"
        }}>
          {/* Threat Level Card */}
          <TacticalCard
            title="THREAT LEVEL"
            icon="⚠️"
            status={threat.level === "HIGH" ? "danger" : threat.level === "MEDIUM" ? "warning" : "success"}
            glowing={threat.level === "HIGH"}
          >
            <div style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{
                fontSize: "42px",
                fontWeight: 700,
                color: threat.color,
                fontFamily: "'Orbitron', sans-serif",
                textShadow: `0 0 20px ${threat.color}`,
                marginBottom: "10px"
              }}>
                {threat.level}
              </div>
              <div style={{
                fontSize: "11px",
                color: colorsTactical.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "1px"
              }}>
                {detectedImages.length} Detections
              </div>
            </div>
          </TacticalCard>

          {/* Active Units Gauge */}
          <TacticalCard title="ACTIVE UNITS" icon="🚁">
            <div style={{ display: "flex", justifyContent: "center", padding: "10px" }}>
              <GaugeWidget
                value={teamDrones.filter(d => d.status === 'active').length}
                max={4}
                unit="/"
                label={`${Math.min(teamDrones.length, 4)} UNITS`}
                size="small"
                danger={1}
                warn={2}
              />
            </div>
          </TacticalCard>

          {/* Personnel Count */}
          <TacticalCard title="PERSONNEL" icon="👥">
            <div style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{
                fontSize: "42px",
                fontWeight: 700,
                color: colorsTactical.info,
                fontFamily: "'Orbitron', sans-serif",
                textShadow: `0 0 20px ${colorsTactical.info}`
              }}>
                {peopleCount}
              </div>
              <div style={{
                fontSize: "10px",
                color: colorsTactical.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginTop: "8px"
              }}>
                In AO Zone
              </div>
            </div>
          </TacticalCard>

          {/* Response Time */}
          <TacticalCard title="RESPONSE" icon="⏱️" status="success">
            <div style={{ padding: "10px" }}>
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "10px", color: colorsTactical.textMuted, marginBottom: "4px" }}>ATTACK</div>
                <div style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: colorsTactical.danger,
                  fontFamily: "'Orbitron', monospace"
                }}>
                  {attackDefenseTimes.timeToAttack}s
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: colorsTactical.textMuted, marginBottom: "4px" }}>DEFENSE</div>
                <div style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: colorsTactical.success,
                  fontFamily: "'Orbitron', monospace"
                }}>
                  {attackDefenseTimes.timeToDefense}s
                </div>
              </div>
            </div>
          </TacticalCard>

          {/* Weather */}
          <TacticalCard title="ENVIRONMENT" icon="🌤️">
            <div style={{ padding: "10px" }}>
              {weather ? (
                <>
                  <div style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: colorsTactical.accent,
                    fontFamily: "'Orbitron', sans-serif",
                    textAlign: "center",
                    marginBottom: "8px"
                  }}>
                    {weather.temperature}°C
                  </div>
                  <div style={{
                    fontSize: "10px",
                    color: colorsTactical.textSecondary,
                    textAlign: "center",
                    textTransform: "uppercase",
                    letterSpacing: "1px"
                  }}>
                    {weather.condition}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "20px", color: colorsTactical.textMuted }}>
                  Loading...
                </div>
              )}
            </div>
          </TacticalCard>
        </div>

        {/* Main Content Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.2fr 1.5fr",
          gap: "30px"
        }}>

          {/* Left Column - Performance */}
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            {/* Performance Metrics */}
            <TacticalCard title="SYSTEM PERFORMANCE" icon="📊" refreshable onRefresh={fetchLatencyDuration}>
              <div style={{ height: "350px" }}>
                {latencyDurationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={latencyDurationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colorsTactical.border} opacity={0.3} />
                      <XAxis
                        dataKey="time"
                        stroke={colorsTactical.textSecondary}
                        tick={{ fill: colorsTactical.textSecondary, fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke={colorsTactical.accent}
                        tick={{ fill: colorsTactical.accent, fontSize: 10 }}
                        label={{ value: "Latency (ms)", angle: -90, position: "insideLeft", fill: colorsTactical.accent, style: { fontSize: 11 } }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke={colorsTactical.warning}
                        tick={{ fill: colorsTactical.warning, fontSize: 10 }}
                        label={{ value: "Duration (ms)", angle: 90, position: "insideRight", fill: colorsTactical.warning, style: { fontSize: 11 } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: colorsTactical.bgMedium,
                          border: `1px solid ${colorsTactical.border}`,
                          color: colorsTactical.textPrimary,
                          borderRadius: "4px"
                        }}
                      />
                      <Legend
                        wrapperStyle={{ color: colorsTactical.textPrimary, fontSize: "12px" }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="latency"
                        stroke={colorsTactical.accent}
                        strokeWidth={2}
                        dot={{ r: 3, fill: colorsTactical.accent }}
                        activeDot={{ r: 5 }}
                        name="Latency (ms)"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="duration"
                        stroke={colorsTactical.warning}
                        strokeWidth={2}
                        dot={{ r: 3, fill: colorsTactical.warning }}
                        activeDot={{ r: 5 }}
                        name="Duration (ms)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: colorsTactical.textMuted }}>
                    Loading performance data...
                  </div>
                )}
              </div>
            </TacticalCard>

            {/* Environmental Details */}
            <TacticalCard title="ENVIRONMENTAL DATA" icon="🌡️">
              {weather ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: colorsTactical.textMuted, marginBottom: "4px" }}>CONDITION</div>
                    <div style={{ fontSize: "14px", color: colorsTactical.textPrimary, fontWeight: 600 }}>{weather.condition}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: colorsTactical.textMuted, marginBottom: "4px" }}>TEMPERATURE</div>
                    <div style={{ fontSize: "14px", color: colorsTactical.textPrimary, fontWeight: 600 }}>{weather.temperature}°C</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: colorsTactical.textMuted, marginBottom: "4px" }}>HUMIDITY</div>
                    <div style={{ fontSize: "14px", color: colorsTactical.textPrimary, fontWeight: 600 }}>{weather.humidity}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: colorsTactical.textMuted, marginBottom: "4px" }}>WIND SPEED</div>
                    <div style={{ fontSize: "14px", color: colorsTactical.textPrimary, fontWeight: 600 }}>{weather.windSpeed} km/h</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: colorsTactical.textMuted, marginBottom: "4px" }}>VISIBILITY</div>
                    <div style={{ fontSize: "14px", color: colorsTactical.textPrimary, fontWeight: 600 }}>{weather.visibility} km</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: colorsTactical.textMuted, marginBottom: "4px" }}>CONDITIONS</div>
                    <div style={{
                      fontSize: "12px",
                      color: weather.visibility > 5 ? colorsTactical.success : colorsTactical.warning,
                      fontWeight: 600
                    }}>
                      {weather.visibility > 5 ? "OPTIMAL" : "LIMITED"}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "20px", color: colorsTactical.textMuted }}>
                  Loading environmental data...
                </div>
              )}
            </TacticalCard>
          </div>

          {/* Middle Column - Fleet Status */}
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <TacticalCard
              title="FLEET STATUS"
              icon="🚁"
              headerAction={
                <button
                  onClick={() => navigate("/offensive")}
                  style={{
                    padding: "6px 12px",
                    background: colorsTactical.accent,
                    color: colorsTactical.bgDark,
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: 700,
                    fontFamily: "'Orbitron', sans-serif",
                    transition: "all 0.2s",
                    textTransform: "uppercase",
                    letterSpacing: "1px"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = colorsTactical.accentDim;
                    e.target.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = colorsTactical.accent;
                    e.target.style.transform = "scale(1)";
                  }}
                >
                  → DETAILS
                </button>
              }
            >
              <div style={{ marginBottom: "20px" }}>
                {teamDrones.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "350px", overflowY: "auto" }}>
                    {teamDrones.slice(0, 4).map((drone) => (
                      <div
                        key={drone.id}
                        style={{
                          background: colorsTactical.bgMedium,
                          border: `1px solid ${drone.status === 'active' ? colorsTactical.success : drone.status === 'standby' ? colorsTactical.warning : colorsTactical.danger}`,
                          borderRadius: "6px",
                          padding: "12px",
                          boxShadow: drone.status === 'active' ? colorsTactical.glowSuccess : "none"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <div style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: colorsTactical.textPrimary,
                            fontFamily: "'Orbitron', sans-serif"
                          }}>
                            {drone.name}
                          </div>
                          <div style={{
                            fontSize: "9px",
                            padding: "3px 8px",
                            borderRadius: "3px",
                            background: drone.status === 'active' ? colorsTactical.success : drone.status === 'standby' ? colorsTactical.warning : colorsTactical.danger,
                            color: colorsTactical.bgDark,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px"
                          }}>
                            {drone.status}
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "10px" }}>
                          <div>
                            <span style={{ color: colorsTactical.textMuted }}>🔋 BAT:</span>
                            <span style={{ color: colorsTactical.textPrimary, marginLeft: "4px", fontWeight: 600 }}>
                              {drone.battery}%
                            </span>
                          </div>
                          <div>
                            <span style={{ color: colorsTactical.textMuted }}>📍 POS:</span>
                            <span style={{ color: colorsTactical.textPrimary, marginLeft: "4px", fontWeight: 600 }}>
                              {drone.location.lat.toFixed(2)}, {drone.location.lng.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "30px", color: colorsTactical.textMuted }}>
                    No units available
                  </div>
                )}
              </div>

              {/* Unit Status Pie Chart */}
              {unitStats.length > 0 && (
                <div>
                  <div style={{
                    fontSize: "12px",
                    color: colorsTactical.textSecondary,
                    marginBottom: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    fontWeight: 600
                  }}>
                    Unit Distribution
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={unitStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {unitStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: colorsTactical.bgMedium,
                          border: `1px solid ${colorsTactical.border}`,
                          borderRadius: "4px",
                          color: colorsTactical.textPrimary
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </TacticalCard>
          </div>

          {/* Right Column - Threat Log */}
          <div>
            <TacticalCard
              title="THREAT LOG"
              icon="⚠️"
              status={threat.level === "HIGH" ? "danger" : threat.level === "MEDIUM" ? "warning" : "normal"}
              glowing={threat.level === "HIGH"}
              headerAction={
                <button
                  onClick={() => navigate("/defensive")}
                  style={{
                    padding: "6px 12px",
                    background: colorsTactical.danger,
                    color: colorsTactical.textPrimary,
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: 700,
                    fontFamily: "'Orbitron', sans-serif",
                    transition: "all 0.2s",
                    textTransform: "uppercase",
                    letterSpacing: "1px"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = "scale(1.05)";
                    e.target.style.boxShadow = colorsTactical.glowDanger;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "scale(1)";
                    e.target.style.boxShadow = "none";
                  }}
                >
                  → ANALYZE
                </button>
              }
            >
              <div style={{ maxHeight: "700px", overflowY: "auto" }}>
                {detectedImages.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {detectedImages.map((imageFilename, index) => {
                      const csvData = imageCSVData[imageFilename];
                      const hasCSV = csvData !== undefined && csvData !== null;
                      const isLoading = csvData === undefined;

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
                          style={{
                            background: colorsTactical.bgMedium,
                            border: `1px solid ${colorsTactical.danger}`,
                            borderLeft: `4px solid ${colorsTactical.danger}`,
                            borderRadius: "4px",
                            padding: "12px",
                            cursor: hasCSV ? "pointer" : "default",
                            transition: "all 0.2s",
                            boxShadow: `inset 0 0 20px ${colorsTactical.danger}20`
                          }}
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
                          onMouseEnter={(e) => {
                            if (hasCSV) {
                              e.currentTarget.style.borderColor = colorsTactical.accent;
                              e.currentTarget.style.transform = "translateX(4px)";
                              e.currentTarget.style.boxShadow = colorsTactical.glowDanger;
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = colorsTactical.danger;
                            e.currentTarget.style.transform = "translateX(0)";
                            e.currentTarget.style.boxShadow = `inset 0 0 20px ${colorsTactical.danger}20`;
                          }}
                        >
                          <div style={{
                            fontSize: "11px",
                            color: colorsTactical.accent,
                            marginBottom: "8px",
                            fontWeight: 700,
                            fontFamily: "'Orbitron', monospace",
                            textTransform: "uppercase"
                          }}>
                            🎯 THREAT-{String(index + 1).padStart(3, '0')}
                          </div>
                          <div style={{
                            fontSize: "9px",
                            color: colorsTactical.textMuted,
                            marginBottom: "6px"
                          }}>
                            {imageFilename}
                          </div>
                          {isLoading ? (
                            <div style={{ fontSize: "10px", color: colorsTactical.textMuted, fontStyle: "italic" }}>
                              Analyzing threat data...
                            </div>
                          ) : hasCSV ? (
                            <>
                              {distance && (
                                <div style={{
                                  fontSize: "11px",
                                  color: colorsTactical.warning,
                                  marginBottom: "6px",
                                  fontWeight: 600
                                }}>
                                  📏 RANGE: <span style={{ color: colorsTactical.textPrimary }}>{distance} km</span>
                                </div>
                              )}
                              {latNum && lngNum && (
                                <div style={{ fontSize: "9px", color: colorsTactical.textMuted, marginBottom: "6px" }}>
                                  📍 POS: {latNum.toFixed(4)}, {lngNum.toFixed(4)}
                                </div>
                              )}
                              <div style={{
                                fontSize: "9px",
                                color: colorsTactical.accent,
                                fontStyle: "italic",
                                marginTop: "8px"
                              }}>
                                ▶ Click for detailed analysis
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize: "10px", color: colorsTactical.textMuted }}>
                              No additional data available
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{
                    textAlign: "center",
                    padding: "50px 20px",
                    color: colorsTactical.textMuted
                  }}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
                    <div style={{ fontSize: "14px", marginBottom: "8px", color: colorsTactical.success }}>NO THREATS DETECTED</div>
                    <div style={{ fontSize: "10px" }}>System monitoring active</div>
                  </div>
                )}
              </div>
            </TacticalCard>
          </div>
        </div>
      </div>

      {/* Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&display=swap');
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: ${colorsTactical.accent} ${colorsTactical.bgDark};
        }

        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        *::-webkit-scrollbar-track {
          background: ${colorsTactical.bgDark};
        }

        *::-webkit-scrollbar-thumb {
          background: ${colorsTactical.accent};
          border-radius: 4px;
        }

        *::-webkit-scrollbar-thumb:hover {
          background: ${colorsTactical.accentDim};
        }
      `}</style>

      {/* Threat Detail Modal */}
      {selectedDrone && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(10px)"
          }}
          onClick={() => setSelectedDrone(null)}
        >
          <TacticalCard
            title="THREAT ANALYSIS"
            icon="🎯"
            status="danger"
            glowing={true}
            style={{ maxWidth: "600px", width: "90%", maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div style={{
                fontSize: "12px",
                color: colorsTactical.textMuted,
                marginBottom: "4px"
              }}>
                TARGET ID
              </div>
              <div style={{
                fontSize: "16px",
                color: colorsTactical.accent,
                fontFamily: "'Orbitron', monospace",
                fontWeight: 700,
                marginBottom: "20px"
              }}>
                {selectedDrone.imageFilename}
              </div>

              {selectedDrone.distance && (
                <div style={{ marginBottom: "20px" }}>
                  <div style={{
                    fontSize: "12px",
                    color: colorsTactical.textMuted,
                    marginBottom: "4px"
                  }}>
                    RANGE FROM SENSOR
                  </div>
                  <div style={{
                    fontSize: "24px",
                    color: colorsTactical.warning,
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700
                  }}>
                    {selectedDrone.distance} km
                  </div>
                </div>
              )}

              {selectedDrone.lat && selectedDrone.lng && (
                <div style={{ marginBottom: "20px" }}>
                  <div style={{
                    fontSize: "12px",
                    color: colorsTactical.textMuted,
                    marginBottom: "4px"
                  }}>
                    COORDINATES
                  </div>
                  <div style={{
                    fontSize: "14px",
                    color: colorsTactical.textPrimary,
                    fontFamily: "'Orbitron', monospace",
                    fontWeight: 600
                  }}>
                    {selectedDrone.lat.toFixed(6)}, {selectedDrone.lng.toFixed(6)}
                  </div>
                </div>
              )}

              {selectedDrone.csvData && (
                <div>
                  <div style={{
                    fontSize: "12px",
                    color: colorsTactical.textMuted,
                    marginBottom: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "1px"
                  }}>
                    Threat Data
                  </div>
                  <div style={{
                    background: colorsTactical.bgDark,
                    border: `1px solid ${colorsTactical.border}`,
                    borderRadius: "4px",
                    padding: "16px"
                  }}>
                    {Object.entries(selectedDrone.csvData)
                      .filter(([key]) => !['latitude', 'longitude', 'lat', 'lng', 'image_name'].includes(key.toLowerCase()))
                      .map(([key, value]) => (
                        <div key={key} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 0",
                          borderBottom: `1px solid ${colorsTactical.border}30`,
                          fontSize: "12px"
                        }}>
                          <span style={{ color: colorsTactical.textSecondary, textTransform: "uppercase" }}>
                            {key}:
                          </span>
                          <span style={{ color: colorsTactical.textPrimary, fontWeight: 600, fontFamily: "'Orbitron', monospace" }}>
                            {value || "N/A"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedDrone(null)}
                style={{
                  width: "100%",
                  marginTop: "24px",
                  padding: "12px",
                  background: colorsTactical.danger,
                  color: colorsTactical.textPrimary,
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 700,
                  fontFamily: "'Orbitron', sans-serif",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = "scale(1.02)";
                  e.target.style.boxShadow = colorsTactical.glowDanger;
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "scale(1)";
                  e.target.style.boxShadow = "none";
                }}
              >
                CLOSE
              </button>
            </div>
          </TacticalCard>
        </div>
      )}
    </div>
  );
}
