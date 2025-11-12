import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

export function DefensiveDashboard() {
  const [droneData, setDroneData] = useState(null);
  const [droneList, setDroneList] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const socketRef = useRef(null);

  useEffect(() => {
    // Connect to Socket.IO server
    const socket = io("http://localhost:3000", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
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
      }
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  // Get the latest drone from the list
  const latestDrone = droneList.length > 0 ? droneList[droneList.length - 1] : null;

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
          background: #f9f7f0;
          position: relative;
        }
        .def-root #map-iframe {
          width: 100%;
          height: 100%;
          border: none;
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
            <h2>Realtime Map</h2>
            <div id="map-container" className="box" tabIndex={0} aria-describedby="map-desc">
              <iframe
                id="map-iframe"
                src="https://www.openstreetmap.org/export/embed.html?bbox=100.5%2C13.7%2C101%2C14.2&layer=mapnik"
                title="OpenStreetMap"
                aria-describedby="map-desc"
                loading="lazy"
              />
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
            <div id="camera-label" aria-live="polite" style={{ marginTop: 6, fontSize: 13, color: "#bbb", textAlign: "center" }}>
              {droneData?.csvPath ? `File: ${droneData.csvPath}` : "Camera : 1 100,2000 - 200,100"}
            </div>
            <div id="camera-desc" className="visually-hidden">Live camera feed</div>
          </section>

          <section id="last-detected-drone" aria-label="Last Detected Drone Section" style={{ gridColumn: "2 / 3", gridRow: "2 / 3" }}>
            <h2>Last Detected Drone</h2>
            <div id="last-drone-frame" className="box" tabIndex={0} aria-describedby="last-drone-desc">
              {droneData?.image ? (
                <img src={droneData.image} alt="Latest detected drone" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <div style={{ width: "100%", height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
                  Waiting for image data...
                </div>
              )}
            </div>

            <div id="last-drone-label" aria-live="polite" style={{ fontSize: 14, textAlign: "center", marginTop: 6, color: "#ddd" }}>
              {droneData?.timestamp ? `ภาพโดรนที่ตรวจจับล่าสุด - ${new Date(droneData.timestamp).toLocaleTimeString()}` : "ภาพโดรนที่ตรวจจับล่าสุด"}
            </div>
            <div id="last-drone-desc" className="visually-hidden">Latest detected drone</div>
          </section>

          <section id="drone-list-section" aria-label="รายการโดรนที่ตรวจจับได้" style={{ gridColumn: "3 / 4", gridRow: "1 / 3" }}>
            <h2 style={{ marginBottom: 12 }}>Drone List ({droneList.length})</h2>
            <div id="drone-list">
              {droneList.length > 0 ? (
                droneList.map((drone, index) => (
                  <article key={index} className="drone-item" tabIndex={0} role="region" aria-labelledby={`title-drone-${index}`}>
                    <div className="drone-image">
                      {droneData?.image ? (
                        <img src={droneData.image} alt={`Drone ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 10 }}>
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="drone-info" id={`title-drone-${index}`}>
                      {Object.entries(drone).map(([key, value]) => (
                        <React.Fragment key={key}>
                          <strong>{key} :</strong> {value || "N/A"}<br />
                        </React.Fragment>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <div style={{ padding: 20, textAlign: "center", color: "#888" }}>
                  {connectionStatus === "connected" ? "Waiting for drone data..." : "Not connected to server"}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


