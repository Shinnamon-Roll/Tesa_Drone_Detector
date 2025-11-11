import React from "react";

export function DefensiveDashboard() {
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
        .def-root .bounding-box {
          position: absolute;
          border: 3px solid #33ff33;
          top: 20%;
          left: 40%;
          width: 18%;
          height: 15%;
          pointer-events: none;
          box-sizing: border-box;
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
            <h2>Realtime Camera</h2>
            <div id="camera-frame" className="box" tabIndex={0} aria-describedby="camera-desc">
              <img src="https://i.imgur.com/Pr4o6o2.jpg" alt="Live camera stream" />
              <div className="bounding-box" aria-hidden="true"></div>
            </div>
            <div id="camera-label" aria-live="polite" style={{ marginTop: 6, fontSize: 13, color: "#bbb", textAlign: "center" }}>
              Camera : 1 100,2000 - 200,100
            </div>
            <div id="camera-desc" className="visually-hidden">Live feed with bounding box overlay</div>
          </section>

          <section id="last-detected-drone" aria-label="Last Detected Drone Section" style={{ gridColumn: "2 / 3", gridRow: "2 / 3" }}>
            <h2>Last Detected Drone</h2>
            <div id="last-drone-frame" className="box" tabIndex={0} aria-describedby="last-drone-desc">
              <img src="https://i.imgur.com/Pr4o6o2.jpg" alt="Latest detected drone" />
              <div className="bounding-box" aria-hidden="true"></div>
            </div>

            <div id="last-drone-label" aria-live="polite" style={{ fontSize: 14, textAlign: "center", marginTop: 6, color: "#ddd" }}>
              ภาพโดรนที่ตรวจจับล่าสุด
            </div>
            <div id="last-drone-desc" className="visually-hidden">Latest detected drone with bounding box</div>
          </section>

          <section id="drone-list" aria-label="รายการโดรนที่ตรวจจับได้" style={{ gridColumn: "3 / 4", gridRow: "1 / 3" }}>
            <article className="drone-item" tabIndex={0} role="region" aria-labelledby="title-drone-1">
              <div className="drone-image">
                <img src="https://i.imgur.com/OxF1M2L.png" alt="Drone model D0001" />
              </div>
              <div className="drone-info" id="title-drone-1">
                <strong>Drone ID :</strong> D0001<br />
                <strong>Tracked ID :</strong> D001<br />
                <strong>Date :</strong> 2024-06-01<br />
                <strong>Time :</strong> 15:20:30<br />
                <strong>Latitude / Longitude :</strong> 13.736717 / 100.523186<br />
                <strong>Altitude :</strong> 45 m<br />
                <strong>Speed :</strong> 6.5 m/s<br />
                <strong>Direction :</strong> 120°<br />
                <strong>Confidence :</strong> 92%<br />
                <strong>Behavior :</strong> Hovering
              </div>
            </article>
          </section>
        </div>
      </div>
    </div>
  );
}


