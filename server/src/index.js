import express from "express";
import cors from "cors";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "tesa-drone-detector-backend" });
});

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});


