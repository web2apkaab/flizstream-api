const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

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

const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "https://flizstream-api.onrender.com/auth/youtube/callback";

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// ==========================================
// TEMPORARY STORAGE
// NOTE:
// Render restart होने पर यह memory reset हो सकती है.
// बाद में Database जोड़ेंगे.
// ==========================================

let connectedUser = null;
let streams = [];

// ==========================================
// HOME API
// ==========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
    app: "FLIZSTREAM",
    version: "1.0.0",
    endpoints: {
      status: "/api/status",
      googleLogin: "/auth/youtube",
      youtubeChannel: "/api/youtube/channel",
      connectedAccount: "/api/account"
    }
  });
});

// ==========================================
// API STATUS
// ==========================================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: "online",
    message: "FLIZSTREAM Streaming API is working",
    googleConnected: connectedUser !== null
  });
});

// ==========================================
// GOOGLE / YOUTUBE LOGIN
// ==========================================

app.get("/auth/youtube", (req, res) => {
  try {

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Google OAuth environment variables are missing",
        requiredVariables: [
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

    console.error("Google Login Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to start YouTube authentication",
      error: error.message
    });

  }
});

// ==========================================
// GOOGLE / YOUTUBE CALLBACK
// ==========================================

app.get("/auth/youtube/callback", async (req, res) => {

  try {

    const code = req.query.code;

    const googleError = req.query.error;

    // User denied permission
    if (googleError) {

      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Failed</title>

          <style>
            body {
              margin: 0;
              background: #111827;
              color: white;
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }

            .card {
              background: #1f2937;
              padding: 40px;
              border-radius: 20px;
              text-align: center;
              max-width: 500px;
              width: 90%;
            }

            h1 {
              color: #ef4444;
            }

            button {
              background: #ef4444;
              border: none;
              color: white;
              padding: 14px 30px;
              border-radius: 10px;
              font-size: 16px;
              cursor: pointer;
            }
          </style>
        </head>

        <body>

          <div class="card">

            <h1>❌ Authentication Failed</h1>

            <p>You cancelled or denied Google permission.</p>

            <p>${googleError}</p>

            <br>

            <button onclick="window.location.href='/auth/youtube'">
              Try Again
            </button>

          </div>

        </body>
        </html>
      `);

    }

    // Authorization code missing
    if (!code) {

      return res.status(400).json({
        success: false,
        message: "Authorization code not received from Google"
      });

    }

    // Get Google Tokens
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // ==========================================
    // GET CONNECTED YOUTUBE CHANNEL
    // ==========================================

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    const channelResponse = await youtube.channels.list({
      part: [
        "snippet",
        "statistics"
      ],
      mine: true
    });

    let channelData = null;

    if (
      channelResponse.data.items &&
      channelResponse.data.items.length > 0
    ) {

      const channel = channelResponse.data.items[0];

      channelData = {
        id: channel.id,

        title: channel.snippet?.title || "Unknown Channel",

        description:
          channel.snippet?.description || "",

        thumbnail:
          channel.snippet?.thumbnails?.high?.url ||
          channel.snippet?.thumbnails?.medium?.url ||
          channel.snippet?.thumbnails?.default?.url ||
          "",

        subscribers:
          channel.statistics?.subscriberCount || "0",

        videos:
          channel.statistics?.videoCount || "0",

        views:
          channel.statistics?.viewCount || "0"
      };

    }

    // ==========================================
    // SAVE CONNECTED USER
    // ==========================================

    connectedUser = {
      connected: true,

      connectedAt: new Date().toISOString(),

      tokens: tokens,

      channel: channelData
    };

    console.log("=================================");
    console.log("GOOGLE ACCOUNT CONNECTED");
    console.log("CHANNEL:", channelData?.title);
    console.log("=================================");

    // ==========================================
    // SUCCESS PAGE
    // ==========================================

    const channelName =
      channelData?.title || "Google Account";

    const channelImage =
      channelData?.thumbnail || "";

    res.send(`
      <!DOCTYPE html>

      <html>

      <head>

        <title>FLIZSTREAM Connected</title>

        <meta name="viewport"
              content="width=device-width, initial-scale=1">

        <style>

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;

            min-height: 100vh;

            background:
              linear-gradient(
                135deg,
                #111827,
                #0f172a
              );

            font-family:
              Arial,
              sans-serif;

            display: flex;

            align-items: center;

            justify-content: center;

            color: white;
          }

          .card {

            width: 90%;

            max-width: 600px;

            background: #1f2937;

            padding: 50px 30px;

            border-radius: 25px;

            text-align: center;

            box-shadow:
              0 20px 60px
              rgba(0,0,0,.4);

          }

          .success {

            font-size: 70px;

            margin-bottom: 20px;

          }

          h1 {

            color: #4ade80;

            font-size: 38px;

            margin-bottom: 25px;

          }

          .profile {

            width: 100px;

            height: 100px;

            border-radius: 50%;

            object-fit: cover;

            margin: 20px auto;

            border:
              4px solid
              #4ade80;

          }

          .channel {

            font-size: 25px;

            font-weight: bold;

            margin: 15px;

          }

          .email {

            color: #cbd5e1;

            font-size: 17px;

            word-break: break-all;

          }

          .message {

            color: #cbd5e1;

            font-size: 18px;

            margin-top: 30px;

          }

          button {

            margin-top: 35px;

            background:
              linear-gradient(
                135deg,
                #ef4444,
                #dc2626
              );

            color: white;

            border: none;

            padding:
              16px 40px;

            font-size: 18px;

            border-radius: 15px;

            cursor: pointer;

          }

        </style>

      </head>

      <body>

        <div class="card">

          <div class="success">
            ✅
          </div>

          <h1>
            Successfully Connected!
          </h1>

          ${
            channelImage
              ? `<img
                   class="profile"
                   src="${channelImage}"
                   alt="Channel">`
              : ""
          }

          <div class="channel">
            ${channelName}
          </div>

          <div class="message">
            Google / YouTube account connected successfully.
          </div>

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
      error.response?.data || error.message
    );

    res.status(500).json({

      success: false,

      message:
        "Google authentication failed",

      error:
        error.response?.data?.error?.message ||
        error.message

    });

  }

});

// ==========================================
// GET CONNECTED ACCOUNT
// ==========================================

app.get("/api/account", (req, res) => {

  if (!connectedUser) {

    return res.status(401).json({
      success: false,
      connected: false,
      message: "No Google account connected"
    });

  }

  res.json({

    success: true,

    connected: true,

    connectedAt:
      connectedUser.connectedAt,

    channel:
      connectedUser.channel

  });

});

// ==========================================
// GET CONNECTED YOUTUBE CHANNEL
// ==========================================

app.get("/api/youtube/channel", async (req, res) => {

  try {

    if (!connectedUser) {

      return res.status(401).json({
        success: false,
        message:
          "Please connect your Google account first",
        loginUrl:
          "/auth/youtube"
      });

    }

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    const response =
      await youtube.channels.list({

        part: [
          "snippet",
          "statistics",
          "status"
        ],

        mine: true

      });

    if (
      !response.data.items ||
      response.data.items.length === 0
    ) {

      return res.status(404).json({

        success: false,

        message:
          "No YouTube channel found for this Google account"

      });

    }

    const channel =
      response.data.items[0];

    res.json({

      success: true,

      message:
        "YouTube channel connected successfully",

      channel: {

        id: channel.id,

        title:
          channel.snippet?.title,

        description:
          channel.snippet?.description,

        thumbnail:
          channel.snippet?.thumbnails?.high?.url ||
          channel.snippet?.thumbnails?.medium?.url ||
          channel.snippet?.thumbnails?.default?.url,

        subscribers:
          channel.statistics?.subscriberCount,

        videos:
          channel.statistics?.videoCount,

        views:
          channel.statistics?.viewCount

      }

    });

  } catch (error) {

    console.error(
      "YouTube Channel Error:",
      error.response?.data || error.message
    );

    res.status(500).json({

      success: false,

      message:
        "Unable to get YouTube channel",

      error:
        error.response?.data?.error?.message ||
        error.message

    });

  }

});

// ==========================================
// STREAM STORAGE API
// ==========================================

app.get("/api/streams", (req, res) => {

  res.json({

    success: true,

    totalStreams:
      streams.length,

    streams: streams

  });

});

// ==========================================
// CREATE DEMO STREAM
// ==========================================

app.post("/api/streams", (req, res) => {

  const {
    title,
    description,
    privacyStatus
  } = req.body;

  if (!title) {

    return res.status(400).json({

      success: false,

      message:
        "Stream title is required"

    });

  }

  const stream = {

    id:
      Date.now().toString(),

    title,

    description:
      description || "",

    privacyStatus:
      privacyStatus || "private",

    status:
      "created",

    createdAt:
      new Date().toISOString()

  };

  streams.push(stream);

  res.status(201).json({

    success: true,

    message:
      "Demo stream created successfully",

    stream

  });

});

// ==========================================
// START SERVER
// ==========================================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `FLIZSTREAM API running on port ${PORT}`
  );

});
