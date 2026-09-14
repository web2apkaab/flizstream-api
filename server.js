
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Home API
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
    app: "FLIZSTREAM"
  });
});

// API Health Check
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: "online",
    message: "Streaming API is working"
  });
});

// Stream information
app.get("/api/stream", (req, res) => {
  res.json({
    success: true,
    stream: {
      title: "My Gaming Live Stream",
      status: "offline",
      platform: "YouTube",
      resolution: "720p",
      fps: 30
    }
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`FLIZSTREAM API running on port ${PORT}`);
});
