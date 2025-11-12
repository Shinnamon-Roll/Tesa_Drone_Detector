import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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
  
  // Fetch detected images on mount and periodically
  useEffect(() => {
    fetchDetectedImages();
    fetchCameraPositions();
    // Refresh detected images every 5 seconds
    const interval = setInterval(fetchDetectedImages, 5000);
    return () => clearInterval(interval);
  }, []);

  const hasCSVData = Boolean(
    droneData?.csv && Array.isArray(droneData.csv.data) && droneData.csv.data.length > 0
  );

  return (
    <div>
      <h1 style={{ marginBottom: 12 }}>Defensive Dashboard</h1>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Kanit&display=swap');
        .def-root * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Kanit', sans-serif;
        }
        .def-root .box {
          border: 3px solid #a063ff;
          border-radius: 6px;
          padding: 6px;
          background: rgba(255 255 255 / 0.05);
        }
        .def-root .grid {
          display: grid;
          grid-template-columns: 3fr 2fr 1.2fr;
          grid-template-rows: auto 1fr auto;
          gap: 18px 24px;
          background-image: linear-gradient(45deg, #222 25%, transparent 25%),linear-gradient(-45deg, #222 25%, transparent 25%),linear-gradient(45deg, transparent 75%, #222 75%),linear-gradient(-45deg, transparent 75%, #222 75%);
          background-size: 60px 60px;
          background-position: 0 0, 0 30px, 30px -30px, -30px 0px;
          padding: 4px;
        }
        .def-root section h2 {
          color: #eee;
          font-weight: 600;
          margin-bottom: 12px;
          user-select: none;
        }
        .def-root #map-container {
          height: 100%;
          border-radius: 6px;
          overflow: hidden;
          background: #1a1a1a;
          position: relative;
        }
        .def-root #map-container .mapboxgl-map {
          width: 100%;
          height: 100%;
        }
        .def-root #camera-frame,
        .def-root #last-drone-frame {
          background: #222;
          border-radius: 6px;
          border: 3px solid #a063ff;
          overflow: hidden;
          position: relative;
        }
        .def-root #camera-frame img,
        .def-root #last-drone-frame img {
          width: 100%;
          display: block;
          object-fit: cover;
        }
        .def-root #drone-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
          max-height: calc(100vh - 220px);
          user-select: none;
        }
        .def-root .drone-item {
          display: flex;
          background: rgba(255 255 255 / 0.1);
          border-radius: 8px;
          box-shadow: 0 0 8px #0008 inset;
          cursor: pointer;
          transition: background-color 0.2s;
          padding: 6px;
        }
        .def-root .drone-item:hover {
          background: rgba(255 255 255 / 0.2);
        }
        .def-root .drone-image {
          width: 90px;
          height: 70px;
          flex-shrink: 0;
          border: 2px solid #a063ff;
          border-radius: 6px;
          margin-right: 10px;
          background: #111;
        }
        .def-root .drone-info {
          font-size: 13px;
          color: #ddd;
          line-height: 1.3em;
          white-space: pre-line;
          flex-grow: 1;
        }
        .def-root #drone-list::-webkit-scrollbar { width: 7px; }
        .def-root #drone-list::-webkit-scrollbar-thumb { background: #a063ff88; border-radius: 4px; }
        .def-root #drone-list::-webkit-scrollbar-track { background: transparent; }
        @media screen and (max-width: 1200px) {
          .def-root .grid {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto auto auto;
          }
        }
      `}</style>
      <div className="def-root">
        <div className="grid">
          <section id="realtime-map" aria-label="Realtime Map Section" style={{ gridColumn: "1 / 2", gridRow: "1 / 3" }}>
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
                  padding: "4px 12px",
                  fontSize: "11px",
                  background: isLockingCamera ? "#ff6b6b" : "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
                title={isLockingCamera ? "คลิกเพื่อยกเลิก" : "คลิกเพื่อกำหนดตำแหน่งกล้อง"}
              >
                {isLockingCamera ? "✕ ยกเลิก" : "📷 ล็อคตำแหน่งกล้อง"}
              </button>
            </h2>
            {selectedCameraPosition && (
              <div style={{ 
                marginBottom: "8px", 
                padding: "8px", 
                background: "rgba(76, 175, 80, 0.2)", 
                borderRadius: "4px",
                fontSize: "12px",
                color: "#4CAF50"
              }}>
                <strong>ตำแหน่งกล้อง:</strong> Lat: {selectedCameraPosition.lat.toFixed(6)}, Lng: {selectedCameraPosition.lng.toFixed(6)}
              </div>
            )}
            {isLockingCamera && (
              <div style={{ 
                marginBottom: "8px", 
                padding: "8px", 
                background: "rgba(255, 193, 7, 0.2)", 
                borderRadius: "4px",
                fontSize: "12px",
                color: "#FFC107"
              }}>
                💡 คลิกบนแผนที่เพื่อกำหนดตำแหน่งกล้อง
              </div>
            )}
            <div id="map-container" className="box" tabIndex={0} aria-describedby="map-desc" style={{ position: "relative" }}>
              <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: "400px" }} />
              <div id="map-desc" className="visually-hidden">Realtime map showing area, drone positions and cameras</div>
            </div>
          </section>

          <section id="realtime-camera" aria-label="Realtime Camera Section" style={{ gridColumn: "2 / 3", gridRow: "1 / 2" }}>
            <h2>Realtime Camera {connectionStatus === "connected" && <span style={{ fontSize: 12, color: "#33ff33" }}>● Live</span>}</h2>
            <div id="camera-frame" className="box" tabIndex={0} aria-describedby="camera-desc">
              {droneData?.image ? (
                <img src={droneData.image} alt="Live camera stream" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <div style={{ width: "100%", height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
                  Waiting for image data...
                </div>
              )}
            </div>
            <div
              id="camera-label"
              aria-live="polite"
              style={{ marginTop: 6, fontSize: 13, color: "#bbb", textAlign: "center", lineHeight: 1.4 }}
            >
              {droneData ? (
                <>
                  <div>{droneData.imagePath ? `Image: ${droneData.imagePath}` : "Image file: unknown"}</div>
                  <div>{hasCSVData ? `Details file: ${droneData.csvPath}` : "Details unavailable"}</div>
                </>
              ) : (
                "Camera : 1 100,2000 - 200,100"
              )}
            </div>
            <div id="camera-desc" className="visually-hidden">Live camera feed</div>
          </section>

          <section id="last-detected-drone" aria-label="Last Detected Drone Section" style={{ gridColumn: "2 / 3", gridRow: "2 / 3" }}>
            <h2>
              Last Detected Drone
              <button 
                onClick={fetchDetectedImages}
                style={{ 
                  marginLeft: "10px", 
                  padding: "4px 8px", 
                  fontSize: "11px", 
                  background: "#a063ff", 
                  color: "white", 
                  border: "none", 
                  borderRadius: "4px", 
                  cursor: "pointer" 
                }}
                title="Refresh detected images"
              >
                ↻ Refresh
              </button>
            </h2>
            <div id="last-drone-frame" className="box" tabIndex={0} aria-describedby="last-drone-desc">
              {latestDetectedImage ? (
                <img 
                  src={`/api/detected/images/${latestDetectedImage}`} 
                  alt="Latest detected drone" 
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  onError={(e) => {
                    console.error(`[DefensiveDashboard] Failed to load detected image: ${latestDetectedImage}`);
                    console.error(`[DefensiveDashboard] Image URL: /api/detected/images/${latestDetectedImage}`);
                    e.target.style.display = "none";
                    setDetectedImagesError(`Failed to load image: ${latestDetectedImage}`);
                  }}
                />
              ) : (
                <div style={{ width: "100%", height: "200px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#888", gap: "8px" }}>
                  {detectedImagesError ? (
                    <>
                      <div style={{ color: "#ff6b6b", fontSize: "12px" }}>{detectedImagesError}</div>
                      <div style={{ fontSize: "11px" }}>Check browser console (F12) for details</div>
                      <button 
                        onClick={fetchDetectedImages}
                        style={{ 
                          marginTop: "8px",
                          padding: "6px 12px", 
                          fontSize: "12px", 
                          background: "#a063ff", 
                          color: "white", 
                          border: "none", 
                          borderRadius: "4px", 
                          cursor: "pointer" 
                        }}
                      >
                        Try Again
                      </button>
                    </>
                  ) : (
                    "No detected images yet"
                  )}
                </div>
              )}
            </div>

            <div
              id="last-drone-label"
              aria-live="polite"
              style={{ fontSize: 14, textAlign: "center", marginTop: 6, color: "#ddd", lineHeight: 1.4 }}
            >
              <div>
                {latestDetectedImage
                  ? `ภาพโดรนที่ตรวจจับล่าสุด - ${latestDetectedImage}`
                  : "ภาพโดรนที่ตรวจจับล่าสุด"}
              </div>
              {detectedImages.length > 0 && (
                <div style={{ fontSize: 12, color: "#aaa" }}>Total: {detectedImages.length} images</div>
              )}
              {!hasCSVData && <div style={{ fontSize: 12, color: "#aaa" }}>รายละเอียดไม่พร้อมใช้งาน</div>}
            </div>
            <div id="last-drone-desc" className="visually-hidden">Latest detected drone</div>
          </section>

          <section id="drone-list-section" aria-label="รายการโดรนที่ตรวจจับได้" style={{ gridColumn: "3 / 4", gridRow: "1 / 3" }}>
            <h2 style={{ marginBottom: 12 }}>
              Drone List {detectedImages.length > 0 ? `(${detectedImages.length})` : ""}
            </h2>
            <div id="drone-list">
              {detectedImages.length > 0 ? (
                detectedImages.map((imageFilename, index) => {
                  const csvData = imageCSVData[imageFilename];
                  const hasCSV = csvData !== undefined && csvData !== null;
                  const isLoading = csvData === undefined;
                  
                  return (
                    <article key={imageFilename} className="drone-item" tabIndex={0} role="region" aria-labelledby={`title-drone-${index}`}>
                      <div className="drone-image">
                        <img 
                          src={`/api/detected/images/${imageFilename}`} 
                          alt={`Drone ${index + 1}`} 
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            console.error(`[DefensiveDashboard] Failed to load detected image: ${imageFilename}`);
                            e.target.style.display = "none";
                          }}
                        />
                      </div>
                      <div className="drone-info" id={`title-drone-${index}`}>
                        {isLoading ? (
                          <div style={{ fontSize: "11px", color: "#aaa", fontStyle: "italic" }}>
                            Loading details...
                          </div>
                        ) : hasCSV ? (
                          // Show CSV data if available
                          Object.entries(csvData).map(([key, value]) => (
                            <React.Fragment key={key}>
                              <strong>{key} :</strong> {value || "N/A"}<br />
                            </React.Fragment>
                          ))
                        ) : (
                          // Show "none" or "null" when CSV is not available
                          <>
                            <strong>Status :</strong> none<br />
                            <strong>Details :</strong> null<br />
                            <strong>Data :</strong> null<br />
                          </>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div style={{ padding: 20, textAlign: "center", color: "#888", lineHeight: 1.4 }}>
                  {connectionStatus !== "connected"
                    ? "Not connected to server"
                    : detectedImagesError
                      ? detectedImagesError
                      : "Waiting for detected images..."}
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
              background: "#1a1a1a",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "2px solid #a063ff",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
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
                background: "#ff6b6b",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                cursor: "pointer",
                fontSize: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              ×
            </button>
            
            <h2 style={{ color: "#fff", marginBottom: "20px", marginTop: "0" }}>
              ข้อมูลโดรนที่ตรวจจับได้
            </h2>
            
            <div style={{ marginBottom: "20px" }}>
              <img 
                src={`/api/detected/images/${selectedDrone.imageFilename}`}
                alt={selectedDrone.imageFilename}
                style={{
                  width: "100%",
                  maxHeight: "400px",
                  objectFit: "contain",
                  borderRadius: "8px",
                  border: "2px solid #a063ff"
                }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </div>
            
            <div style={{ color: "#ddd", fontSize: "14px", lineHeight: "1.8" }}>
              <div style={{ marginBottom: "12px" }}>
                <strong style={{ color: "#a063ff" }}>ชื่อไฟล์:</strong> {selectedDrone.imageFilename}
              </div>
              
              <div style={{ marginBottom: "12px" }}>
                <strong style={{ color: "#a063ff" }}>ตำแหน่ง:</strong><br/>
                Latitude: {selectedDrone.lat.toFixed(6)}<br/>
                Longitude: {selectedDrone.lng.toFixed(6)}
              </div>
              
              {selectedDrone.distance && (
                <div style={{ marginBottom: "12px", color: "#4CAF50" }}>
                  <strong>ระยะห่างจากกล้อง:</strong> {selectedDrone.distance} km
                </div>
              )}
              
              {selectedDrone.csvData && (
                <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #444" }}>
                  <strong style={{ color: "#a063ff" }}>รายละเอียดเพิ่มเติม:</strong>
                  {Object.entries(selectedDrone.csvData)
                    .filter(([key]) => key !== 'latitude' && key !== 'longitude' && key !== 'image_name')
                    .map(([key, value]) => (
                      <div key={key} style={{ marginTop: "8px" }}>
                        <strong>{key}:</strong> {value || "N/A"}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


