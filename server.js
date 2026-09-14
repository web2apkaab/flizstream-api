const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());

// =====================================================
// GOOGLE OAUTH CONFIGURATION
// =====================================================

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

// =====================================================
// TEMPORARY MEMORY STORAGE
// =====================================================

// NOTE:
// यह अभी testing/demo के लिए है.
// Render restart होने पर data reset हो सकता है.

let connectedUser = null;

let streams = [];

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
    app: "FLIZSTREAM",
    version: "2.0.0",

    endpoints: {
      status: "/api/status",
      googleLogin: "/auth/youtube",
      account: "/api/account",
      channel: "/api/youtube/channel",
      createLive: "/api/youtube/live/create",
      streams: "/api/streams"
    }
  });
});

// =====================================================
// API STATUS
// =====================================================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: "online",
    message: "FLIZSTREAM API is working",
    googleConnected: connectedUser !== null,
    timestamp: new Date().toISOString()
  });
});

// =====================================================
// GOOGLE / YOUTUBE LOGIN
// =====================================================

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

    console.error("GOOGLE LOGIN ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to start Google authentication",
      error: error.message
    });

  }
});

// =====================================================
// GOOGLE / YOUTUBE CALLBACK
// =====================================================

app.get("/auth/youtube/callback", async (req, res) => {

  try {

    const code = req.query.code;

    const googleError = req.query.error;

    // =================================================
    // USER CANCELLED LOGIN
    // =================================================

    if (googleError) {

      return res.status(400).send(`
        <!DOCTYPE html>

        <html>

        <head>

          <meta name="viewport"
          content="width=device-width, initial-scale=1">

          <title>Authentication Failed</title>

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

              font-family: Arial, sans-serif;

              background: #111827;

              color: white;
            }

            .card {
              width: 90%;
              max-width: 500px;

              padding: 40px 25px;

              background: #1f2937;

              border-radius: 25px;

              text-align: center;
            }

            h1 {
              color: #ef4444;
            }

            button {
              padding: 14px 30px;

              border: none;

              border-radius: 12px;

              background: #ef4444;

              color: white;

              font-size: 16px;

              cursor: pointer;
            }

          </style>

        </head>

        <body>

          <div class="card">

            <h1>❌ Authentication Failed</h1>

            <p>You cancelled Google permission.</p>

            <br>

            <button
              onclick="window.location.href='/auth/youtube'"
            >
              Try Again
            </button>

          </div>

        </body>

        </html>
      `);

    }

    // =================================================
    // CHECK AUTHORIZATION CODE
    // =================================================

    if (!code) {

      return res.status(400).json({
        success: false,
        message: "Authorization code not received"
      });

    }

    // =================================================
    // GET GOOGLE TOKENS
    // =================================================

    const { tokens } =
      await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // =================================================
    // CREATE YOUTUBE CLIENT
    // =================================================

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    // =================================================
    // GET YOUTUBE CHANNEL
    // =================================================

    const channelResponse =
      await youtube.channels.list({

        part: [
          "snippet",
          "statistics",
          "status"
        ],

        mine: true

      });

    let channelData = null;

    if (
      channelResponse.data.items &&
      channelResponse.data.items.length > 0
    ) {

      const channel =
        channelResponse.data.items[0];

      channelData = {

        id: channel.id,

        title:
          channel.snippet?.title ||
          "Unknown Channel",

        description:
          channel.snippet?.description ||
          "",

        thumbnail:

          channel.snippet?.thumbnails?.high?.url ||

          channel.snippet?.thumbnails?.medium?.url ||

          channel.snippet?.thumbnails?.default?.url ||

          "",

        subscribers:
          channel.statistics?.subscriberCount ||
          "0",

        videos:
          channel.statistics?.videoCount ||
          "0",

        views:
          channel.statistics?.viewCount ||
          "0"

      };

    }

    // =================================================
    // SAVE CONNECTED USER
    // =================================================

    connectedUser = {

      connected: true,

      connectedAt:
        new Date().toISOString(),

      tokens: tokens,

      channel: channelData

    };

    console.log("==================================");
    console.log("GOOGLE ACCOUNT CONNECTED");
    console.log(
      "CHANNEL:",
      channelData?.title || "No channel found"
    );
    console.log("==================================");

    // =================================================
    // SUCCESS PAGE
    // =================================================

    const channelName =
      channelData?.title ||
      "Google Account";

    const channelImage =
      channelData?.thumbnail ||
      "";

    res.send(`
      <!DOCTYPE html>

      <html>

      <head>

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
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

            font-family:
              Arial,
              sans-serif;

            background:
              linear-gradient(
                135deg,
                #111827,
                #0f172a
              );

            color: white;

          }

          .card {

            width: 90%;

            max-width: 600px;

            padding: 50px 25px;

            text-align: center;

            background: #1f2937;

            border-radius: 25px;

            box-shadow:
              0 20px 60px
              rgba(0,0,0,0.5);

          }

          .icon {

            font-size: 70px;

          }

          h1 {

            color: #4ade80;

            font-size: 34px;

          }

          .profile {

            width: 100px;

            height: 100px;

            object-fit: cover;

            border-radius: 50%;

            border:
              4px solid #4ade80;

            margin: 20px auto;

          }

          .channel {

            font-size: 25px;

            font-weight: bold;

            margin: 15px 0;

          }

          .message {

            color: #cbd5e1;

            font-size: 18px;

            margin-top: 25px;

          }

          button {

            margin-top: 35px;

            padding:
              16px 45px;

            border: none;

            border-radius: 15px;

            font-size: 18px;

            color: white;

            background:
              linear-gradient(
                135deg,
                #ef4444,
                #dc2626
              );

            cursor: pointer;

          }

        </style>

      </head>

      <body>

        <div class="card">

          <div class="icon">✅</div>

          <h1>
            Successfully Connected!
          </h1>

          ${
            channelImage
              ? `
                <img
                  class="profile"
                  src="${channelImage}"
                  alt="Channel"
                >
              `
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
      "OAUTH CALLBACK ERROR:",
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

// =====================================================
// GET CONNECTED ACCOUNT
// =====================================================

app.get("/api/account", (req, res) => {

  if (!connectedUser) {

    return res.status(401).json({

      success: false,

      connected: false,

      message:
        "No Google account connected"

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

// =====================================================
// GET CONNECTED YOUTUBE CHANNEL
// =====================================================

app.get("/api/youtube/channel", async (req, res) => {

  try {

    if (!connectedUser) {

      return res.status(401).json({

        success: false,

        message:
          "Please connect your YouTube account first",

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
          "No YouTube channel found"

      });

    }

    const channel =
      response.data.items[0];

    res.json({

      success: true,

      message:
        "YouTube channel loaded successfully",

      channel: {

        id: channel.id,

        title:
          channel.snippet?.title,

        description:
          channel.snippet?.description,

        thumbnail:

          channel.snippet?.thumbnails?.high?.url ||

          channel.snippet?.thumbnails?.medium?.url ||

          channel.snippet?.thumbnails?.default?.url ||

          "",

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
      "CHANNEL ERROR:",
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

// =====================================================
// CREATE YOUTUBE LIVE
// =====================================================

app.post(
  "/api/youtube/live/create",
  async (req, res) => {

    try {

      // ===============================================
      // CHECK LOGIN
      // ===============================================

      if (!connectedUser) {

        return res.status(401).json({

          success: false,

          message:
            "Please connect your YouTube account first",

          loginUrl:
            "/auth/youtube"

        });

      }

      // ===============================================
      // GET REQUEST DATA
      // ===============================================

      const {

        title,

        description,

        privacyStatus,

        scheduledStartTime

      } = req.body;

      // ===============================================
      // VALIDATE TITLE
      // ===============================================

      if (!title) {

        return res.status(400).json({

          success: false,

          message:
            "Live stream title is required"

        });

      }

      // ===============================================
      // YOUTUBE CLIENT
      // ===============================================

      const youtube =
        google.youtube({

          version: "v3",

          auth: oauth2Client

        });

      // ===============================================
      // CREATE LIVE BROADCAST
      // ===============================================

      const startTime =

        scheduledStartTime ||

        new Date(
          Date.now() + 60000
        ).toISOString();

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
                description || "",

              scheduledStartTime:
                startTime

            },

            status: {

              privacyStatus:
                privacyStatus || "public"

            },

            contentDetails: {

              enableAutoStart: true,

              enableAutoStop: true,

              enableDvr: true

            }

          }

        });

      const broadcast =
        broadcastResponse.data;

      // ===============================================
      // CREATE LIVE STREAM
      // ===============================================

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
                `${title} - Stream`

            },

            cdn: {

              ingestionType:
                "rtmp",

              resolution:
                "variable",

              frameRate:
                "variable"

            }

          }

        });

      const liveStream =
        streamResponse.data;

      // ===============================================
      // BIND BROADCAST + STREAM
      // ===============================================

      await youtube.liveBroadcasts.bind({

        part: [
          "id",
          "snippet",
          "status",
          "contentDetails"
        ],

        id:
          broadcast.id,

        streamId:
          liveStream.id

      });

      // ===============================================
      // GET RTMP INFORMATION
      // ===============================================

      const ingestionInfo =
        liveStream.cdn?.ingestionInfo;

      const rtmpUrl =
        ingestionInfo?.ingestionAddress ||
        null;

      const streamKey =
        ingestionInfo?.streamName ||
        null;

      // ===============================================
      // CREATE LIVE OBJECT
      // ===============================================

      const newLive = {

        id:
          broadcast.id,

        streamId:
          liveStream.id,

        title:
          title,

        description:
          description || "",

        privacyStatus:
          privacyStatus || "public",

        status:
          broadcast.status?.lifeCycleStatus,

        scheduledStartTime:
          broadcast.snippet?.scheduledStartTime,

        rtmpUrl:
          rtmpUrl,

        streamKey:
          streamKey,

        watchUrl:
          `https://www.youtube.com/watch?v=${broadcast.id}`,

        createdAt:
          new Date().toISOString()

      };

      // ===============================================
      // SAVE TEMPORARILY
      // ===============================================

      streams.push(newLive);

      // ===============================================
      // SUCCESS RESPONSE
      // ===============================================

      res.status(201).json({

        success: true,

        message:
          "YouTube Live created successfully!",

        live: {

          broadcastId:
            broadcast.id,

          streamId:
            liveStream.id,

          title:
            title,

          description:
            description || "",

          privacyStatus:
            privacyStatus || "public",

          scheduledStartTime:
            broadcast.snippet?.scheduledStartTime,

          status:
            broadcast.status?.lifeCycleStatus,

          rtmpUrl:
            rtmpUrl,

          streamKey:
            streamKey,

          watchUrl:
            `https://www.youtube.com/watch?v=${broadcast.id}`

        }

      });

    } catch (error) {

      console.error(
        "CREATE LIVE ERROR:",
        error.response?.data || error.message
      );

      res.status(500).json({

        success: false,

        message:
          "Unable to create YouTube Live",

        error:
          error.response?.data?.error?.message ||
          error.message

      });

    }

  }
);

// =====================================================
// GET ALL CREATED STREAMS
// =====================================================

app.get("/api/streams", (req, res) => {

  res.json({

    success: true,

    totalStreams:
      streams.length,

    streams:
      streams

  });

});

// =====================================================
// GET SINGLE STREAM
// =====================================================

app.get("/api/streams/:id", (req, res) => {

  const stream =
    streams.find(

      item =>
        item.id === req.params.id

    );

  if (!stream) {

    return res.status(404).json({

      success: false,

      message:
        "Stream not found"

    });

  }

  res.json({

    success: true,

    stream: stream

  });

});

// =====================================================
// DELETE DEMO STREAM FROM MEMORY
// =====================================================

app.delete(
  "/api/streams/:id",
  (req, res) => {

    const index =
      streams.findIndex(

        item =>
          item.id === req.params.id

      );

    if (index === -1) {

      return res.status(404).json({

        success: false,

        message:
          "Stream not found"

      });

    }

    const deletedStream =
      streams.splice(index, 1);

    res.json({

      success: true,

      message:
        "Stream removed successfully",

      stream:
        deletedStream[0]

    });

  }
);

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {

  res.status(404).json({

    success: false,

    message:
      "Route not found",

    path:
      req.originalUrl

  });

});

// =====================================================
// START SERVER
// =====================================================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log("==================================");

  console.log(
    `FLIZSTREAM API running on port ${PORT}`
  );

  console.log(
    `Redirect URI: ${REDIRECT_URI}`
  );

  console.log("==================================");

});
