import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import chokidar from "chokidar";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "tesa-drone-detector-backend" });
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
}

initialize();

httpServer.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
  console.log(`[server] Socket.IO ready for connections`);
  console.log(`[server] Watching for data in: ${DATA_DIR}`);
});


