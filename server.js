const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// GOOGLE / YOUTUBE OAUTH CONFIGURATION
// ==========================================

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "https://flizstream-api.onrender.com/auth/youtube/callback";

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// ==========================================
// TEMPORARY STREAM STORAGE
// ==========================================

let streams = [];

// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
    app: "FLIZSTREAM"
  });
});

// ==========================================
// API STATUS
// ==========================================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: "online",
    message: "Streaming API is working"
  });
});

// ==========================================
// YOUTUBE LOGIN
// ==========================================

app.get("/auth/youtube", (req, res) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Google OAuth environment variables are missing"
      });
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.force-ssl"
      ]
    });

    res.redirect(authUrl);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Unable to start YouTube authentication",
      error: error.message
    });
  }
});

// ==========================================
// YOUTUBE CALLBACK
// ==========================================

app.get("/auth/youtube/callback", async (req, res) => {
  try {
    const code = req.query.code;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code not received from Google"
      });
    }

    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    const response = await youtube.channels.list({
      part: ["snippet"],
      mine: true
    });

    const channel = response.data.items?.[0];

    res.json({
      success: true,
      message: "YouTube account connected successfully!",
      channel: channel
        ? {
            id: channel.id,
            title: channel.snippet?.title,
            thumbnail:
              channel.snippet?.thumbnails?.default?.url || null
          }
        : null
    });

  } catch (error) {
    console.error("YouTube OAuth Error:", error);

    res.status(500).json({
      success: false,
      message: "YouTube connection failed",
      error: error.message
    });
  }
});

// ==========================================
// CREATE STREAM
// ==========================================

app.post("/api/stream/create", (req, res) => {
  const {
    title,
    description,
    platform,
    resolution,
    fps,
    bitrate
  } = req.body;

  if (!title || title.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Stream title is required"
    });
  }

  const newStream = {
    id: Date.now().toString(),
    title: title.trim(),
    description: description || "",
    platform: platform || "YouTube",
    resolution: resolution || "720p",
    fps: Number(fps) || 30,
    bitrate: Number(bitrate) || 2500,
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

// ==========================================
// GET ALL STREAMS
// ==========================================

app.get("/api/streams", (req, res) => {
  res.json({
    success: true,
    total: streams.length,
    streams
  });
});

// ==========================================
// GET SINGLE STREAM
// ==========================================

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
    stream
  });
});

// ==========================================
// START STREAM
// ==========================================

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
    stream
  });
});

// ==========================================
// STOP STREAM
// ==========================================

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
    stream
  });
});

// ==========================================
// DELETE STREAM
// ==========================================

app.delete("/api/stream/:id", (req, res) => {
  const index = streams.findIndex(
    (item) => item.id === req.params.id
  );

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "Stream not found"
    });
  }

  const deletedStream = streams.splice(index, 1);

  res.json({
    success: true,
    message: "Stream deleted successfully",
    stream: deletedStream[0]
  });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 FLIZSTREAM API running on port ${PORT}`);
});
