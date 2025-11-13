import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import chokidar from "chokidar";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mqtt from "mqtt";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Path to dataForWeb directory (adjust this path as needed)
// Assuming dataForWeb is at the same level as Tesa_Drone_Detector
// __dirname is server/src, so ../../.. goes to parent of Tesa_Drone_Detector
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "../../../dataForWeb");
const CSV_DIR = path.join(DATA_DIR, "csv");
const IMAGE_DIR = path.join(DATA_DIR, "image");
const DETECTED_DIR = path.join(DATA_DIR, "detected");

// Log paths on startup for debugging
console.log(`[server] DATA_DIR: ${DATA_DIR}`);
console.log(`[server] DETECTED_DIR: ${DETECTED_DIR}`);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for image upload (from Pi 5)
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Ensure detected directory exists
      await fs.mkdir(DETECTED_DIR, { recursive: true });
      cb(null, DETECTED_DIR);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    // Use original filename if provided, otherwise generate one
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = req.body.imageName || `img_${timestamp}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for images
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
    }
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "tesa-drone-detector-backend" });
});

// Endpoint to get camera positions
app.get("/api/cameras", async (_req, res) => {
  try {
    // Default camera positions (can be configured via environment or config file)
    // Format: [{ lat: number, lng: number, name: string }]
    const defaultCameras = [
      { lat: 13.7563, lng: 100.5018, name: "Camera 1" } // Bangkok area default
    ];
    
    // Try to read from config file if exists
    const configPath = path.join(DATA_DIR, "cameras.json");
    try {
      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);
      if (config.cameras && Array.isArray(config.cameras)) {
        return res.json({ cameras: config.cameras });
      }
    } catch (configError) {
      // Config file doesn't exist or is invalid, use defaults
      console.log("[api] Using default camera positions");
    }
    
    // Return default cameras
    res.json({ cameras: defaultCameras });
  } catch (error) {
    console.error("[api] Error getting camera positions:", error);
    res.status(500).json({ 
      error: "Failed to get camera positions",
      message: error.message
    });
  }
});

// Debug endpoint to check paths
app.get("/api/debug/paths", async (_req, res) => {
  try {
    const detectedExists = await fs.access(DETECTED_DIR).then(() => true).catch(() => false);
    let fileCount = 0;
    let imageCount = 0;
    
    if (detectedExists) {
      const files = await fs.readdir(DETECTED_DIR);
      fileCount = files.length;
      imageCount = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file)).length;
    }
    
    res.json({
      dataDir: DATA_DIR,
      detectedDir: DETECTED_DIR,
      detectedExists,
      fileCount,
      imageCount,
      __dirname
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to list all detected images
app.get("/api/detected/images", async (_req, res) => {
  try {
    console.log(`[api] Listing images from: ${DETECTED_DIR}`);
    // Check if directory exists
    try {
      await fs.access(DETECTED_DIR);
    } catch (accessError) {
      console.error(`[api] Directory does not exist: ${DETECTED_DIR}`, accessError);
      return res.status(404).json({ 
        error: "Detected directory not found",
        path: DETECTED_DIR,
        message: accessError.message 
      });
    }
    
    const files = await fs.readdir(DETECTED_DIR);
    console.log(`[api] Found ${files.length} files in directory`);
    
    // Filter only image files
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif)$/i.test(file)
    );
    console.log(`[api] Filtered to ${imageFiles.length} image files`);
    
    // Sort by filename in descending order (newest first: img_0258.jpg > img_0001.jpg)
    imageFiles.sort((a, b) => {
      // Extract numbers from filenames (e.g., "img_0258.jpg" -> 258)
      const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || "0", 10);
      return numB - numA; // Descending order (newest first)
    });
    
    res.json({ images: imageFiles, count: imageFiles.length });
  } catch (error) {
    console.error("[api] Error listing detected images:", error);
    res.status(500).json({ 
      error: "Failed to list images",
      message: error.message,
      path: DETECTED_DIR
    });
  }
});

// Endpoint to get latest detected image
app.get("/api/detected/images/latest", async (_req, res) => {
  try {
    console.log(`[api] Getting latest detected image from: ${DETECTED_DIR}`);
    // Check if directory exists
    try {
      await fs.access(DETECTED_DIR);
    } catch (accessError) {
      console.error(`[api] Directory does not exist: ${DETECTED_DIR}`, accessError);
      return res.status(404).json({ 
        error: "Detected directory not found",
        path: DETECTED_DIR,
        message: accessError.message 
      });
    }
    
    const files = await fs.readdir(DETECTED_DIR);
    
    // Filter only image files
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif)$/i.test(file)
    );
    
    if (imageFiles.length === 0) {
      return res.json({ image: null, filename: null });
    }
    
    // Sort by filename in descending order (newest first)
    imageFiles.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || "0", 10);
      return numB - numA; // Descending order (newest first)
    });
    
    const latestImage = imageFiles[0];
    res.json({ image: latestImage, filename: latestImage });
  } catch (error) {
    console.error("[api] Error getting latest detected image:", error);
    res.status(500).json({ 
      error: "Failed to get latest image",
      message: error.message,
      path: DETECTED_DIR
    });
  }
});

// Endpoint to get CSV files list
app.get("/api/csv/files", async (_req, res) => {
  try {
    console.log(`[api] Listing CSV files from: ${CSV_DIR}`);
    try {
      await fs.access(CSV_DIR);
    } catch (accessError) {
      console.error(`[api] CSV directory does not exist: ${CSV_DIR}`, accessError);
      return res.json({ files: [], count: 0 });
    }
    
    const files = await fs.readdir(CSV_DIR);
    const csvFiles = files.filter(file => /\.csv$/i.test(file));
    
    // Sort by filename in descending order (newest first)
    csvFiles.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || "0", 10);
      return numB - numA;
    });
    
    res.json({ files: csvFiles, count: csvFiles.length });
  } catch (error) {
    console.error("[api] Error listing CSV files:", error);
    res.status(500).json({ 
      error: "Failed to list CSV files",
      message: error.message
    });
  }
});

// Endpoint to get CSV data for a specific image (by matching image_name)
app.get("/api/csv/for-image/:imageFilename", async (req, res) => {
  try {
    const imageFilename = req.params.imageFilename;
    
    try {
      await fs.access(CSV_DIR);
    } catch {
      return res.json({ data: null, message: "CSV directory not found" });
    }
    
    const files = await fs.readdir(CSV_DIR);
    const csvFiles = files.filter(file => /\.csv$/i.test(file));
    
    // Search through all CSV files to find matching image_name
    let matchedData = null;
    let matchedFile = null;
    
    for (const csvFile of csvFiles) {
      const csvPath = path.join(CSV_DIR, csvFile);
      const csvData = await readCSVFile(csvPath);
      
      if (csvData && csvData.data && csvData.data.length > 0) {
        // Look for row with matching image_name
        const matchedRow = csvData.data.find(row => {
          const rowImageName = row.image_name || row.imageName || row["image_name"];
          return rowImageName === imageFilename || rowImageName === imageFilename.replace(/^.*\//, "");
        });
        
        if (matchedRow) {
          matchedData = matchedRow;
          matchedFile = csvFile;
          break;
        }
      }
    }
    
    if (!matchedData) {
      return res.json({ data: null, message: "No matching CSV data found for this image" });
    }
    
    res.json({ 
      data: matchedData, 
      filename: matchedFile 
    });
  } catch (error) {
    console.error("[api] Error getting CSV for image:", error);
    res.status(500).json({ 
      error: "Failed to get CSV data",
      message: error.message
    });
  }
});

// Endpoint to upload detected images from Pi 5 (after AI detection)
app.post("/api/detected/upload", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const imageFile = req.file;
    const timestamp = new Date().toISOString();
    
    console.log(`[API] [${timestamp}] Received detected image upload from Pi 5: ${imageFile.filename}`);
    
    // Parse CSV data from request body
    let csvData = null;
    try {
      if (req.body.csvData) {
        csvData = typeof req.body.csvData === 'string' 
          ? JSON.parse(req.body.csvData) 
          : req.body.csvData;
      } else if (req.body.latitude || req.body.longitude) {
        // If CSV data is provided as individual fields
        csvData = {
          image_name: imageFile.filename,
          latitude: req.body.latitude || req.body.lat,
          longitude: req.body.longitude || req.body.lng,
          confidence: req.body.confidence || 1.0,
          bbox_x1: req.body.bbox_x1 || null,
          bbox_y1: req.body.bbox_y1 || null,
          bbox_x2: req.body.bbox_x2 || null,
          bbox_y2: req.body.bbox_y2 || null,
          frame_number: req.body.frame_number || req.body.frameNumber || null,
          timestamp: req.body.timestamp || timestamp,
          camera_id: req.body.cameraId || req.body.camera_id || 'pi5',
          camera_name: req.body.cameraName || req.body.camera_name || 'Pi 5 Camera'
        };
      }
    } catch (parseError) {
      console.error(`[API] [${timestamp}] Error parsing CSV data:`, parseError);
    }
    
    // Save CSV data if provided
    if (csvData) {
      try {
        // Ensure CSV directory exists
        await fs.mkdir(CSV_DIR, { recursive: true });
        
        // Generate CSV filename (same name as image but with .csv extension)
        const csvFilename = imageFile.filename.replace(/\.(jpg|jpeg|png|gif)$/i, '.csv');
        const csvPath = path.join(CSV_DIR, csvFilename);
        
        // Ensure image_name matches the actual filename
        csvData.image_name = imageFile.filename;
        
        // Create CSV content (format: header row, then data row)
        // Match the format used by existing CSV files (e.g., test_predictions.csv)
        const csvHeader = Object.keys(csvData).join(',');
        
        // Create CSV data row - quote values that might contain commas or special characters
        const csvRow = Object.values(csvData).map(value => {
          if (value === null || value === undefined) {
            return '';
          }
          const str = String(value);
          // Quote if contains comma, newline, or quote
          if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',');
        
        const csvContent = csvHeader + '\n' + csvRow;
        
        // Save CSV file
        await fs.writeFile(csvPath, csvContent, 'utf-8');
        
        console.log(`[API] [${timestamp}] ✅ Saved CSV: ${csvFilename}`);
        console.log(`[API] [${timestamp}] CSV Data:`, JSON.stringify(csvData));
      } catch (csvError) {
        console.error(`[API] [${timestamp}] ❌ Error saving CSV:`, csvError);
      }
    }
    
    // File watcher will detect new files and emit to frontend automatically
    console.log(`[API] [${timestamp}] ✅ Image uploaded successfully: ${imageFile.filename}`);
    console.log(`[API] [${timestamp}] File watcher will detect and emit to frontend`);
    
    // Emit event to connected clients
    io.emit('new-detected-image', {
      filename: imageFile.filename,
      timestamp: timestamp,
      csvData: csvData
    });
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      filename: imageFile.filename,
      csvData: csvData,
      timestamp: timestamp
    });
  } catch (error) {
    console.error(`[API] [${new Date().toISOString()}] ❌ Error uploading image:`, error);
    res.status(500).json({ 
      error: 'Failed to upload image', 
      message: error.message 
    });
  }
});

// Endpoint to serve detected images
app.get("/api/detected/images/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    console.log(`[api] Requesting image: ${filename}`);
    
    // Security: prevent directory traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    const filePath = path.join(DETECTED_DIR, filename);
    console.log(`[api] Full path: ${filePath}`);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (accessError) {
      console.error(`[api] File not found: ${filePath}`, accessError);
      return res.status(404).json({ 
        error: "Image not found",
        filename: filename,
        path: filePath
      });
    }
    
    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
                       ext === ".png" ? "image/png" :
                       ext === ".gif" ? "image/gif" : "image/jpeg";
    res.setHeader("Content-Type", contentType);
    
    // Stream the file
    const imageBuffer = await fs.readFile(filePath);
    console.log(`[api] Served image: ${filename} (${imageBuffer.length} bytes)`);
    res.send(imageBuffer);
  } catch (error) {
    console.error("[api] Error serving detected image:", error);
    res.status(500).json({ 
      error: "Failed to serve image",
      message: error.message
    });
  }
});

// Endpoint to get latency and duration data
app.get("/api/metrics/latency-duration", async (_req, res) => {
  try {
    // Generate sample latency and duration data (last 24 hours)
    const now = new Date();
    const data = [];
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      data.push({
        time: timestamp.toISOString(),
        latency: Math.random() * 100 + 50, // 50-150ms
        duration: Math.random() * 2000 + 1000 // 1000-3000ms
      });
    }
    res.json({ data });
  } catch (error) {
    console.error("[api] Error getting latency/duration:", error);
    res.status(500).json({ error: "Failed to get metrics", message: error.message });
  }
});

// Endpoint to get attack and defense times
app.get("/api/metrics/attack-defense", async (_req, res) => {
  try {
    const now = new Date();
    res.json({
      timeToAttack: Math.random() * 30 + 10, // 10-40 seconds
      timeToDefense: Math.random() * 20 + 5, // 5-25 seconds
      lastUpdated: now.toISOString()
    });
  } catch (error) {
    console.error("[api] Error getting attack/defense times:", error);
    res.status(500).json({ error: "Failed to get times", message: error.message });
  }
});

// Endpoint to get team drones information
app.get("/api/team/drones", async (_req, res) => {
  try {
    // Sample team drone data
    const teamDrones = [
      { id: 1, name: "Drone Alpha", status: "active", battery: 85, location: { lat: 13.7563, lng: 100.5018 } },
      { id: 2, name: "Drone Beta", status: "active", battery: 92, location: { lat: 13.7500, lng: 100.5000 } },
      { id: 3, name: "Drone Gamma", status: "standby", battery: 100, location: { lat: 13.7600, lng: 100.5100 } },
      { id: 4, name: "Drone Delta", status: "maintenance", battery: 45, location: { lat: 13.7550, lng: 100.5050 } }
    ];
    res.json({ drones: teamDrones, total: teamDrones.length });
  } catch (error) {
    console.error("[api] Error getting team drones:", error);
    res.status(500).json({ error: "Failed to get team drones", message: error.message });
  }
});

// Endpoint to get weather information
app.get("/api/weather", async (_req, res) => {
  try {
    // Sample weather data (in production, integrate with weather API)
    const weatherConditions = ["Clear", "Cloudy", "Partly Cloudy", "Rainy", "Windy"];
    const weather = {
      condition: weatherConditions[Math.floor(Math.random() * weatherConditions.length)],
      temperature: Math.round(Math.random() * 15 + 25), // 25-40°C
      humidity: Math.round(Math.random() * 30 + 50), // 50-80%
      windSpeed: Math.round(Math.random() * 20 + 5), // 5-25 km/h
      visibility: Math.round(Math.random() * 5 + 8) // 8-13 km
    };
    res.json(weather);
  } catch (error) {
    console.error("[api] Error getting weather:", error);
    res.status(500).json({ error: "Failed to get weather", message: error.message });
  }
});

// Endpoint to get people count in attacking area
app.get("/api/area/people-count", async (_req, res) => {
  try {
    const count = Math.floor(Math.random() * 20 + 5); // 5-25 people
    res.json({ count, lastUpdated: new Date().toISOString() });
  } catch (error) {
    console.error("[api] Error getting people count:", error);
    res.status(500).json({ error: "Failed to get people count", message: error.message });
  }
});

// Store team drones data (will be updated via MQTT from MATLAB)
// Format from MATLAB: { "lat": value, "lng": value, "height": value }
// Only one drone is expected
let teamDronesData = [];
const DRONE_ID = 1; // Fixed ID for single drone

// Endpoint to get team drones (for offensive dashboard)
app.get("/api/offensive/drones", async (_req, res) => {
  try {
    res.json({ drones: teamDronesData, total: teamDronesData.length, lastUpdated: new Date().toISOString() });
  } catch (error) {
    console.error("[api] Error getting offensive drones:", error);
    res.status(500).json({ error: "Failed to get offensive drones", message: error.message });
  }
});

// Helper function to update drone data from MATLAB format
// Expected format: { "lat": value, "lng": value or "lon": value, "height": value }
// Note: MATLAB coordinate system may have inverted Y axis (height negative = underground)
function updateDroneData(data) {
  try {
    const timestamp = new Date().toISOString();
    let lat = parseFloat(data.lat);
    // Support both "lng" and "lon" (MATLAB might use "lon")
    let lng = parseFloat(data.lng || data.lon);
    let height = parseFloat(data.height) || 0;
    
    // Validate data
    if (isNaN(lat) || isNaN(lng)) {
      console.error("[DRONE] Invalid lat/lng values:", { lat: data.lat, lng: data.lng || data.lon });
      return false;
    }
    
    // Fix inverted Y axis: if height is negative, it means the coordinate system is inverted
    // Invert height to make it positive (above ground)
    if (height < 0) {
      height = Math.abs(height);
      console.log(`[DRONE] Fixed inverted height: ${data.height} -> ${height}`);
    }
    
    // Fix inverted Y axis for latitude if needed (if coordinates are in local coordinate system)
    // If latitude is negative and seems to be in wrong range, might need to invert
    // For now, we'll keep lat/lng as is but ensure height is positive
    
    // Check if drone exists
    const existingIndex = teamDronesData.findIndex(d => d.id === DRONE_ID);
    
    if (existingIndex >= 0) {
      // Update existing drone
      const previousLocation = teamDronesData[existingIndex].location;
      teamDronesData[existingIndex] = {
        id: DRONE_ID,
        name: "Team Drone",
        status: "active",
        battery: 100,
        location: { lat, lng },
        height: height,
        speed: 0,
        heading: 0,
        lastUpdate: timestamp,
        previousLocation: previousLocation
      };
      console.log(`[DRONE] Updated drone ${DRONE_ID} - Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}, Height: ${height.toFixed(2)}m`);
    } else {
      // Add new drone
      teamDronesData.push({
        id: DRONE_ID,
        name: "Team Drone",
        status: "active",
        battery: 100,
        location: { lat, lng },
        height: height,
        speed: 0,
        heading: 0,
        lastUpdate: timestamp
      });
      console.log(`[DRONE] Added new drone ${DRONE_ID} - Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}, Height: ${height.toFixed(2)}m`);
    }
    
    // Emit to all connected clients via Socket.IO
    io.emit("team-drones-update", { drones: teamDronesData, timestamp });
    console.log(`[DRONE] Emitted update to ${io.engine.clientsCount} connected client(s)`);
    
    return true;
  } catch (error) {
    console.error("[DRONE] Error updating drone data:", error);
    return false;
  }
}

// Endpoint to receive drone data from MATLAB (JSON POST)
app.post("/api/offensive/drones/update", async (req, res) => {
  try {
    const droneData = req.body;
    const timestamp = new Date().toISOString();
    
    console.log(`[API] [${timestamp}] Received drone update from MATLAB (HTTP POST):`, JSON.stringify(droneData));
    
    // Expected format: { "lat": value, "lng": value, "height": value }
    const success = updateDroneData(droneData);
    
    if (success) {
      res.json({ 
        success: true, 
        message: "Drone data updated successfully", 
        drone: teamDronesData[0] || null,
        timestamp 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: "Invalid drone data format", 
        expected: { lat: "number", lng: "number", height: "number (optional)" },
        received: droneData
      });
    }
  } catch (error) {
    console.error("[API] Error updating drone data:", error);
    res.status(500).json({ error: "Failed to update drone data", message: error.message });
  }
});

// MQTT Configuration (optional - for real-time updates from MATLAB)
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://localhost:1883";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "tesa/drones/offensive";
let mqttClient = null;

// Initialize MQTT client (if broker is available)
function initializeMQTT() {
  try {
    mqttClient = mqtt.connect(MQTT_BROKER, {
      clientId: `tesa-server-${Date.now()}`,
      reconnectPeriod: 5000
    });

    mqttClient.on("connect", () => {
      const timestamp = new Date().toISOString();
      console.log(`[MQTT] [${timestamp}] ✅ Connected to broker: ${MQTT_BROKER}`);
      mqttClient.subscribe(MQTT_TOPIC, (err) => {
        if (err) {
          console.error(`[MQTT] [${timestamp}] ❌ Error subscribing to ${MQTT_TOPIC}:`, err);
        } else {
          console.log(`[MQTT] [${timestamp}] ✅ Subscribed to topic: ${MQTT_TOPIC}`);
          console.log(`[MQTT] [${timestamp}] 📡 Waiting for drone data from MATLAB...`);
          console.log(`[MQTT] [${timestamp}] 📋 Expected format: { "lat": number, "lng": number (or "lon"), "height": number }`);
        }
      });
    });

    mqttClient.on("message", (topic, message) => {
      try {
        const timestamp = new Date().toISOString();
        const messageStr = message.toString();
        console.log(`[MQTT] [${timestamp}] Received message from topic "${topic}":`, messageStr);
        
        // Parse JSON message
        const data = JSON.parse(messageStr);
        console.log(`[MQTT] [${timestamp}] Parsed JSON data:`, JSON.stringify(data));
        
        // Expected format from MATLAB: { "lat": value, "lng": value, "height": value }
        // Update drone data
        const success = updateDroneData(data);
        
        if (success) {
          console.log(`[MQTT] [${timestamp}] Successfully processed drone update from MATLAB`);
        } else {
          console.error(`[MQTT] [${timestamp}] Failed to process drone update - invalid data format`);
        }
      } catch (error) {
        console.error(`[MQTT] [${new Date().toISOString()}] Error parsing message:`, error.message);
        console.error(`[MQTT] Raw message:`, message.toString());
      }
    });

    mqttClient.on("error", (error) => {
      console.error(`[MQTT] [${new Date().toISOString()}] ❌ Error:`, error.message);
    });

    mqttClient.on("close", () => {
      console.log(`[MQTT] [${new Date().toISOString()}] ⚠️  Connection closed`);
    });

    mqttClient.on("reconnect", () => {
      console.log(`[MQTT] [${new Date().toISOString()}] 🔄 Reconnecting to broker...`);
    });
  } catch (error) {
    console.warn("[MQTT] Failed to initialize MQTT client:", error.message);
    console.warn("[MQTT] Will use HTTP POST endpoint instead");
  }
}

// Watch for JSON file updates (alternative to MQTT)
// Expected format: { "lat": value, "lng": value, "height": value }
const DRONES_JSON_PATH = path.join(DATA_DIR, "team-drones.json");
async function watchDronesFile() {
  try {
    // Check if file exists, create if not
    try {
      await fs.access(DRONES_JSON_PATH);
    } catch {
      // File doesn't exist, create empty file with comment
      const defaultData = { lat: 0, lng: 0, height: 0 };
      await fs.writeFile(DRONES_JSON_PATH, JSON.stringify(defaultData, null, 2));
      console.log(`[WATCHER] Created default drones file: ${DRONES_JSON_PATH}`);
      console.log(`[WATCHER] Expected format: { "lat": number, "lng": number, "height": number }`);
    }

    const watcher = chokidar.watch(DRONES_JSON_PATH, {
      persistent: true,
      ignoreInitial: false
    });

    watcher.on("change", async (filePath) => {
      try {
        const timestamp = new Date().toISOString();
        console.log(`[WATCHER] [${timestamp}] 📁 Drones file changed: ${filePath}`);
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        console.log(`[WATCHER] [${timestamp}] 📄 File content:`, JSON.stringify(data));
        
        // Expected format: { "lat": value, "lng": value, "height": value }
        const success = updateDroneData(data);
        
        if (success) {
          console.log(`[WATCHER] [${timestamp}] ✅ Successfully updated drone from file`);
        } else {
          console.error(`[WATCHER] [${timestamp}] ❌ Failed to update drone from file - invalid format`);
        }
      } catch (error) {
        console.error(`[WATCHER] [${new Date().toISOString()}] ❌ Error reading drones file:`, error.message);
      }
    });

    console.log(`[WATCHER] 👀 Watching drones file: ${DRONES_JSON_PATH}`);
    console.log(`[WATCHER] 📋 Expected format: { "lat": number, "lng": number, "height": number }`);
  } catch (error) {
    console.warn(`[WATCHER] ⚠️  Failed to watch drones file:`, error.message);
  }
}

// Helper function to read and parse CSV file
async function readCSVFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    if (lines.length < 2) return null;
    
    const headers = lines[0].split(",").map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || "";
      });
      data.push(obj);
    }
    
    return { headers, data };
  } catch (error) {
    console.error(`Error reading CSV file ${filePath}:`, error);
    return null;
  }
}

// Helper function to read image file as base64
async function readImageFile(filePath) {
  try {
    const imageBuffer = await fs.readFile(filePath);
    const base64Image = imageBuffer.toString("base64");
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : 
                     ext === ".png" ? "image/png" : "image/jpeg";
    return `data:${mimeType};base64,${base64Image}`;
  } catch (error) {
    console.error(`Error reading image file ${filePath}:`, error);
    return null;
  }
}

// Helper function to get the latest files
async function getLatestFiles() {
  try {
    const csvFiles = await fs.readdir(CSV_DIR);
    const imageFiles = await fs.readdir(IMAGE_DIR);
    
    // Sort by modification time and get the latest
    const csvStats = await Promise.all(
      csvFiles.map(async (file) => {
        const filePath = path.join(CSV_DIR, file);
        const stats = await fs.stat(filePath);
        return { file, path: filePath, mtime: stats.mtime };
      })
    );
    
    const imageStats = await Promise.all(
      imageFiles.map(async (file) => {
        const filePath = path.join(IMAGE_DIR, file);
        const stats = await fs.stat(filePath);
        return { file, path: filePath, mtime: stats.mtime };
      })
    );
    
    const latestCSV = csvStats.sort((a, b) => b.mtime - a.mtime)[0];
    const latestImage = imageStats.sort((a, b) => b.mtime - a.mtime)[0];
    
    return { latestCSV, latestImage };
  } catch (error) {
    console.error("Error getting latest files:", error);
    return { latestCSV: null, latestImage: null };
  }
}

// Process and emit new data
async function processAndEmitData(csvPath, imagePath) {
  try {
    const csvData = csvPath ? await readCSVFile(csvPath) : null;
    const imageData = imagePath ? await readImageFile(imagePath) : null;
    
    if (csvData || imageData) {
      const payload = {
        timestamp: new Date().toISOString(),
        csv: csvData,
        image: imageData,
        csvPath: csvPath ? path.basename(csvPath) : null,
        imagePath: imagePath ? path.basename(imagePath) : null
      };
      
      io.emit("drone-data", payload);
      console.log(`[socket] Emitted drone data: ${payload.csvPath || "no CSV"}, ${payload.imagePath || "no image"}`);
    }
  } catch (error) {
    console.error("Error processing data:", error);
  }
}

// Set up file watchers
function setupFileWatchers() {
  // Watch CSV directory
  const csvWatcher = chokidar.watch(CSV_DIR, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: false
  });

  // Watch image directory
  const imageWatcher = chokidar.watch(IMAGE_DIR, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: false
  });

  let csvQueue = [];
  let imageQueue = [];
  let processing = false;

  // Debounce function to batch process files
  async function processQueue() {
    if (processing) return;
    processing = true;

    // Wait a bit to collect multiple files
    await new Promise(resolve => setTimeout(resolve, 100));

    const latestCSV = csvQueue.length > 0 ? csvQueue[csvQueue.length - 1] : null;
    const latestImage = imageQueue.length > 0 ? imageQueue[imageQueue.length - 1] : null;

    csvQueue = [];
    imageQueue = [];

    if (latestCSV || latestImage) {
      await processAndEmitData(latestCSV, latestImage);
    }

    processing = false;
  }

  csvWatcher.on("add", async (filePath) => {
    console.log(`[watcher] New CSV file: ${filePath}`);
    csvQueue.push(filePath);
    await processQueue();
  });

  csvWatcher.on("change", async (filePath) => {
    console.log(`[watcher] CSV file changed: ${filePath}`);
    csvQueue.push(filePath);
    await processQueue();
  });

  imageWatcher.on("add", async (filePath) => {
    console.log(`[watcher] New image file: ${filePath}`);
    imageQueue.push(filePath);
    await processQueue();
  });

  imageWatcher.on("change", async (filePath) => {
    console.log(`[watcher] Image file changed: ${filePath}`);
    imageQueue.push(filePath);
    await processQueue();
  });

  console.log(`[watcher] Watching CSV directory: ${CSV_DIR}`);
  console.log(`[watcher] Watching image directory: ${IMAGE_DIR}`);
}

// Socket.IO connection handling
io.on("connection", async (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);

  // Send initial data when client connects
  const { latestCSV, latestImage } = await getLatestFiles();
  if (latestCSV || latestImage) {
    await processAndEmitData(latestCSV?.path, latestImage?.path);
  }

  socket.on("disconnect", () => {
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

// Initialize file watchers (with error handling)
async function initialize() {
  try {
    // Check if directories exist
    await fs.access(CSV_DIR);
    await fs.access(IMAGE_DIR);
    setupFileWatchers();
  } catch (error) {
    console.warn(`[warning] Directory not found: ${error.path || "unknown"}`);
    console.warn(`[warning] Please ensure dataForWeb/csv and dataForWeb/image directories exist`);
    console.warn(`[warning] Expected path: ${DATA_DIR}`);
    console.warn(`[warning] You can set DATA_DIR environment variable to customize the path`);
    // Still start the server, watchers will be set up when directories are created
    setupFileWatchers();
  }
  
  // Log detected directory info
  try {
    await fs.access(DETECTED_DIR);
    const files = await fs.readdir(DETECTED_DIR);
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
    console.log(`[server] Detected directory found: ${DETECTED_DIR}`);
    console.log(`[server] Found ${imageFiles.length} image files in detected directory`);
  } catch (error) {
    console.warn(`[warning] Detected directory not found: ${DETECTED_DIR}`);
    console.warn(`[warning] Please ensure dataForWeb/detected directory exists`);
  }
  
  // Initialize MQTT client (optional)
  initializeMQTT();
  
  // Watch for team drones JSON file (alternative to MQTT)
  watchDronesFile();
}

initialize();

httpServer.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
  console.log(`[server] Socket.IO ready for connections`);
  console.log(`[server] Watching for data in: ${DATA_DIR}`);
});


