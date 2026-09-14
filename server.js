const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// CONFIGURATION
// ==========================================

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "https://flizstream-api.onrender.com/auth/google/callback";

// ==========================================
// GOOGLE OAUTH CLIENT
// ==========================================

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// ==========================================
// TEMPORARY TOKEN STORAGE
// NOTE:
// Render restart होने पर ये memory reset हो जाएगी.
// बाद में database जोड़ सकते हैं.
// ==========================================

let savedTokens = null;
let connectedChannel = null;

// ==========================================
// YOUTUBE CLIENT FUNCTION
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
// HOME
// ==========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
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
    youtubeConnected: !!savedTokens
  });
});

// ==========================================
// GOOGLE / YOUTUBE LOGIN
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

    console.error("OAuth Error:", error);

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

    const code = req.query.code;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code not received"
      });
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    savedTokens = tokens;

    oauth2Client.setCredentials(tokens);

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
        "status",
        "contentDetails"
      ],
      mine: true
    });

    const channels = channelResponse.data.items || [];

    if (channels.length === 0) {

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>FLIZSTREAM</title>

          <style>

            body {
              margin: 0;
              background: #111827;
              color: white;
              font-family: Arial;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
            }

            .card {
              background: #293548;
              padding: 40px;
              border-radius: 25px;
              text-align: center;
              max-width: 500px;
            }

            h1 {
              color: #ff5252;
            }

            button {
              padding: 15px 35px;
              border: none;
              border-radius: 15px;
              background: #ff3d3d;
              color: white;
              font-size: 18px;
              cursor: pointer;
            }

          </style>

        </head>

        <body>

          <div class="card">

            <h1>⚠️ No YouTube Channel Found</h1>

            <p>
              Google account connected successfully,
              but no YouTube channel was found.
            </p>

            <button onclick="window.close()">
              Close
            </button>

          </div>

        </body>
        </html>
      `);
    }

    const channel = channels[0];

    connectedChannel = {

      id: channel.id,

      title: channel.snippet?.title || "YouTube Channel",

      description:
        channel.snippet?.description || "",

      thumbnail:
        channel.snippet?.thumbnails?.high?.url ||
        channel.snippet?.thumbnails?.default?.url ||
        "",

      subscribers:
        channel.statistics?.subscriberCount || "0",

      videos:
        channel.statistics?.videoCount || "0"

    };

    // ==========================================
    // SUCCESS PAGE
    // ==========================================

    res.send(`
<!DOCTYPE html>

<html>

<head>

<title>FLIZSTREAM Connected</title>

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

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
    #07111f,
    #111827
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

  background: #334155;

  border-radius: 35px;

  padding: 45px 25px;

  text-align: center;

  box-shadow:
  0 20px 70px rgba(0,0,0,.5);

}

.check {

  width: 120px;

  height: 120px;

  margin: auto;

  border-radius: 30px;

  background: #65a30d;

  display: flex;

  align-items: center;

  justify-content: center;

  font-size: 70px;

}

h1 {

  color: #5ee38b;

  font-size: 42px;

  margin-top: 35px;

}

.channel-image {

  width: 130px;

  height: 130px;

  border-radius: 50%;

  object-fit: cover;

  margin-top: 25px;

}

.channel-name {

  font-size: 32px;

  font-weight: bold;

  margin-top: 20px;

}

.message {

  font-size: 22px;

  color: #d1d5db;

  line-height: 1.6;

  margin-top: 30px;

}

.channel-id {

  margin-top: 30px;

  font-size: 18px;

  color: #cbd5e1;

  word-break: break-all;

}

button {

  margin-top: 40px;

  padding: 18px 65px;

  border: none;

  border-radius: 22px;

  background: #ff4040;

  color: white;

  font-size: 25px;

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
Successfully<br>
Connected!
</h1>

${
connectedChannel.thumbnail
? `
<img
class="channel-image"
src="${connectedChannel.thumbnail}"
>
`
: ""
}

<div class="channel-name">

${connectedChannel.title}

</div>

<div class="message">

Your Google and YouTube account<br>

has been connected successfully with

<b>FLIZSTREAM.</b>

</div>

<div class="channel-id">

Channel ID:<br>

${connectedChannel.id}

</div>

<button onclick="window.close()">

Close

</button>

</div>

</body>

</html>
    `);

  } catch (error) {

    console.error("Callback Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to connect YouTube account",
      error:
        error.response?.data?.error?.message ||
        error.message
    });

  }

});

// ==========================================
// OLD CALLBACK SUPPORT
// ==========================================

app.get("/auth/youtube/callback", (req, res) => {

  const query = new URLSearchParams(req.query).toString();

  res.redirect(
    "/auth/google/callback?" + query
  );

});

// ==========================================
// CONNECTED CHANNEL DETAILS
// ==========================================

app.get("/api/channel", async (req, res) => {

  try {

    if (!connectedChannel) {

      return res.status(401).json({
        success: false,
        message: "No YouTube channel connected"
      });

    }

    res.json({
      success: true,
      channel: connectedChannel
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

// ==========================================
// CREATE LIVE STREAM
// ==========================================

app.post("/api/live/create", async (req, res) => {

  try {

    const {
      title,
      description,
      privacyStatus,
      resolution,
      frameRate
    } = req.body;

    if (!title) {

      return res.status(400).json({
        success: false,
        message: "Stream title is required"
      });

    }

    const youtube = getYouTubeClient();

    // ==========================================
    // CREATE LIVE STREAM
    // ==========================================

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

            description:
              description || "Live stream created using FLIZSTREAM"

          },

          cdn: {

            frameRate:
              frameRate || "30fps",

            ingestionType:
              "rtmp",

            resolution:
              resolution || "720p"

          },

          contentDetails: {

            isReusable: true

          }

        }

      });

    const stream = streamResponse.data;

    // ==========================================
    // CREATE LIVE BROADCAST
    // ==========================================

    const startTime =
      new Date(Date.now() + 60 * 1000).toISOString();

    const broadcastResponse =
      await youtube.liveBroadcasts.insert({

        part: [
          "snippet",
          "status",
          "contentDetails"
        ],

        requestBody: {

          snippet: {

            title: title,

            description:
              description ||
              "Live stream created using FLIZSTREAM",

            scheduledStartTime:
              startTime

          },

          status: {

            privacyStatus:
              privacyStatus || "public",

            selfDeclaredMadeForKids:
              false

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

    // ==========================================
    // BIND STREAM TO BROADCAST
    // ==========================================

    await youtube.liveBroadcasts.bind({

      part: [
        "id",
        "snippet",
        "contentDetails",
        "status"
      ],

      id: broadcast.id,

      streamId: stream.id

    });

    // ==========================================
    // RESPONSE
    // ==========================================

    const ingestionInfo =
      stream.cdn?.ingestionInfo || {};

    res.json({

      success: true,

      message:
        "YouTube Live Stream created successfully",

      channel:
        connectedChannel,

      broadcast: {

        id:
          broadcast.id,

        title:
          broadcast.snippet?.title,

        status:
          broadcast.status?.lifeCycleStatus,

        privacy:
          broadcast.status?.privacyStatus,

        scheduledStartTime:
          broadcast.snippet?.scheduledStartTime

      },

      stream: {

        id:
          stream.id,

        title:
          stream.snippet?.title,

        streamStatus:
          stream.status?.streamStatus,

        resolution:
          stream.cdn?.resolution,

        frameRate:
          stream.cdn?.frameRate

      },

      rtmp: {

        ingestionAddress:
          ingestionInfo.ingestionAddress ||

          "",

        streamName:
          ingestionInfo.streamName ||

          "",

        backupIngestionAddress:
          ingestionInfo.backupIngestionAddress ||

          "",

        // Complete RTMP URL

        rtmpUrl:

          ingestionInfo.ingestionAddress &&

          ingestionInfo.streamName

          ?

          ingestionInfo.ingestionAddress +

          "/" +

          ingestionInfo.streamName

          :

          ""

      }

    });

  } catch (error) {

    console.error(
      "Create Live Error:",
      error.response?.data || error
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to create YouTube Live Stream",

      error:

        error.response?.data?.error?.message ||

        error.message

    });

  }

});

// ==========================================
// LIST LIVE STREAMS
// ==========================================

app.get("/api/live/streams", async (req, res) => {

  try {

    const youtube =
      getYouTubeClient();

    const response =
      await youtube.liveStreams.list({

        part: [
          "snippet",
          "cdn",
          "status"
        ],

        mine: true,

        maxResults: 50

      });

    res.json({

      success: true,

      streams:
        response.data.items || []

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message:
        "Failed to get streams",

      error:

        error.response?.data?.error?.message ||

        error.message

    });

  }

});

// ==========================================
// LIST LIVE BROADCASTS
// ==========================================

app.get("/api/live/broadcasts", async (req, res) => {

  try {

    const youtube =
      getYouTubeClient();

    const response =
      await youtube.liveBroadcasts.list({

        part: [
          "snippet",
          "status",
          "contentDetails"
        ],

        mine: true,

        maxResults: 50,

        broadcastStatus:
          "all"

      });

    res.json({

      success: true,

      broadcasts:
        response.data.items || []

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message:
        "Failed to get broadcasts",

      error:

        error.response?.data?.error?.message ||

        error.message

    });

  }

});

// ==========================================
// GET SPECIFIC BROADCAST
// ==========================================

app.get(
  "/api/live/broadcast/:id",

  async (req, res) => {

    try {

      const youtube =
        getYouTubeClient();

      const response =
        await youtube.liveBroadcasts.list({

          part: [
            "snippet",
            "status",
            "contentDetails"
          ],

          id:
            req.params.id

        });

      res.json({

        success: true,

        broadcast:
          response.data.items?.[0] || null

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  }

);

// ==========================================
// END LIVE BROADCAST
// ==========================================

app.post(
  "/api/live/end/:id",

  async (req, res) => {

    try {

      const youtube =
        getYouTubeClient();

      const broadcastId =
        req.params.id;

      const response =
        await youtube.liveBroadcasts.transition({

          part: [
            "snippet",
            "status"
          ],

          broadcastStatus:
            "complete",

          id:
            broadcastId

        });

      res.json({

        success: true,

        message:
          "Live broadcast ended successfully",

        broadcast:
          response.data

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          "Failed to end broadcast",

        error:

          error.response?.data?.error?.message ||

          error.message

      });

    }

  }

);

// ==========================================
// 404 HANDLER
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
