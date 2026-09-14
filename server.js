const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// GOOGLE / YOUTUBE OAUTH CONFIGURATION
// ==========================================

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// IMPORTANT:
// This must exactly match Google Cloud Console
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "https://flizstream-api.onrender.com/auth/google/callback";

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// ==========================================
// TEMPORARY STORAGE
// NOTE: Render free instances can restart,
// so this data is temporary.
// ==========================================

let streams = [];
let connectedYouTubeAccount = null;

// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
    app: "FLIZSTREAM",
    status: "online"
  });
});

// ==========================================
// API STATUS
// ==========================================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: "online",
    message: "Streaming API is working",
    youtubeConnected: !!connectedYouTubeAccount
  });
});

// ==========================================
// START GOOGLE / YOUTUBE LOGIN
// ==========================================

app.get("/auth/youtube", (req, res) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Google OAuth environment variables are missing",
        required: [
          "GOOGLE_CLIENT_ID",
          "GOOGLE_CLIENT_SECRET"
        ]
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
    console.error("OAuth Start Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to start YouTube authentication",
      error: error.message
    });
  }
});

// ==========================================
// GOOGLE OAUTH CALLBACK
// ==========================================

app.get("/auth/google/callback", async (req, res) => {
  try {
    const code = req.query.code;

    // Google returned an error
    if (req.query.error) {
      return res.status(400).json({
        success: false,
        message: "Google authorization was cancelled or failed",
        error: req.query.error
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code not received from Google"
      });
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // ==========================================
    // GET CONNECTED YOUTUBE ACCOUNT INFORMATION
    // ==========================================

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    let channelData = null;

    try {
      const channelResponse = await youtube.channels.list({
        part: [
          "snippet",
          "statistics"
        ],
        mine: true
      });

      if (
        channelResponse.data.items &&
        channelResponse.data.items.length > 0
      ) {
        const channel = channelResponse.data.items[0];

        channelData = {
          channelId: channel.id,
          title: channel.snippet.title,
          description: channel.snippet.description || "",
          thumbnail:
            channel.snippet.thumbnails?.high?.url ||
            channel.snippet.thumbnails?.default?.url ||
            ""
        };
      }

    } catch (youtubeError) {
      console.error(
        "YouTube Channel Fetch Error:",
        youtubeError.message
      );
    }

    // ==========================================
    // SAVE TEMPORARY CONNECTION DATA
    // ==========================================

    connectedYouTubeAccount = {
      connected: true,

      connectedAt: new Date().toISOString(),

      tokens: {
        access_token: tokens.access_token || null,
        refresh_token: tokens.refresh_token || null,
        expiry_date: tokens.expiry_date || null
      },

      channel: channelData
    };

    console.log("YouTube account connected successfully");

    // ==========================================
    // SUCCESS PAGE
    // ==========================================

    const channelName =
      channelData?.title || "Your YouTube Account";

    res.send(`
      <!DOCTYPE html>
      <html lang="en">

      <head>

        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >

        <title>FLIZSTREAM Connected</title>

        <style>

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;

            min-height: 100vh;

            display: flex;

            justify-content: center;

            align-items: center;

            background:
              linear-gradient(
                135deg,
                #111827,
                #020617
              );

            font-family:
              Arial,
              sans-serif;

            color: white;

            padding: 20px;
          }

          .card {

            width: 100%;

            max-width: 500px;

            background:
              rgba(
                31,
                41,
                55,
                0.95
              );

            border-radius: 25px;

            padding: 45px 25px;

            text-align: center;

            box-shadow:
              0 20px 60px
              rgba(
                0,
                0,
                0,
                0.5
              );
          }

          .check {

            width: 100px;

            height: 100px;

            margin: auto;

            border-radius: 20px;

            display: flex;

            align-items: center;

            justify-content: center;

            font-size: 60px;

            background:
              #65a83a;

            color: white;
          }

          h1 {

            margin-top: 35px;

            font-size: 32px;

            color:
              #4ade80;
          }

          .channel {

            margin-top: 25px;

            font-size: 22px;

            font-weight: bold;

            color:
              #e5e7eb;
          }

          p {

            font-size: 18px;

            color:
              #cbd5e1;

            line-height: 1.6;
          }

          button {

            margin-top: 30px;

            border: none;

            padding:
              16px
              40px;

            border-radius: 15px;

            font-size: 20px;

            cursor: pointer;

            color: white;

            background:
              #ef4444;
          }

        </style>

      </head>

      <body>

        <div class="card">

          <div class="check">
            ✓
          </div>

          <h1>
            Successfully Connected!
          </h1>

          <div class="channel">
            ${channelName}
          </div>

          <p>
            Your Google and YouTube account
            has been connected successfully
            with FLIZSTREAM.
          </p>

          <button onclick="window.close()">
            Close
          </button>

        </div>

      </body>

      </html>
    `);

  } catch (error) {

    console.error(
      "OAuth Callback Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Google authentication failed",
      error: error.message
    });
  }
});

// ==========================================
// YOUTUBE CALLBACK BACKUP / ALIAS
// ==========================================

app.get("/auth/youtube/callback", async (req, res) => {

  const query = new URLSearchParams(req.query).toString();

  return res.redirect(
    `/auth/google/callback?${query}`
  );
});

// ==========================================
// GET CONNECTED ACCOUNT
// ==========================================

app.get("/api/youtube/account", (req, res) => {

  if (!connectedYouTubeAccount) {

    return res.status(404).json({
      success: false,
      message: "No YouTube account connected"
    });
  }

  res.json({
    success: true,
    account: {
      connected:
        connectedYouTubeAccount.connected,

      connectedAt:
        connectedYouTubeAccount.connectedAt,

      channel:
        connectedYouTubeAccount.channel
    }
  });
});

// ==========================================
// DISCONNECT YOUTUBE ACCOUNT
// ==========================================

app.post("/api/youtube/disconnect", (req, res) => {

  connectedYouTubeAccount = null;

  res.json({
    success: true,
    message: "YouTube account disconnected successfully"
  });
});

// ==========================================
// CREATE STREAM
// ==========================================

app.post("/api/streams", (req, res) => {

  const {
    title,
    description,
    game,
    thumbnail
  } = req.body;

  const stream = {

    id:
      Date.now().toString(),

    title:
      title || "Untitled Stream",

    description:
      description || "",

    game:
      game || "",

    thumbnail:
      thumbnail || "",

    status:
      "created",

    createdAt:
      new Date().toISOString()
  };

  streams.push(stream);

  res.status(201).json({
    success: true,
    message: "Stream created successfully",
    stream
  });
});

// ==========================================
// GET ALL STREAMS
// ==========================================

app.get("/api/streams", (req, res) => {

  res.json({
    success: true,

    total:
      streams.length,

    streams
  });
});

// ==========================================
// GET SINGLE STREAM
// ==========================================

app.get("/api/streams/:id", (req, res) => {

  const stream =
    streams.find(
      item => item.id === req.params.id
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
// DELETE STREAM
// ==========================================

app.delete("/api/streams/:id", (req, res) => {

  const index =
    streams.findIndex(
      item => item.id === req.params.id
    );

  if (index === -1) {

    return res.status(404).json({
      success: false,
      message: "Stream not found"
    });
  }

  const deletedStream =
    streams.splice(index, 1);

  res.json({
    success: true,
    message: "Stream deleted successfully",
    stream:
      deletedStream[0]
  });
});

// ==========================================
// 404 ROUTE HANDLER
// IMPORTANT: MUST BE LAST
// ==========================================

app.use((req, res) => {

  res.status(404).json({

    success: false,

    message:
      "Route not found",

    path:
      req.originalUrl
  });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {

  console.log(
    `FLIZSTREAM API running on port ${PORT}`
  );

  console.log(
    `Redirect URI: ${REDIRECT_URI}`
  );
});
