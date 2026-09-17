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
    version: "1.1.0"
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

    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

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

    if (channels.length === 0) {
      connectedAccount = {
        connected: true,
        channelFound: false,
        channelId: null,
        channelName: "No YouTube Channel Found",
        thumbnail: null,
        connectedAt: new Date().toISOString()
      };

      return res.send(
        successPage({
          channelName: "Google Account Connected",
          thumbnail: "",
          channelId: "No YouTube Channel Found"
        })
      );
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

    connectedAccount = {
      connected: true,
      channelFound: true,
      channelId,
      channelName,
      thumbnail,
      connectedAt: new Date().toISOString()
    };

    console.log("YOUTUBE CONNECTED:");
    console.log(connectedAccount);

    res.send(
      successPage({
        channelName,
        thumbnail,
        channelId
      })
    );

  } catch (error) {
    console.error("YOUTUBE CONNECTION ERROR:", error);

    const youtubeError =
      error?.response?.data?.error?.message ||
      error?.errors?.[0]?.message ||
      error?.message ||
      "Unknown YouTube API error";

    res.status(500).json({
      success: false,
      message: "Failed to connect YouTube account",
      error: youtubeError
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
  font-family: Arial, Helvetica, sans-serif;
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
  padding: 50px 30px;
  text-align: center;
  border-radius: 35px;
  background: rgba(42, 55, 75, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.4);
}

.logo {
  width: 120px;
  height: 120px;
  margin: 0 auto 35px;
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
  border: 5px solid rgba(255, 255, 255, 0.1);
}

.profile-placeholder {
  width: 140px;
  height: 140px;
  margin: 0 auto 25px;
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
  padding: 18px 60px;
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
  transform: scale(0.96);
}

@media(max-width: 600px) {

  .card {
    padding: 45px 20px;
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

    const response = await youtube.channels.list({
      part: "snippet,statistics,status",
      mine: true
    });

    res.json({
      success: true,
      channel: response.data.items?.[0] || null
    });

  } catch (error) {

    console.error("CHANNEL DETAILS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get channel details",
      error: error.message
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
    message: "YouTube account disconnected successfully"
  });
});

// ===============================
// CREATE YOUTUBE LIVE STREAM
// ===============================

app.post("/api/stream/create", async (req, res) => {

  try {

    if (!connectedAccount?.connected) {
      return res.status(401).json({
        success: false,
        message: "Please connect your YouTube account first"
      });
    }

    const {
      title = "Live Stream from Android",
      description = "Live Stream via FLIZSTREEM App",
      privacy = "public",
      resolution = "720p",
      fps = 30
    } = req.body || {};

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    // ===============================
    // 1. CREATE LIVE BROADCAST
    // ===============================

    const broadcastResponse =
      await youtube.liveBroadcasts.insert({

        part: "snippet,status,contentDetails",

        requestBody: {

          snippet: {

            title:
              String(title).trim() ||
              "Live Stream from Android",

            description:
              String(description),

            scheduledStartTime:
              new Date().toISOString()
          },

          status: {

            privacyStatus:
              ["public", "unlisted", "private"]
                .includes(
                  String(privacy).toLowerCase()
                )
                ? String(privacy).toLowerCase()
                : "public"
          },

          contentDetails: {

            enableAutoStart: true,

            enableAutoStop: true
          }

        }

      });

    const broadcast =
      broadcastResponse.data;

    if (!broadcast.id) {
      throw new Error(
        "YouTube did not return a broadcast ID"
      );
    }

    // ===============================
    // 2. CREATE ACTUAL RTMP STREAM
    // ===============================

    const validResolution =
      [
        "240p",
        "360p",
        "480p",
        "720p",
        "1080p",
        "1440p",
        "2160p"
      ].includes(String(resolution))
        ? String(resolution)
        : "720p";

    const validFps =
      [30, 60].includes(Number(fps))
        ? `${Number(fps)}fps`
        : "30fps";

    const streamResponse =
      await youtube.liveStreams.insert({

        part:
          "snippet,cdn,contentDetails,status",

        requestBody: {

          snippet: {

            title:
              `${String(title).trim() || "FLIZSTREEM"} - FLIZSTREEM`
          },

          cdn: {

            ingestionType: "rtmp",

            resolution: validResolution,

            frameRate: validFps
          }

        }

      });

    const stream =
      streamResponse.data;

    const ingestionInfo =
      stream.cdn?.ingestionInfo;

    const ingestionAddress =
      ingestionInfo?.ingestionAddress || "";

    const streamKey =
      ingestionInfo?.streamName || "";

    if (
      !stream.id ||
      !ingestionAddress ||
      !streamKey
    ) {
      throw new Error(
        "YouTube did not return a valid RTMP ingestion address or stream key"
      );
    }

    // ===============================
    // 3. BIND STREAM TO BROADCAST
    // ===============================

    await youtube.liveBroadcasts.bind({

      part:
        "id,contentDetails",

      id:
        broadcast.id,

      streamId:
        stream.id

    });

    console.log(
      "YOUTUBE LIVE STREAM CREATED:"
    );

    console.log({

      broadcastId:
        broadcast.id,

      streamId:
        stream.id,

      ingestionAddress

    });

    // ===============================
    // RESPONSE
    // ===============================

    res.json({

      success: true,

      streamId:
        stream.id,

      id:
        stream.id,

      broadcastId:
        broadcast.id,

      streamUrl:
        ingestionAddress,

      rtmpUrl:
        ingestionAddress,

      ingestionAddress:
        ingestionAddress,

      streamKey:
        streamKey,

      message:
        "YouTube live stream created successfully"

    });

  } catch (error) {

    console.error(
      "CREATE STREAM ERROR:",
      error
    );

    const youtubeError =
      error?.response?.data?.error?.message ||
      error?.errors?.[0]?.message ||
      error?.message ||
      "Unknown YouTube API error";

    res.status(500).json({

      success: false,

      message:
        "Failed to create YouTube live stream",

      error:
        youtubeError

    });
  }
});

// ===============================
// START YOUTUBE BROADCAST
// ===============================

app.post("/api/stream/:id/start", async (req, res) => {

  try {

    if (!connectedAccount?.connected) {
      return res.status(401).json({
        success: false,
        message: "Please connect your YouTube account first"
      });
    }

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    const broadcastId =
      req.body?.broadcastId ||
      req.query.broadcastId ||
      req.params.id;

    if (!broadcastId) {
      return res.status(400).json({
        success: false,
        message: "Broadcast ID is required"
      });
    }

    console.log("=================================");
    console.log("START YOUTUBE BROADCAST");
    console.log("Broadcast ID:", broadcastId);
    console.log("=================================");

    // =================================
    // STEP 1: GET BROADCAST
    // =================================

    const broadcastResponse =
      await youtube.liveBroadcasts.list({

        part:
          "id,status,contentDetails",

        id:
          broadcastId

      });

    const broadcast =
      broadcastResponse.data.items?.[0];

    if (!broadcast) {

      return res.status(404).json({
        success: false,
        message: "YouTube broadcast not found"
      });

    }

    const broadcastStatus =
      broadcast.status?.lifeCycleStatus ||
      "unknown";

    const boundStreamId =
      broadcast.contentDetails?.boundStreamId;

    console.log(
      "Broadcast Status:",
      broadcastStatus
    );

    console.log(
      "Bound Stream ID:",
      boundStreamId
    );

    // =================================
    // STEP 2: CHECK STREAM BINDING
    // =================================

    if (!boundStreamId) {

      return res.status(400).json({

        success: false,

        live: false,

        message:
          "Broadcast is not bound to a YouTube RTMP stream.",

        broadcastId

      });

    }

    // =================================
    // STEP 3: CHECK YOUTUBE RTMP STATUS
    // =================================

    const streamResponse =
      await youtube.liveStreams.list({

        part:
          "id,status",

        id:
          boundStreamId

      });

    const stream =
      streamResponse.data.items?.[0];

    if (!stream) {

      return res.status(404).json({

        success: false,

        live: false,

        message:
          "Bound YouTube RTMP stream not found.",

        broadcastId,

        streamId:
          boundStreamId

      });

    }

    const streamStatus =
      stream.status?.streamStatus ||
      "unknown";

    const healthStatus =
      stream.status?.healthStatus?.status ||
      "unknown";

    console.log(
      "YouTube RTMP Stream Status:",
      streamStatus
    );

    console.log(
      "YouTube Stream Health:",
      healthStatus
    );

    // =================================
    // STEP 4: RTMP NOT RECEIVING DATA
    // =================================

    if (streamStatus !== "active") {

      return res.json({

        success: true,

        live: false,

        waitingForRtmp: true,

        message:
          "YouTube is waiting for RTMP video data from FLIZSTREEM.",

        broadcastId,

        streamId:
          boundStreamId,

        broadcastStatus,

        streamStatus,

        healthStatus

      });

    }

    // =================================
    // STEP 5: RTMP IS ACTIVE
    // =================================

    console.log(
      "RTMP data is ACTIVE on YouTube."
    );

    // =================================
    // STEP 6: TRANSITION TO LIVE
    // =================================

    if (
      broadcastStatus !== "live" &&
      broadcastStatus !== "liveStarting"
    ) {

      console.log(
        "Transitioning YouTube broadcast to LIVE..."
      );

      const transitionResponse =
        await youtube.liveBroadcasts.transition({

          part:
            "id,snippet,status",

          id:
            broadcastId,

          broadcastStatus:
            "live"

        });

      const newStatus =
        transitionResponse.data.status
          ?.lifeCycleStatus ||
        "unknown";

      console.log(
        "New Broadcast Status:",
        newStatus
      );

      return res.json({

        success: true,

        live:
          newStatus === "live",

        message:
          newStatus === "live"
            ? "YouTube broadcast is now LIVE."
            : "YouTube broadcast is starting.",

        broadcastId,

        streamId:
          boundStreamId,

        broadcastStatus:
          newStatus,

        streamStatus,

        healthStatus

      });

    }

    // =================================
    // STEP 7: ALREADY LIVE / STARTING
    // =================================

    return res.json({

      success: true,

      live:
        broadcastStatus === "live" ||
        broadcastStatus === "liveStarting",

      message:
        broadcastStatus === "live"
          ? "YouTube broadcast is already LIVE."
          : "YouTube broadcast is starting.",

      broadcastId,

      streamId:
        boundStreamId,

      broadcastStatus,

      streamStatus,

      healthStatus

    });

  } catch (error) {

    console.error(
      "START STREAM ERROR:",
      error
    );

    const youtubeError =
      error?.response?.data?.error?.message ||
      error?.errors?.[0]?.message ||
      error?.message ||
      "Unknown YouTube API error";

    console.error(
      "YouTube Error:",
      youtubeError
    );

    return res.status(500).json({

      success: false,

      live: false,

      message:
        "Failed to start YouTube broadcast",

      error:
        youtubeError

    });

  }

});

// ===============================
// STOP YOUTUBE BROADCAST
// ===============================

app.post("/api/stream/:id/stop", async (req, res) => {

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

    const broadcastId =
      req.body?.broadcastId ||
      req.query.broadcastId ||
      req.params.id;

    const response =
      await youtube.liveBroadcasts.list({

        part:
          "id,status",

        id:
          broadcastId

      });

    const broadcast =
      response.data.items?.[0];

    if (!broadcast) {

      return res.status(404).json({

        success: false,

        message:
          "YouTube broadcast not found"

      });

    }

    if (
      broadcast.status?.lifeCycleStatus ===
      "live"
    ) {

      await youtube.liveBroadcasts.transition({

        part:
          "id,status",

        id:
          broadcastId,

        broadcastStatus:
          "complete"

      });

    }

    res.json({

      success: true,

      message:
        "YouTube broadcast stopped",

      broadcastId

    });

  } catch (error) {

    console.error(
      "STOP STREAM ERROR:",
      error
    );

    const youtubeError =
      error?.response?.data?.error?.message ||
      error?.errors?.[0]?.message ||
      error?.message ||
      "Unknown YouTube API error";

    res.status(500).json({

      success: false,

      message:
        "Failed to stop YouTube broadcast",

      error:
        youtubeError

    });

  }

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
          "snippet,status,contentDetails",

        mine:
          true

      });

    res.json({

      success:
        true,

      live:
        response.data.items || []

    });

  } catch (error) {

    console.error(
      "LIVE STATUS ERROR:",
      error
    );

    const youtubeError =
      error?.response?.data?.error?.message ||
      error?.errors?.[0]?.message ||
      error?.message ||
      "Unknown YouTube API error";

    res.status(500).json({

      success:
        false,

      message:
        "Failed to get live details",

      error:
        youtubeError

    });

  }

});

// ===============================
// ROUTE NOT FOUND
// ===============================

app.use((req, res) => {

  res.status(404).json({

    success:
      false,

    message:
      "Route not found",

    path:
      req.originalUrl,

    availableRoutes: [

      "/",

      "/api/status",

      "/auth/youtube",

      "/auth/google",

      "/api/youtube/account",

      "/api/account",

      "/api/youtube/channel",

      "/api/youtube/disconnect",

      "/api/stream/create",

      "/api/stream/:id/start",

      "/api/stream/:id/stop",

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

    success:
      false,

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

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

  console.log(
    `FLIZSTREAM API running on port ${PORT}`
  );

});
