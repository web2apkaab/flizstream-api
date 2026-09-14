const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Temporary stream storage
let streams = [];

// Home API
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
    app: "FLIZSTREAM"
  });
});

// API Status
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: "online",
    message: "Streaming API is working"
  });
});

// Create a new stream
app.post("/api/stream/create", (req, res) => {
  const {
    title,
    description,
    platform,
    resolution,
    fps,
    bitrate
  } = req.body;

  if (!title) {
    return res.status(400).json({
      success: false,
      message: "Stream title is required"
    });
  }

  const newStream = {
    id: Date.now().toString(),
    title: title,
    description: description || "",
    platform: platform || "YouTube",
    resolution: resolution || "720p",
    fps: fps || 30,
    bitrate: bitrate || 2500,
    status: "created",
    createdAt: new Date().toISOString()
  };

  streams.push(newStream);

  res.status(201).json({
    success: true,
    message: "Stream created successfully",
    stream: newStream
  });
});

// Get all streams
app.get("/api/streams", (req, res) => {
  res.json({
    success: true,
    total: streams.length,
    streams: streams
  });
});

// Get single stream
app.get("/api/stream/:id", (req, res) => {
  const stream = streams.find(
    (item) => item.id === req.params.id
  );

  if (!stream) {
    return res.status(404).json({
      success: false,
      message: "Stream not found"
    });
  }

  res.json({
    success: true,
    stream: stream
  });
});

// Start stream
app.post("/api/stream/:id/start", (req, res) => {
  const stream = streams.find(
    (item) => item.id === req.params.id
  );

  if (!stream) {
    return res.status(404).json({
      success: false,
      message: "Stream not found"
    });
  }

  stream.status = "live";
  stream.startedAt = new Date().toISOString();

  res.json({
    success: true,
    message: "Stream started successfully",
    stream: stream
  });
});

// Stop stream
app.post("/api/stream/:id/stop", (req, res) => {
  const stream = streams.find(
    (item) => item.id === req.params.id
  );

  if (!stream) {
    return res.status(404).json({
      success: false,
      message: "Stream not found"
    });
  }

  stream.status = "stopped";
  stream.stoppedAt = new Date().toISOString();

  res.json({
    success: true,
    message: "Stream stopped successfully",
    stream: stream
  });
});

// Server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`FLIZSTREAM API running on port ${PORT}`);
});
