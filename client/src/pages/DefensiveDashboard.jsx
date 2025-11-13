import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
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

export function DefensiveDashboard() {
  const [droneData, setDroneData] = useState(null);
  const [droneList, setDroneList] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [detectedImages, setDetectedImages] = useState([]);
  const [latestDetectedImage, setLatestDetectedImage] = useState(null);
  const [detectedImagesError, setDetectedImagesError] = useState(null);
  const [imageCSVData, setImageCSVData] = useState({}); // Map of image filename to CSV data
  const [cameraPositions, setCameraPositions] = useState([]); // Array of {lat, lng, name}
  const [selectedCameraPosition, setSelectedCameraPosition] = useState(null); // {lat, lng} for temporary selection
  const [isLockingCamera, setIsLockingCamera] = useState(false);
  const [selectedDrone, setSelectedDrone] = useState(null); // Selected drone data for card display
  const [latencyDurationData, setLatencyDurationData] = useState([]);
  const [attackDefenseTimes, setAttackDefenseTimes] = useState({ timeToAttack: 0, timeToDefense: 0 });
  const [weather, setWeather] = useState(null);
  const [peopleCount, setPeopleCount] = useState(0);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({ cameras: [], drones: [] });
  const socketRef = useRef(null);
  
  const MAPBOX_TOKEN = "pk.eyJ1IjoiY2hhdGNoYWxlcm0iLCJhIjoiY21nZnpiYzU3MGRzdTJrczlkd3RxamN4YyJ9.k288gnCNLdLgczawiB79gQ";
  
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
          // No CSV data found, set to null
          setImageCSVData(prev => ({
            ...prev,
            [imageFilename]: null
          }));
        }
      }
    } catch (error) {
      console.error(`[DefensiveDashboard] Error fetching CSV for ${imageFilename}:`, error);
      setImageCSVData(prev => ({
        ...prev,
        [imageFilename]: null
      }));
    }
  };

  // Fetch detected images from API
  const fetchDetectedImages = async () => {
    try {
      console.log("[DefensiveDashboard] Fetching detected images from /api/detected/images");
      const response = await fetch("/api/detected/images");
      console.log("[DefensiveDashboard] Response status:", response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log("[DefensiveDashboard] Received data:", { 
          imageCount: data.images?.length || 0, 
          firstFew: data.images?.slice(0, 3) 
        });
        const images = data.images || [];
        setDetectedImages(images);
        setDetectedImagesError(null); // Clear error on success
        // Set the latest detected image (first in sorted list)
        if (images.length > 0) {
          setLatestDetectedImage(images[0]);
          console.log("[DefensiveDashboard] Latest detected image set to:", images[0]);
          
          // Fetch CSV data for all images
          images.forEach(imageFilename => {
            fetchCSVForImage(imageFilename);
          });
        } else {
          setLatestDetectedImage(null);
          console.log("[DefensiveDashboard] No detected images found");
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("[DefensiveDashboard] Failed to fetch detected images:", response.status, errorData);
        setDetectedImagesError(`Failed to load: ${response.status} - ${errorData.error || errorData.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("[DefensiveDashboard] Error fetching detected images:", error);
      console.error("[DefensiveDashboard] Error details:", error.message, error.stack);
      setDetectedImagesError(`Network error: ${error.message}`);
    }
  };

  useEffect(() => {
    // Connect to Socket.IO server
    // In production, use same origin (nginx will proxy to backend)
    // In development, this will connect to vite proxy which forwards to localhost:3000
    const socketUrl = window.location.origin;
    console.log("[DefensiveDashboard] Connecting to Socket.IO at:", socketUrl);
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      path: "/socket.io/"
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to server");
      setConnectionStatus("connected");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setConnectionStatus("disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setConnectionStatus("error");
    });

    // Listen for drone data
    socket.on("drone-data", (data) => {
      console.log("Received drone data:", data);
      setDroneData(data);

      // Update drone list from CSV data
      if (data.csv && data.csv.data && data.csv.data.length > 0) {
        setDroneList(data.csv.data);
      } else {
        setDroneList([]);
      }
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
      center: [100.5, 13.7], // Default center (Bangkok area)
      zoom: 12
    });
    
    mapInstanceRef.current = map;
    
    map.on("load", () => {
      console.log("[DefensiveDashboard] Map loaded");
    });
    
    map.on("error", (e) => {
      console.error("[DefensiveDashboard] Map error:", e);
    });
    
    // Handle map click for camera positioning
    const handleMapClick = (e) => {
      if (isLockingCamera) {
        const { lng, lat } = e.lngLat;
        setSelectedCameraPosition({ lat, lng });
        console.log("[DefensiveDashboard] Camera position selected:", { lat, lng });
      }
    };
    
    map.on("click", handleMapClick);
    
    // Change cursor when in camera locking mode
    map.on("mousemove", () => {
      if (isLockingCamera) {
        map.getCanvas().style.cursor = "crosshair";
      } else {
        map.getCanvas().style.cursor = "";
      }
    });
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off("click", handleMapClick);
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [MAPBOX_TOKEN, isLockingCamera]);
  
  // Fetch camera positions
  const fetchCameraPositions = async () => {
    try {
      const response = await fetch("/api/cameras");
      if (response.ok) {
        const data = await response.json();
        setCameraPositions(data.cameras || []);
      } else {
        // If no API endpoint, use default camera position
        setCameraPositions([{ lat: 13.7, lng: 100.5, name: "Camera 1" }]);
      }
    } catch (error) {
      console.error("[DefensiveDashboard] Error fetching camera positions:", error);
      // Use default camera position
      setCameraPositions([{ lat: 13.7, lng: 100.5, name: "Camera 1" }]);
    }
  };
  
  // Update map markers when camera positions or CSV data changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    
    // Clear existing markers
    markersRef.current.cameras.forEach(marker => marker.remove());
    markersRef.current.drones.forEach(marker => marker.remove());
    markersRef.current.cameras = [];
    markersRef.current.drones = [];
    
    // Add camera markers (use selectedCameraPosition if set, otherwise use cameraPositions)
    const activeCameraPos = selectedCameraPosition || (cameraPositions.length > 0 ? cameraPositions[0] : null);
    
    if (activeCameraPos && activeCameraPos.lat && activeCameraPos.lng) {
      const el = document.createElement("div");
      el.className = "camera-marker";
      el.style.width = "30px";
      el.style.height = "30px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#4CAF50";
      el.style.border = "3px solid white";
      el.style.cursor = "pointer";
      el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
      el.title = activeCameraPos.name || "Camera Position";
      
      const popupText = activeCameraPos.name 
        ? `${activeCameraPos.name}\nLat: ${activeCameraPos.lat.toFixed(6)}\nLng: ${activeCameraPos.lng.toFixed(6)}`
        : `Camera Position\nLat: ${activeCameraPos.lat.toFixed(6)}\nLng: ${activeCameraPos.lng.toFixed(6)}`;
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([activeCameraPos.lng, activeCameraPos.lat])
        .setPopup(new mapboxgl.Popup().setText(popupText))
        .addTo(map);
      
      markersRef.current.cameras.push(marker);
    }
    
    // Add drone markers from CSV data
    
    Object.entries(imageCSVData).forEach(([imageFilename, csvData]) => {
      // Support both 'latitude'/'longitude' and 'lat'/'lng' formats
      const lat = csvData?.latitude || csvData?.lat;
      const lng = csvData?.longitude || csvData?.lng;
      
      if (csvData && lat && lng) {
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);
        
        if (!isNaN(latNum) && !isNaN(lngNum)) {
          const el = document.createElement("div");
          el.className = "drone-marker";
          el.style.width = "25px";
          el.style.height = "25px";
          el.style.borderRadius = "50%";
          el.style.backgroundColor = "#FF5722";
          el.style.border = "2px solid white";
          el.style.cursor = "pointer";
          el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
          el.title = `Drone: ${imageFilename}`;
          
          // Calculate distance from camera if available
          let distanceText = "";
          if (activeCameraPos && activeCameraPos.lat && activeCameraPos.lng) {
            const distance = calculateDistance(activeCameraPos.lat, activeCameraPos.lng, latNum, lngNum);
            distanceText = `<br/><strong>ระยะห่างจากกล้อง: ${distance} km</strong>`;
          }
          
          const popupContent = `
            <div style="font-size: 12px;">
              <strong>Drone Detection</strong><br/>
              Image: ${imageFilename}<br/>
              Lat: ${latNum.toFixed(6)}, Lng: ${lngNum.toFixed(6)}${distanceText}<br/>
              ${Object.entries(csvData).filter(([k]) => k !== 'latitude' && k !== 'longitude' && k !== 'lat' && k !== 'lng' && k !== 'image_name').map(([k, v]) => `${k}: ${v}`).join('<br/>')}
            </div>
          `;
          
          const marker = new mapboxgl.Marker(el)
            .setLngLat([lngNum, latNum])
            .setPopup(new mapboxgl.Popup().setHTML(popupContent))
            .addTo(map);
          
          // Add click handler to show drone card
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelectedDrone({
              imageFilename,
              csvData,
              lat: latNum,
              lng: lngNum,
              distance: activeCameraPos && activeCameraPos.lat && activeCameraPos.lng 
                ? calculateDistance(activeCameraPos.lat, activeCameraPos.lng, latNum, lngNum)
                : null
            });
          });
          
          markersRef.current.drones.push(marker);
        }
      }
    });
    
    // Fit map to show all markers
    if (markersRef.current.cameras.length > 0 || markersRef.current.drones.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      
      if (activeCameraPos && activeCameraPos.lat && activeCameraPos.lng) {
        bounds.extend([activeCameraPos.lng, activeCameraPos.lat]);
      }
      
      Object.values(imageCSVData).forEach(csvData => {
        const lat = csvData?.latitude || csvData?.lat;
        const lng = csvData?.longitude || csvData?.lng;
        if (lat && lng) {
          const latNum = parseFloat(lat);
          const lngNum = parseFloat(lng);
          if (!isNaN(latNum) && !isNaN(lngNum)) {
            bounds.extend([lngNum, latNum]);
          }
        }
      });
      
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      }
    }
  }, [cameraPositions, imageCSVData, selectedCameraPosition]);
  
  // Fetch latency and duration data
  const fetchLatencyDuration = async () => {
    try {
      const response = await fetch("/api/metrics/latency-duration");
      if (response.ok) {
        const data = await response.json();
        // Format data for chart (convert time to readable format)
        const formattedData = data.data.map(item => ({
          time: new Date(item.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          latency: Math.round(item.latency),
          duration: Math.round(item.duration)
        }));
        setLatencyDurationData(formattedData);
      }
    } catch (error) {
      console.error("[DefensiveDashboard] Error fetching latency/duration:", error);
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
      console.error("[DefensiveDashboard] Error fetching attack/defense times:", error);
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
      console.error("[DefensiveDashboard] Error fetching weather:", error);
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
      console.error("[DefensiveDashboard] Error fetching people count:", error);
    }
  };

  // Fetch detected images on mount and periodically
  useEffect(() => {
    fetchDetectedImages();
    fetchCameraPositions();
    fetchLatencyDuration();
    fetchAttackDefense();
    fetchWeather();
    fetchPeopleCount();
    
    // Refresh detected images every 5 seconds
    const interval = setInterval(() => {
      fetchDetectedImages();
      fetchLatencyDuration();
      fetchAttackDefense();
      fetchWeather();
      fetchPeopleCount();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const hasCSVData = Boolean(
    droneData?.csv && Array.isArray(droneData.csv.data) && droneData.csv.data.length > 0
  );

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
        .def-root {
          width: 100% !important;
          font-family: 'Kanit', sans-serif !important;
          background: ${colors.bgDark} !important;
        }
        .def-root * {
          box-sizing: border-box;
        }
        .def-root h1 {
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
        .def-root .box {
          border: 2px solid ${colors.border};
          border-radius: 4px;
          padding: 8px;
          background: ${colors.bgMedium};
        }
        .def-root .grid {
          display: grid;
          grid-template-columns: 2fr 1.5fr 1fr;
          grid-template-rows: auto auto auto;
          gap: 20px;
        }
        .def-root .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .def-root .stat-card {
          background: linear-gradient(135deg, ${colors.bgMedium} 0%, ${colors.bgLight} 100%);
          border: 2px solid ${colors.border};
          border-radius: 4px;
          padding: 16px;
          text-align: center;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .def-root .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .def-root .stat-card h3 {
          font-size: 12px;
          color: ${colors.textSecondary};
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
        }
        .def-root .stat-card .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: ${colors.accent};
          font-family: 'Orbitron', sans-serif;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .def-root .chart-container {
          background: ${colors.bgDark};
          border: 1px solid ${colors.border};
          border-radius: 4px;
          padding: 16px;
          min-height: 280px;
        }
        .def-root .info-card {
          background: ${colors.bgDark};
          border: 1px solid ${colors.border};
          border-radius: 4px;
          padding: 14px;
          margin-bottom: 12px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }
        .def-root .info-card h3 {
          font-size: 13px;
          color: ${colors.text};
          margin-bottom: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .def-root .info-card .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 13px;
          color: ${colors.textSecondary};
          padding: 6px 0;
          border-bottom: 1px solid rgba(85, 107, 47, 0.3);
        }
        .def-root .info-card .info-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        .def-root .info-card .info-row span:last-child {
          color: ${colors.text};
          font-weight: 600;
          font-family: 'Orbitron', sans-serif;
        }
        .def-root section h2 {
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
        .def-root #map-container {
          height: 100%;
          border-radius: 4px;
          overflow: hidden;
          background: ${colors.bgDark};
          position: relative;
          border: 1px solid ${colors.border};
        }
        .def-root #map-container .mapboxgl-map {
          width: 100%;
          height: 100%;
        }
        .def-root #camera-frame,
        .def-root #last-drone-frame {
          background: ${colors.bgDark};
          border-radius: 4px;
          border: 2px solid ${colors.border};
          overflow: hidden;
          position: relative;
        }
        .def-root #camera-frame img,
        .def-root #last-drone-frame img {
          width: 100%;
          display: block;
          object-fit: contain;
        }
        .def-root #drone-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          max-height: calc(100vh - 250px);
          user-select: none;
        }
        .def-root .drone-item {
          background: ${colors.bgDark};
          border: 1px solid ${colors.border};
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          padding: 12px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }
        .def-root .drone-item:hover {
          background: ${colors.bgLight};
          border-color: ${colors.accent};
          box-shadow: 0 2px 8px rgba(107, 142, 35, 0.3), inset 0 2px 4px rgba(0,0,0,0.3);
          transform: translateX(4px);
        }
        .def-root .drone-info {
          font-size: 12px;
          color: ${colors.textSecondary};
          line-height: 1.6em;
        }
        .def-root .drone-info strong {
          color: ${colors.text};
          font-weight: 600;
        }
        .def-root #drone-list::-webkit-scrollbar { width: 8px; }
        .def-root #drone-list::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 4px; }
        .def-root #drone-list::-webkit-scrollbar-track { background: ${colors.bgDark}; }
        @media screen and (max-width: 1200px) {
          .def-root .grid {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto auto auto;
          }
        }
      `}</style>
      <div className="def-root">
        <h1>🛡️ Defensive Command Dashboard</h1>
        
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3>⚠️ Detected Threats</h3>
            <div className="stat-value">{detectedImages.length}</div>
          </div>
          <div className="stat-card">
            <h3>⚔️ Threat Level</h3>
            <div className="stat-value" style={{ fontSize: "24px" }}>
              {detectedImages.length > 10 ? "HIGH" : detectedImages.length > 5 ? "MED" : "LOW"}
            </div>
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

        <div className="grid">
          <section id="realtime-map" aria-label="Realtime Map Section" style={{ gridColumn: "1 / 2", gridRow: "1 / 4" }}>
            <h2>
              Realtime Map
              <button
                onClick={() => {
                  setIsLockingCamera(!isLockingCamera);
                  if (isLockingCamera) {
                    setSelectedCameraPosition(null);
                  }
                }}
                style={{
                  marginLeft: "10px",
                  padding: "6px 14px",
                  fontSize: "11px",
                  background: isLockingCamera ? colors.danger : colors.success,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  transition: "all 0.2s"
                }}
                title={isLockingCamera ? "คลิกเพื่อยกเลิก" : "คลิกเพื่อกำหนดตำแหน่งกล้อง"}
              >
                {isLockingCamera ? "✕ ยกเลิก" : "📷 ล็อคตำแหน่งกล้อง"}
              </button>
            </h2>
            {selectedCameraPosition && (
              <div style={{ 
                marginBottom: "8px", 
                padding: "10px", 
                background: colors.bgMedium, 
                border: `1px solid ${colors.success}`,
                borderRadius: "4px",
                fontSize: "12px",
                color: colors.success,
                fontWeight: "600"
              }}>
                <strong>📍 Camera Position:</strong> Lat: {selectedCameraPosition.lat.toFixed(6)}, Lng: {selectedCameraPosition.lng.toFixed(6)}
              </div>
            )}
            {isLockingCamera && (
              <div style={{ 
                marginBottom: "8px", 
                padding: "10px", 
                background: colors.bgMedium, 
                border: `1px solid ${colors.warning}`,
                borderRadius: "4px",
                fontSize: "12px",
                color: colors.warning,
                fontWeight: "600"
              }}>
                💡 Click on map to set camera position
              </div>
            )}
            <div id="map-container" className="box" tabIndex={0} aria-describedby="map-desc" style={{ position: "relative" }}>
              <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: "400px" }} />
              <div id="map-desc" className="visually-hidden">Realtime map showing area, drone positions and cameras</div>
            </div>
          </section>

          <section id="realtime-camera" aria-label="Realtime Camera Section" style={{ gridColumn: "2 / 3", gridRow: "1 / 2" }}>
            <h2>📷 Realtime Camera {connectionStatus === "connected" && <span style={{ fontSize: 12, color: colors.success, fontWeight: "700" }}>● LIVE</span>}</h2>
            <div id="camera-frame" className="box" tabIndex={0} aria-describedby="camera-desc" style={{ minHeight: "200px" }}>
              {droneData?.image ? (
                <img src={droneData.image} alt="Live camera stream" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <div style={{ width: "100%", height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary }}>
                  Waiting for image data...
                </div>
              )}
            </div>
            <div
              id="camera-label"
              aria-live="polite"
              style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary, textAlign: "center", lineHeight: 1.4 }}
            >
              {droneData ? (
                <>
                  <div style={{ fontSize: "11px" }}>{droneData.imagePath ? `📁 Image: ${droneData.imagePath}` : "Image file: unknown"}</div>
                  <div style={{ fontSize: "11px" }}>{hasCSVData ? `📊 Details: ${droneData.csvPath}` : "Details unavailable"}</div>
                </>
              ) : (
                <div style={{ fontSize: "11px" }}>Camera feed: Standby</div>
              )}
            </div>
            <div id="camera-desc" className="visually-hidden">Live camera feed</div>
          </section>

          {/* Latency and Duration Graph */}
          <section id="latency-duration-graph" aria-label="Latency and Duration Graph" style={{ gridColumn: "2 / 3", gridRow: "2 / 3" }}>
            <h2>📊 System Performance Metrics</h2>
            <div className="chart-container">
              {latencyDurationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "250px", color: colors.textSecondary }}>
                  Loading chart data...
                </div>
              )}
            </div>
          </section>

          {/* Attack and Defense Times */}
          <section id="attack-defense-times" aria-label="Attack and Defense Times" style={{ gridColumn: "2 / 3", gridRow: "3 / 4" }}>
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
            <div className="info-card">
              <h3>🌤️ Environmental Conditions</h3>
              {weather ? (
                <>
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
                </>
              ) : (
                <div style={{ color: colors.textSecondary, fontSize: "12px", padding: "20px", textAlign: "center" }}>
                  Loading environmental data...
                </div>
              )}
            </div>
            <div className="info-card">
              <h3>👥 Personnel in Operational Zone</h3>
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
          </section>

          {/* Drone Log List */}
          <section id="drone-list-section" aria-label="รายการโดรนที่ตรวจจับได้" style={{ gridColumn: "3 / 4", gridRow: "1 / 4" }}>
            <h2 style={{ marginBottom: 12 }}>
              ⚠️ Threat Log ({detectedImages.length})
            </h2>
            <div id="drone-list">
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
                  const activeCameraPos = selectedCameraPosition || (cameraPositions.length > 0 ? cameraPositions[0] : null);
                  const distance = (latNum && lngNum && activeCameraPos && activeCameraPos.lat && activeCameraPos.lng)
                    ? calculateDistance(activeCameraPos.lat, activeCameraPos.lng, latNum, lngNum)
                    : null;
                  
                  return (
                    <article 
                      key={imageFilename} 
                      className="drone-item" 
                      tabIndex={0} 
                      role="region" 
                      aria-labelledby={`title-drone-${index}`}
                      onClick={() => {
                        if (hasCSV && latNum && lngNum) {
                          setSelectedDrone({
                            imageFilename,
                            csvData,
                            lat: latNum,
                            lng: lngNum,
                            distance
                          });
                        }
                      }}
                      style={{ cursor: hasCSV && latNum && lngNum ? "pointer" : "default" }}
                    >
                      <div className="drone-info" id={`title-drone-${index}`}>
                        <div style={{ 
                          fontSize: "12px", 
                          color: colors.accent, 
                          marginBottom: "8px", 
                          fontWeight: "700",
                          fontFamily: "'Orbitron', sans-serif",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px"
                        }}>
                          🎯 Threat ID: {imageFilename}
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
                              <div style={{ fontSize: "11px", color: colors.textSecondary, marginBottom: "6px" }}>
                                📍 Coordinates: <strong style={{ color: colors.text }}>{latNum.toFixed(4)}, {lngNum.toFixed(4)}</strong>
                              </div>
                            )}
                            {/* Show key CSV data fields */}
                            {Object.entries(csvData)
                              .filter(([key]) => !['latitude', 'longitude', 'lat', 'lng', 'image_name', 'image_name'].includes(key.toLowerCase()))
                              .slice(0, 5)
                              .map(([key, value]) => (
                                <div key={key} style={{ fontSize: "11px", marginBottom: "4px", color: colors.textSecondary }}>
                                  <strong style={{ color: colors.text }}>{key}:</strong> <span style={{ color: colors.text }}>{value || "N/A"}</span>
                                </div>
                              ))}
                            {Object.entries(csvData).length > 5 && (
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
                    </article>
                  );
                })
                ) : (
                  <div style={{ padding: "30px", textAlign: "center", color: colors.textSecondary, lineHeight: "1.6" }}>
                    {connectionStatus !== "connected"
                      ? "Not connected to server"
                      : detectedImagesError
                        ? detectedImagesError
                        : "No threats detected"}
                    <div style={{ fontSize: "11px", marginTop: "8px" }}>
                      System monitoring active
                    </div>
                  </div>
                )}
            </div>
          </section>
        </div>
      </div>
      
      {/* Drone Detail Card Modal */}
      {selectedDrone && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
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
              onClick={() => setSelectedDrone(null)}
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


