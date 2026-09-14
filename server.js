const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==========================================
// GOOGLE OAUTH CONFIGURATION
// ==========================================

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

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
// IMPORTANT:
// Render restart होने पर यह data delete हो सकता है.
// बाद में database add करेंगे.
// ==========================================

let savedTokens = null;
let connectedChannel = null;

// ==========================================
// YOUTUBE CLIENT
// ==========================================

function getYouTubeClient() {
  if (!savedTokens) {
    throw new Error("YouTube account is not connected");
  }

  oauth2Client.setCredentials(savedTokens);

  return google.youtube({
    version: "v3",
    auth: oauth2Client
  });
}

// ==========================================
// HOME API
// ==========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
    app: "FLIZSTREAM"
  });
});

// ==========================================
// STATUS
// ==========================================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: "online",
    youtubeConnected: !!savedTokens,
    channel: connectedChannel
      ? connectedChannel.title
      : null
  });
});

// ==========================================
// GOOGLE LOGIN
// ==========================================

app.get("/auth/google", (req, res) => {
  try {

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Google OAuth credentials are missing"
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
      message: "Unable to start Google authentication",
      error: error.message
    });

  }
});

// ==========================================
// GOOGLE CALLBACK
// ==========================================

app.get("/auth/google/callback", async (req, res) => {

  try {

    console.log("OAuth Callback:", req.query);

    if (req.query.error) {
      return res.status(400).json({
        success: false,
        message: "Google authorization failed",
        error: req.query.error
      });
    }

    const code = req.query.code;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code not received"
      });
    }

    // ==========================================
    // GET TOKENS
    // ==========================================

    const { tokens } = await oauth2Client.getToken(code);

    savedTokens = tokens;

    oauth2Client.setCredentials(tokens);

    // ==========================================
    // CREATE YOUTUBE CLIENT
    // ==========================================

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    // ==========================================
    // GET CONNECTED CHANNEL
    // ==========================================

    const channelResponse = await youtube.channels.list({
      part: [
        "snippet",
        "statistics",
        "status"
      ],
      mine: true
    });

    const channel = channelResponse.data.items?.[0];

    if (channel) {

      connectedChannel = {
        id: channel.id,
        title: channel.snippet?.title,
        description: channel.snippet?.description,
        thumbnail:
          channel.snippet?.thumbnails?.high?.url ||
          channel.snippet?.thumbnails?.default?.url,
        subscribers:
          channel.statistics?.subscriberCount,
        views:
          channel.statistics?.viewCount,
        videos:
          channel.statistics?.videoCount
      };

    }

    console.log("CONNECTED CHANNEL:", connectedChannel);

    // ==========================================
    // SUCCESS PAGE
    // ==========================================

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

  font-family: Arial, sans-serif;

  background:
  linear-gradient(
    135deg,
    #071225,
    #111827
  );

  display: flex;

  justify-content: center;

  align-items: center;

  color: white;

  padding: 20px;
}

.card {

  width: 100%;

  max-width: 600px;

  background: #273548;

  border-radius: 35px;

  padding: 50px 25px;

  text-align: center;

  box-shadow:
  0 20px 80px
  rgba(0,0,0,.5);
}

.check {

  width: 150px;

  height: 150px;

  margin: auto;

  display: flex;

  align-items: center;

  justify-content: center;

  background: #65a42b;

  border-radius: 30px;

  font-size: 90px;
}

h1 {

  color: #5ee28c;

  font-size: 42px;

  margin-top: 50px;

}

.channel-image {

  width: 120px;

  height: 120px;

  border-radius: 50%;

  margin-top: 30px;

  object-fit: cover;

  background: #444;

}

.channel-name {

  font-size: 32px;

  font-weight: bold;

  margin-top: 20px;

}

p {

  font-size: 22px;

  line-height: 1.6;

  color: #d1d5db;

}

.info {

  margin-top: 20px;

  color: #9ca3af;

  font-size: 16px;

  word-break: break-all;

}

button {

  margin-top: 35px;

  background: #ff3b3b;

  color: white;

  border: none;

  padding: 20px 70px;

  font-size: 28px;

  border-radius: 20px;

  cursor: pointer;

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

${
connectedChannel?.thumbnail
? `<img class="channel-image"
src="${connectedChannel.thumbnail}">`
: ""
}

<div class="channel-name">

${connectedChannel?.title || "YouTube Channel"}

</div>

<p>

Your Google and YouTube account has been
connected successfully with FLIZSTREAM.

</p>

<div class="info">

Channel ID:<br>

${connectedChannel?.id || "Connected"}

</div>

<button onclick="window.close()">

Close

</button>

</div>

</body>
</html>
`);

  } catch (error) {

    console.error("OAuth Callback Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to connect YouTube account",
      error: error.message
    });

  }

});

// ==========================================
// GET CONNECTED CHANNEL
// ==========================================

app.get("/api/youtube/channel", async (req, res) => {

  try {

    if (!savedTokens) {

      return res.status(401).json({
        success: false,
        message: "YouTube account not connected",
        loginUrl: "/auth/google"
      });

    }

    const youtube = getYouTubeClient();

    const response =
      await youtube.channels.list({
        part: [
          "snippet",
          "statistics",
          "status"
        ],
        mine: true
      });

    const channel =
      response.data.items?.[0];

    if (!channel) {

      return res.status(404).json({
        success: false,
        message: "No YouTube channel found"
      });

    }

    const channelData = {

      id: channel.id,

      title:
        channel.snippet?.title,

      description:
        channel.snippet?.description,

      thumbnail:
        channel.snippet?.thumbnails?.high?.url ||
        channel.snippet?.thumbnails?.default?.url,

      subscribers:
        channel.statistics?.subscriberCount,

      views:
        channel.statistics?.viewCount,

      videos:
        channel.statistics?.videoCount

    };

    connectedChannel = channelData;

    res.json({
      success: true,
      channel: channelData
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to get channel information",
      error: error.message
    });

  }

});

// ==========================================
// CREATE YOUTUBE LIVE STREAM
// ==========================================

app.post("/api/live/create-stream",
async (req, res) => {

  try {

    const {

      title = "FLIZSTREAM Live",

      description = "Live stream created using FLIZSTREAM"

    } = req.body;

    const youtube =
      getYouTubeClient();

    const streamResponse =
      await youtube.liveStreams.insert({

        part: [
          "snippet",
          "cdn",
          "status"
        ],

        requestBody: {

          snippet: {

            title: title,

            description: description

          },

          cdn: {

            ingestionType: "rtmp",

            resolution: "variable",

            frameRate: "variable"

          }

        }

      });

    const stream =
      streamResponse.data;

    res.json({

      success: true,

      message:
        "YouTube live stream created successfully",

      stream: {

        id: stream.id,

        title:
          stream.snippet?.title,

        description:
          stream.snippet?.description,

        ingestionAddress:
          stream.cdn?.ingestionInfo?.ingestionAddress,

        backupIngestionAddress:
          stream.cdn?.ingestionInfo?.backupIngestionAddress,

        streamName:
          stream.cdn?.ingestionInfo?.streamName,

        streamKey:
          stream.cdn?.ingestionInfo?.streamName,

        rtmpUrl:
          `${stream.cdn?.ingestionInfo?.ingestionAddress}/${stream.cdn?.ingestionInfo?.streamName}`

      }

    });

  } catch (error) {

    console.error("Create Stream Error:", error);

    res.status(500).json({

      success: false,

      message:
        "Failed to create YouTube live stream",

      error:
        error.response?.data ||
        error.message

    });

  }

});

// ==========================================
// CREATE LIVE BROADCAST
// ==========================================

app.post("/api/live/create-broadcast",
async (req, res) => {

  try {

    const {

      title = "FLIZSTREAM Live",

      description = "Live streaming with FLIZSTREAM",

      privacyStatus = "public",

      scheduledStartTime

    } = req.body;

    const youtube =
      getYouTubeClient();

    // Default:
    // 2 minutes from now

    const startTime =
      scheduledStartTime ||
      new Date(
        Date.now() + 2 * 60 * 1000
      ).toISOString();

    const broadcastResponse =
      await youtube.liveBroadcasts.insert({

        part: [
          "snippet",
          "contentDetails",
          "status"
        ],

        requestBody: {

          snippet: {

            title: title,

            description: description,

            scheduledStartTime: startTime

          },

          status: {

            privacyStatus: privacyStatus,

            selfDeclaredMadeForKids: false

          },

          contentDetails: {

            enableAutoStart: true,

            enableAutoStop: true,

            enableDvr: true,

            recordFromStart: true

          }

        }

      });

    const broadcast =
      broadcastResponse.data;

    res.json({

      success: true,

      message:
        "YouTube broadcast created successfully",

      broadcast: {

        id:
          broadcast.id,

        title:
          broadcast.snippet?.title,

        description:
          broadcast.snippet?.description,

        scheduledStartTime:
          broadcast.snippet?.scheduledStartTime,

        privacyStatus:
          broadcast.status?.privacyStatus,

        lifeCycleStatus:
          broadcast.status?.lifeCycleStatus

      }

    });

  } catch (error) {

    console.error(
      "Create Broadcast Error:",
      error.response?.data ||
      error.message
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to create YouTube broadcast",

      error:
        error.response?.data ||
        error.message

    });

  }

});

// ==========================================
// BIND STREAM TO BROADCAST
// ==========================================

app.post("/api/live/bind",
async (req, res) => {

  try {

    const {

      broadcastId,

      streamId

    } = req.body;

    if (!broadcastId || !streamId) {

      return res.status(400).json({

        success: false,

        message:
          "broadcastId and streamId are required"

      });

    }

    const youtube =
      getYouTubeClient();

    const response =
      await youtube.liveBroadcasts.bind({

        id: broadcastId,

        part: [
          "id",
          "snippet",
          "contentDetails",
          "status"
        ],

        streamId: streamId

      });

    res.json({

      success: true,

      message:
        "Stream successfully connected to broadcast",

      broadcast:
        response.data

    });

  } catch (error) {

    console.error(
      "Bind Error:",
      error.response?.data ||
      error.message
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to bind stream",

      error:
        error.response?.data ||
        error.message

    });

  }

});

// ==========================================
// CREATE COMPLETE LIVE
// STREAM + BROADCAST + BIND
// ==========================================

app.post("/api/live/create",
async (req, res) => {

  try {

    const {

      title = "FLIZSTREAM Live",

      description =
        "Live streaming with FLIZSTREAM",

      privacyStatus = "public",

      scheduledStartTime

    } = req.body;

    const youtube =
      getYouTubeClient();

    // ======================================
    // CREATE STREAM
    // ======================================

    const streamResponse =
      await youtube.liveStreams.insert({

        part: [
          "snippet",
          "cdn",
          "status"
        ],

        requestBody: {

          snippet: {

            title:
              `${title} Stream`

          },

          cdn: {

            ingestionType: "rtmp",

            resolution: "variable",

            frameRate: "variable"

          }

        }

      });

    const stream =
      streamResponse.data;

    // ======================================
    // CREATE BROADCAST
    // ======================================

    const startTime =
      scheduledStartTime ||
      new Date(
        Date.now() + 2 * 60 * 1000
      ).toISOString();

    const broadcastResponse =
      await youtube.liveBroadcasts.insert({

        part: [
          "snippet",
          "contentDetails",
          "status"
        ],

        requestBody: {

          snippet: {

            title,

            description,

            scheduledStartTime:
              startTime

          },

          status: {

            privacyStatus,

            selfDeclaredMadeForKids:
              false

          },

          contentDetails: {

            enableAutoStart:
              true,

            enableAutoStop:
              true,

            enableDvr:
              true,

            recordFromStart:
              true

          }

        }

      });

    const broadcast =
      broadcastResponse.data;

    // ======================================
    // BIND STREAM
    // ======================================

    await youtube.liveBroadcasts.bind({

      id:
        broadcast.id,

      part: [
        "id",
        "snippet",
        "contentDetails",
        "status"
      ],

      streamId:
        stream.id

    });

    // ======================================
    // SUCCESS RESPONSE
    // ======================================

    const ingestionAddress =
      stream.cdn?.ingestionInfo?.ingestionAddress;

    const streamName =
      stream.cdn?.ingestionInfo?.streamName;

    res.json({

      success: true,

      message:
        "Complete YouTube Live created successfully!",

      broadcast: {

        id:
          broadcast.id,

        title:
          broadcast.snippet?.title,

        scheduledStartTime:
          broadcast.snippet?.scheduledStartTime,

        privacyStatus:
          broadcast.status?.privacyStatus

      },

      stream: {

        id:
          stream.id,

        title:
          stream.snippet?.title,

        rtmpServer:
          ingestionAddress,

        streamKey:
          streamName,

        rtmpUrl:
          `${ingestionAddress}/${streamName}`

      }

    });

  } catch (error) {

    console.error(
      "Complete Live Error:",
      error.response?.data ||
      error.message
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to create complete YouTube Live",

      error:
        error.response?.data ||
        error.message

    });

  }

});

// ==========================================
// LIST LIVE BROADCASTS
// ==========================================

app.get("/api/live/list",
async (req, res) => {

  try {

    const youtube =
      getYouTubeClient();

    const response =
      await youtube.liveBroadcasts.list({

        part: [
          "id",
          "snippet",
          "status",
          "contentDetails"
        ],

        mine: true,

        maxResults: 50

      });

    res.json({

      success: true,

      count:
        response.data.items?.length || 0,

      broadcasts:
        response.data.items || []

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({

      success: false,

      message:
        "Failed to get broadcasts",

      error:
        error.response?.data ||
        error.message

    });

  }

});

// ==========================================
// DELETE BROADCAST
// ==========================================

app.delete("/api/live/:id",
async (req, res) => {

  try {

    const youtube =
      getYouTubeClient();

    await youtube.liveBroadcasts.delete({

      id:
        req.params.id

    });

    res.json({

      success: true,

      message:
        "Broadcast deleted successfully"

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message:
        "Failed to delete broadcast",

      error:
        error.response?.data ||
        error.message

    });

  }

});

// ==========================================
// 404 ROUTE
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

});
