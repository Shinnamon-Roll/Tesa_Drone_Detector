import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export function OffensiveDashboard() {
  const [teamDrones, setTeamDrones] = useState([]);
  const [selectedDrone, setSelectedDrone] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const socketRef = useRef(null);
  
  const MAPBOX_TOKEN = "pk.eyJ1IjoiY2hhdGNoYWxlcm0iLCJhIjoiY21nZnpiYzU3MGRzdTJrczlkd3RxamN4YyJ9.k288gnCNLdLgczawiB79gQ";
  
  // Military color theme (same as MainDashboard)
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

  // Fetch team drones from API
  const fetchTeamDrones = async () => {
    try {
      const response = await fetch("/api/offensive/drones");
      if (response.ok) {
        const data = await response.json();
        setTeamDrones(data.drones || []);
      }
    } catch (error) {
      console.error("[OffensiveDashboard] Error fetching team drones:", error);
    }
  };

  // Connect to Socket.IO for real-time updates
  useEffect(() => {
    const socketUrl = window.location.origin;
    console.log("[OffensiveDashboard] Connecting to Socket.IO at:", socketUrl);
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      path: "/socket.io/"
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[OffensiveDashboard] Connected to server");
      setConnectionStatus("connected");
    });

    socket.on("disconnect", () => {
      console.log("[OffensiveDashboard] Disconnected from server");
      setConnectionStatus("disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("[OffensiveDashboard] Connection error:", error);
      setConnectionStatus("error");
    });

    // Listen for team drones updates
    socket.on("team-drones-update", (data) => {
      console.log("[OffensiveDashboard] Received team drones update:", data);
      setTeamDrones(data.drones || []);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    
    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [100.5018, 13.7563], // Default center (Bangkok area)
      zoom: 12
    });
    
    mapInstanceRef.current = map;
    
    map.on("load", () => {
      console.log("[OffensiveDashboard] Map loaded");
    });
    
    map.on("error", (e) => {
      console.error("[OffensiveDashboard] Map error:", e);
    });
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [MAPBOX_TOKEN]);
  
  // Update map markers when team drones change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => {
      if (marker && marker.remove) marker.remove();
    });
    markersRef.current = {};
    
    // Add markers for each drone
    teamDrones.forEach((drone) => {
      if (!drone.location || !drone.location.lat || !drone.location.lng) return;
      
      const lat = parseFloat(drone.location.lat);
      const lng = parseFloat(drone.location.lng);
      
      if (isNaN(lat) || isNaN(lng)) return;
      
      // Create custom marker element
      const el = document.createElement("div");
      el.className = "drone-marker";
      el.style.width = "30px";
      el.style.height = "30px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = drone.status === "active" ? colors.success : 
                                 drone.status === "standby" ? colors.warning : colors.danger;
      el.style.border = "3px solid white";
      el.style.cursor = "pointer";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.5)";
      el.style.transition = "all 0.3s ease";
      el.title = `${drone.name || `Drone ${drone.id}`} - ${drone.status}`;
      
      // Add pulse animation for active drones
      if (drone.status === "active" && drone.speed > 0) {
        el.style.animation = "pulse 2s infinite";
      }
      
      // Create popup content
      const popupContent = `
        <div style="font-size: 12px; color: #333; min-width: 200px;">
          <strong style="color: ${colors.primary};">${drone.name || `Drone ${drone.id}`}</strong><br/>
          <strong>Status:</strong> ${drone.status}<br/>
          <strong>Location:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}<br/>
          ${drone.height !== undefined ? `<strong>Height:</strong> ${drone.height.toFixed(2)} m<br/>` : ""}
          <strong>Last Update:</strong> ${drone.lastUpdate ? new Date(drone.lastUpdate).toLocaleTimeString() : "N/A"}
        </div>
      `;
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup().setHTML(popupContent))
        .addTo(map);
      
      // Add click handler
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedDrone(drone);
      });
      
      markersRef.current[drone.id] = marker;
    });
    
    // Fit map to show all drones
    if (teamDrones.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      let hasValidLocation = false;
      
      teamDrones.forEach(drone => {
        if (drone.location && drone.location.lat && drone.location.lng) {
          const lat = parseFloat(drone.location.lat);
          const lng = parseFloat(drone.location.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            bounds.extend([lng, lat]);
            hasValidLocation = true;
          }
        }
      });
      
      if (hasValidLocation && !bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 100, maxZoom: 15 });
      }
    }
  }, [teamDrones, colors]);
  
  // Fetch team drones on mount and periodically
  useEffect(() => {
    fetchTeamDrones();
    const interval = setInterval(fetchTeamDrones, 5000);
    return () => clearInterval(interval);
  }, []);

  // Function to center map on specific drone
  const centerOnDrone = (drone) => {
    if (!mapInstanceRef.current || !drone.location) return;
    
    const lat = parseFloat(drone.location.lat);
    const lng = parseFloat(drone.location.lng);
    
    if (isNaN(lat) || isNaN(lng)) return;
    
    mapInstanceRef.current.flyTo({
      center: [lng, lat],
      zoom: 15,
      duration: 1500
    });
    
    // Open popup
    if (markersRef.current[drone.id]) {
      markersRef.current[drone.id].togglePopup();
    }
  };

  // Function to center map on all drones
  const centerOnAllDrones = () => {
    if (!mapInstanceRef.current || teamDrones.length === 0) return;
    
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidLocation = false;
    
    teamDrones.forEach(drone => {
      if (drone.location && drone.location.lat && drone.location.lng) {
        const lat = parseFloat(drone.location.lat);
        const lng = parseFloat(drone.location.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          bounds.extend([lng, lat]);
          hasValidLocation = true;
        }
      }
    });
    
    if (hasValidLocation && !bounds.isEmpty()) {
      mapInstanceRef.current.flyTo({
        bounds: bounds,
        padding: 100,
        duration: 1500
      });
    }
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
        .offensive-dashboard {
          width: 100% !important;
          font-family: 'Kanit', sans-serif !important;
          background: ${colors.bgDark} !important;
        }
        .offensive-dashboard * {
          box-sizing: border-box;
        }
        .offensive-dashboard h1 {
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
        .offensive-dashboard .dashboard-layout {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          height: calc(100vh - 150px);
        }
        .offensive-dashboard .map-section {
          background: linear-gradient(135deg, ${colors.bgMedium} 0%, ${colors.bgLight} 100%);
          border: 2px solid ${colors.border};
          border-radius: 4px;
          padding: 16px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
        }
        .offensive-dashboard .map-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .offensive-dashboard .map-header h2 {
          color: ${colors.text};
          font-weight: 600;
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-family: 'Orbitron', sans-serif;
          margin: 0;
        }
        .offensive-dashboard .map-controls {
          display: flex;
          gap: 8px;
        }
        .offensive-dashboard .map-controls button {
          padding: 6px 12px;
          background: ${colors.primary};
          color: ${colors.text};
          border: 1px solid ${colors.border};
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          transition: all 0.2s;
          font-family: 'Kanit', sans-serif;
        }
        .offensive-dashboard .map-controls button:hover {
          background: ${colors.accent};
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        .offensive-dashboard .map-container {
          flex: 1;
          border-radius: 4px;
          overflow: hidden;
          background: ${colors.bgDark};
          border: 1px solid ${colors.border};
          position: relative;
          min-height: 500px;
        }
        .offensive-dashboard .map-container .mapboxgl-map {
          width: 100%;
          height: 100%;
        }
        .offensive-dashboard .info-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
          max-height: calc(100vh - 150px);
        }
        .offensive-dashboard .info-section::-webkit-scrollbar { 
          width: 8px; 
        }
        .offensive-dashboard .info-section::-webkit-scrollbar-thumb { 
          background: ${colors.border}; 
          border-radius: 4px; 
        }
        .offensive-dashboard .info-section::-webkit-scrollbar-track { 
          background: ${colors.bgDark}; 
        }
        .offensive-dashboard .section {
          background: linear-gradient(135deg, ${colors.bgMedium} 0%, ${colors.bgLight} 100%);
          border: 2px solid ${colors.border};
          border-radius: 4px;
          padding: 16px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .offensive-dashboard .section h2 {
          color: ${colors.text};
          font-weight: 600;
          margin-bottom: 12px;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-family: 'Orbitron', sans-serif;
          border-bottom: 2px solid ${colors.primary};
          padding-bottom: 8px;
        }
        .offensive-dashboard .drone-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .offensive-dashboard .drone-item {
          background: ${colors.bgDark};
          border: 1px solid ${colors.border};
          border-radius: 4px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }
        .offensive-dashboard .drone-item:hover {
          background: ${colors.bgLight};
          border-color: ${colors.accent};
          box-shadow: 0 2px 8px rgba(107, 142, 35, 0.3), inset 0 2px 4px rgba(0,0,0,0.3);
          transform: translateX(4px);
        }
        .offensive-dashboard .drone-item.selected {
          border-color: ${colors.accent};
          border-width: 2px;
          background: ${colors.bgLight};
        }
        .offensive-dashboard .drone-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .offensive-dashboard .drone-name {
          font-weight: 700;
          color: ${colors.text};
          font-size: 14px;
          font-family: 'Orbitron', sans-serif;
        }
        .offensive-dashboard .drone-status {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .offensive-dashboard .drone-status.active {
          background: ${colors.success};
          color: ${colors.text};
          border: 1px solid #4A7C4A;
        }
        .offensive-dashboard .drone-status.standby {
          background: ${colors.warning};
          color: #1C1F1A;
          border: 1px solid #B8860B;
        }
        .offensive-dashboard .drone-status.maintenance {
          background: ${colors.danger};
          color: ${colors.text};
          border: 1px solid #A00000;
        }
        .offensive-dashboard .drone-info {
          font-size: 12px;
          color: ${colors.textSecondary};
          line-height: 1.6em;
        }
        .offensive-dashboard .drone-info strong {
          color: ${colors.text};
          font-weight: 600;
        }
        .offensive-dashboard .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }
        .offensive-dashboard .stat-card {
          background: ${colors.bgDark};
          border: 1px solid ${colors.border};
          border-radius: 4px;
          padding: 12px;
          text-align: center;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }
        .offensive-dashboard .stat-card h3 {
          font-size: 11px;
          color: ${colors.textSecondary};
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .offensive-dashboard .stat-card .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: ${colors.accent};
          font-family: 'Orbitron', sans-serif;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
      
      <div className="offensive-dashboard">
        <h1>🚁 Offensive Operations Dashboard {connectionStatus === "connected" && <span style={{ fontSize: 12, color: colors.success }}>● Live</span>}</h1>
        
        <div className="stats-grid">
          <div className="stat-card">
            <h3>🚁 Total Units</h3>
            <div className="stat-value">{teamDrones.length}</div>
          </div>
          <div className="stat-card">
            <h3>✅ Active</h3>
            <div className="stat-value">{teamDrones.filter(d => d.status === 'active').length}</div>
          </div>
        </div>

        <div className="dashboard-layout">
          {/* Map Section */}
          <div className="map-section">
            <div className="map-header">
              <h2>📍 Real-time Drone Tracking</h2>
              <div className="map-controls">
                <button onClick={centerOnAllDrones} title="Center on all drones">
                  🎯 All Drones
                </button>
                {selectedDrone && (
                  <button onClick={() => centerOnDrone(selectedDrone)} title="Center on selected drone">
                    🎯 Selected
                  </button>
                )}
              </div>
            </div>
            <div className="map-container">
              <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: "500px" }} />
            </div>
          </div>

          {/* Info Section */}
          <div className="info-section">
            {/* Drone List */}
            <div className="section">
              <h2>🚁 Fleet Status ({teamDrones.length})</h2>
              <div className="drone-list">
                {teamDrones.length > 0 ? (
                  teamDrones.map((drone) => (
                    <div
                      key={drone.id}
                      className={`drone-item ${selectedDrone?.id === drone.id ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedDrone(drone);
                        centerOnDrone(drone);
                      }}
                    >
                      <div className="drone-header">
                        <div className="drone-name">{drone.name || `Drone ${drone.id}`}</div>
                        <span className={`drone-status ${drone.status}`}>
                          {drone.status}
                        </span>
                      </div>
                      <div className="drone-info">
                        {drone.location && (
                          <div>
                            <strong>📍 Location:</strong> {parseFloat(drone.location.lat).toFixed(6)}, {parseFloat(drone.location.lng).toFixed(6)}
                          </div>
                        )}
                        {drone.height !== undefined && (
                          <div>
                            <strong>🛸 Height:</strong> {drone.height.toFixed(2)} m
                          </div>
                        )}
                        {drone.lastUpdate && (
                          <div style={{ fontSize: "10px", color: colors.textSecondary, marginTop: "4px" }}>
                            Updated: {new Date(drone.lastUpdate).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "30px", textAlign: "center", color: colors.textSecondary }}>
                    No drones available
                  </div>
                )}
              </div>
            </div>

            {/* Selected Drone Details */}
            {selectedDrone && (
              <div className="section">
                <h2>📊 Drone Details</h2>
                <div style={{ color: colors.text, fontSize: "13px", lineHeight: "1.8" }}>
                  <div style={{ marginBottom: "12px" }}>
                    <strong style={{ color: colors.accent }}>Name:</strong> {selectedDrone.name || `Drone ${selectedDrone.id}`}
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <strong style={{ color: colors.accent }}>Status:</strong> 
                    <span className={`drone-status ${selectedDrone.status}`} style={{ marginLeft: "8px" }}>
                      {selectedDrone.status}
                    </span>
                  </div>
                  {selectedDrone.location && (
                    <div style={{ marginBottom: "16px", padding: "12px", background: colors.bgDark, borderRadius: "4px", border: `1px solid ${colors.border}` }}>
                      <strong style={{ color: colors.accent, fontSize: "13px", textTransform: "uppercase" }}>📍 Location Coordinates:</strong>
                      <div style={{ color: colors.text, marginTop: "6px", fontFamily: "'Orbitron', sans-serif" }}>
                        Latitude: <strong>{parseFloat(selectedDrone.location.lat).toFixed(6)}</strong><br/>
                        Longitude: <strong>{parseFloat(selectedDrone.location.lng).toFixed(6)}</strong>
                      </div>
                    </div>
                  )}
                  {selectedDrone.height !== undefined && (
                    <div style={{ marginBottom: "16px", padding: "12px", background: colors.bgDark, borderRadius: "4px", border: `1px solid ${colors.accent}` }}>
                      <strong style={{ color: colors.accent, fontSize: "13px", textTransform: "uppercase" }}>🛸 Altitude:</strong>
                      <div style={{ color: colors.text, marginTop: "6px", fontSize: "18px", fontWeight: "700", fontFamily: "'Orbitron', sans-serif" }}>
                        {selectedDrone.height.toFixed(2)} m
                      </div>
                    </div>
                  )}
                  {selectedDrone.lastUpdate && (
                    <div style={{ marginBottom: "12px", fontSize: "11px", color: colors.textSecondary }}>
                      <strong>Last Update:</strong> {new Date(selectedDrone.lastUpdate).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Connection Status */}
            <div className="section">
              <h2>🔌 Connection Status</h2>
              <div style={{ color: colors.text, fontSize: "13px" }}>
                <div style={{ marginBottom: "8px" }}>
                  <strong>Server:</strong> 
                  <span style={{ color: connectionStatus === "connected" ? colors.success : colors.danger, marginLeft: "8px" }}>
                    {connectionStatus === "connected" ? "● Connected" : "○ Disconnected"}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: colors.textSecondary }}>
                  Real-time updates: {connectionStatus === "connected" ? "Active" : "Inactive"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
