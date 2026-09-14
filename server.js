const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

const PORT = process.env.PORT || 3000;

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());
app.use(express.json());

// ===============================
// GOOGLE OAUTH CONFIG
// ===============================

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "https://flizstream-api.onrender.com/auth/google/callback";

// ===============================
// OAUTH CLIENT
// ===============================

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// ===============================
// CONNECTED ACCOUNT STORAGE
// NOTE:
// Render restart hone par memory reset ho sakti hai.
// Production me database use karna chahiye.
// ===============================

let connectedAccount = null;

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
    status: "online",
    version: "1.0.0"
  });
});

// ===============================
// API STATUS
// ===============================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: "online",
    message: "FLIZSTREAM API Connected"
  });
});

// ===============================
// YOUTUBE LOGIN
// ===============================

app.get("/auth/youtube", (req, res) => {
  startGoogleAuth(req, res);
});

// ===============================
// GOOGLE LOGIN
// ===============================

app.get("/auth/google", (req, res) => {
  startGoogleAuth(req, res);
});

// ===============================
// START GOOGLE AUTH
// ===============================

function startGoogleAuth(req, res) {
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

    console.error("AUTH ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to start YouTube authentication",
      error: error.message
    });
  }
}

// ===============================
// GOOGLE CALLBACK
// ===============================

app.get("/auth/google/callback", async (req, res) => {
  await handleGoogleCallback(req, res);
});

// ===============================
// YOUTUBE CALLBACK
// ===============================

app.get("/auth/youtube/callback", async (req, res) => {
  await handleGoogleCallback(req, res);
});

// ===============================
// HANDLE CALLBACK
// ===============================

async function handleGoogleCallback(req, res) {

  try {

    const code = req.query.code;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code not received"
      });
    }

    // Exchange authorization code
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // YouTube API
    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    // Get channel
    const response = await youtube.channels.list({
      part: [
        "snippet",
        "contentDetails",
        "statistics",
        "status"
      ].join(","),
      mine: true
    });

    const channels = response.data.items || [];

    // ===============================
    // GOOGLE ACCOUNT CONNECTED
    // BUT NO YOUTUBE CHANNEL
    // ===============================

    if (channels.length === 0) {

      connectedAccount = {
        connected: true,
        channelFound: false,
        channelId: null,
        channelName: "No YouTube Channel Found",
        thumbnail: null,
        connectedAt: new Date().toISOString()
      };

      return res.send(successPage({
        channelName: "Google Account Connected",
        thumbnail: "",
        channelId: "No YouTube Channel Found"
      }));
    }

    const channel = channels[0];

    const channelId = channel.id;

    const channelName =
      channel.snippet?.title ||
      "YouTube Channel";

    const thumbnail =
      channel.snippet?.thumbnails?.high?.url ||
      channel.snippet?.thumbnails?.medium?.url ||
      channel.snippet?.thumbnails?.default?.url ||
      "";

    // ===============================
    // SAVE ACCOUNT
    // ===============================

    connectedAccount = {
      connected: true,
      channelFound: true,
      channelId: channelId,
      channelName: channelName,
      thumbnail: thumbnail,
      connectedAt: new Date().toISOString()
    };

    console.log("YOUTUBE CONNECTED:");
    console.log(connectedAccount);

    // ===============================
    // SUCCESS PAGE
    // ===============================

    res.send(successPage({
      channelName,
      thumbnail,
      channelId
    }));

  } catch (error) {

    console.error("YOUTUBE CONNECTION ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to connect YouTube account",
      error: error.message
    });
  }
}

// ===============================
// SUCCESS HTML PAGE
// ===============================

function successPage(data) {

  const imageHtml = data.thumbnail
    ? `<img src="${data.thumbnail}" class="profile-image">`
    : `<div class="profile-placeholder">▶</div>`;

  return `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width, initial-scale=1.0">

<title>FLIZSTREAM Connected</title>

<style>

* {
  box-sizing: border-box;
}

body {

  margin: 0;

  min-height: 100vh;

  display: flex;

  align-items: center;

  justify-content: center;

  font-family:
  Arial,
  Helvetica,
  sans-serif;

  background:

  radial-gradient(
  circle at top,
  #17243b,
  #070d18 70%
  );

  color: white;

  padding: 20px;

}

.card {

  width: 100%;

  max-width: 620px;

  padding:

  50px 30px;

  text-align: center;

  border-radius: 35px;

  background:

  rgba(
  42,
  55,
  75,
  0.95
  );

  border:

  1px solid
  rgba(
  255,
  255,
  255,
  0.08
  );

  box-shadow:

  0 20px 60px
  rgba(
  0,
  0,
  0,
  0.4
  );

}

.logo {

  width: 120px;

  height: 120px;

  margin:

  0 auto
  35px;

  border-radius: 28px;

  display: flex;

  align-items: center;

  justify-content: center;

  font-size: 70px;

  background:

  linear-gradient(
  135deg,
  #6db12d,
  #4d8f18
  );

}

.title {

  font-size: 45px;

  line-height: 1.1;

  margin-bottom: 40px;

  color: #62d889;

  font-weight: 800;

}

.profile-image {

  width: 140px;

  height: 140px;

  border-radius: 50%;

  object-fit: cover;

  margin-bottom: 25px;

  border:

  5px solid
  rgba(
  255,
  255,
  255,
  0.1
  );

}

.profile-placeholder {

  width: 140px;

  height: 140px;

  margin:

  0 auto
  25px;

  border-radius: 50%;

  display: flex;

  align-items: center;

  justify-content: center;

  font-size: 55px;

  background: #ff3131;

}

.channel-name {

  font-size: 35px;

  font-weight: bold;

  margin-bottom: 25px;

}

.message {

  font-size: 22px;

  line-height: 1.7;

  color: #d2d7df;

}

.channel-id {

  margin-top: 30px;

  font-size: 18px;

  color: #aeb6c3;

  word-break: break-word;

}

.close-btn {

  margin-top: 40px;

  border: none;

  padding:

  18px
  60px;

  border-radius: 20px;

  font-size: 24px;

  color: white;

  cursor: pointer;

  background:

  linear-gradient(
  135deg,
  #ff4b4b,
  #ff3030
  );

}

.close-btn:active {

  transform:
  scale(0.96);

}

/* MOBILE */

@media(max-width: 600px) {

  .card {

    padding:
    45px
    20px;

  }

  .logo {

    width: 100px;

    height: 100px;

    font-size: 55px;

  }

  .title {

    font-size: 38px;

  }

  .channel-name {

    font-size: 30px;

  }

  .message {

    font-size: 19px;

  }

}

</style>

</head>

<body>

<div class="card">

<div class="logo">
✓
</div>

<div class="title">
Successfully<br>
Connected!
</div>

${imageHtml}

<div class="channel-name">
${escapeHtml(data.channelName)}
</div>

<div class="message">

Your Google and YouTube account
has been connected successfully
with FLIZSTREAM.

</div>

<div class="channel-id">

Channel ID:<br>

${escapeHtml(data.channelId)}

</div>

<button
class="close-btn"
onclick="window.close();">

Close

</button>

</div>

</body>

</html>
`;
}

// ===============================
// GET CONNECTED ACCOUNT
// ===============================

app.get("/api/youtube/account", (req, res) => {

  res.json({
    success: true,
    account: connectedAccount || {
      connected: false,
      channelFound: false,
      channelId: null,
      channelName: null,
      thumbnail: null
    }
  });

});

// ===============================
// ALTERNATIVE ACCOUNT ROUTE
// ===============================

app.get("/api/account", (req, res) => {

  res.json({
    success: true,
    account: connectedAccount || {
      connected: false
    }
  });

});

// ===============================
// YOUTUBE CHANNEL DETAILS
// ===============================

app.get("/api/youtube/channel", async (req, res) => {

  try {

    if (!connectedAccount?.connected) {

      return res.status(401).json({
        success: false,
        message: "No YouTube account connected"
      });

    }

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    const response =
      await youtube.channels.list({

        part:
        "snippet,statistics,status",

        mine: true

      });

    res.json({
      success: true,
      channel:
      response.data.items?.[0] || null
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message:
      "Failed to get channel details",

      error:
      error.message
    });

  }

});

// ===============================
// LOGOUT / DISCONNECT
// ===============================

app.post("/api/youtube/disconnect", (req, res) => {

  connectedAccount = null;

  oauth2Client.setCredentials({});

  res.json({
    success: true,
    message:
    "YouTube account disconnected successfully"
  });

});

// ===============================
// LIVE STATUS
// ===============================

app.get("/api/live/status", async (req, res) => {

  try {

    if (!connectedAccount?.connected) {

      return res.status(401).json({
        success: false,
        message:
        "Please connect your YouTube account first"
      });

    }

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    const response =
      await youtube.liveBroadcasts.list({

        part:
        "snippet,status",

        mine: true,

        broadcastStatus:
        "active"

      });

    res.json({
      success: true,
      live:
      response.data.items || []
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message:
      "Failed to get live details",

      error:
      error.message
    });

  }

});

// ===============================
// ROUTE NOT FOUND
// ===============================

app.use((req, res) => {

  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,

    availableRoutes: [

      "/",

      "/api/status",

      "/auth/youtube",

      "/auth/google",

      "/api/youtube/account",

      "/api/youtube/channel",

      "/api/live/status"

    ]

  });

});

// ===============================
// ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {

  console.error(err);

  res.status(500).json({
    success: false,
    message:
    "Internal server error",

    error:
    err.message
  });

});

// ===============================
// HTML ESCAPE
// ===============================

function escapeHtml(text) {

  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

  console.log(
    `FLIZSTREAM API running on port ${PORT}`
  );

});
