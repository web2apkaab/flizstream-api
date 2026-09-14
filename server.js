const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ==========================================
// GOOGLE OAUTH CONFIG
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
// TEMPORARY ACCOUNT STORAGE
// ==========================================

let connectedAccount = null;

// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
    endpoints: {
      status: "/api/status",
      login: "/auth/google",
      account: "/api/account",
      createLive: "POST /api/live/create",
      liveList: "GET /api/live/list",
      disconnect: "POST /api/disconnect"
    }
  });
});

// ==========================================
// STATUS
// ==========================================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: "online",
    app: "FLIZSTREAM"
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
        message: "Google Client ID or Secret missing in Render Environment"
      });
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,

      scope: [
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.force-ssl"
      ]
    });

    res.redirect(authUrl);

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Failed to start Google login",
      error: error.message
    });

  }
});

// ==========================================
// GOOGLE CALLBACK
// ==========================================

app.get("/auth/google/callback", async (req, res) => {

  try {

    if (req.query.error) {
      return res.status(400).json({
        success: false,
        message: "Google authentication failed",
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

    // GET TOKENS

    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // CREATE YOUTUBE CLIENT

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    // GET CHANNEL

    const channelResponse = await youtube.channels.list({
      part: [
        "snippet",
        "statistics",
        "contentDetails"
      ],
      mine: true
    });

    const channels = channelResponse.data.items;

    if (!channels || channels.length === 0) {

      return res.status(400).json({
        success: false,
        message: "No YouTube channel found for this Google account"
      });

    }

    const channel = channels[0];

    const channelId = channel.id;
    const channelName = channel.snippet.title;

    const thumbnail =
      channel.snippet.thumbnails?.high?.url ||
      channel.snippet.thumbnails?.medium?.url ||
      channel.snippet.thumbnails?.default?.url ||
      "";

    // SAVE ACCOUNT

    connectedAccount = {
      connected: true,

      channelId,
      channelName,
      thumbnail,

      tokens,

      connectedAt: new Date().toISOString()
    };

    // SUCCESS PAGE

    res.send(`
<!DOCTYPE html>
<html>
<head>

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>FLIZSTREAM Connected</title>

<style>

*{
box-sizing:border-box;
}

body{
margin:0;
min-height:100vh;
background:#08111f;
font-family:Arial,sans-serif;
display:flex;
justify-content:center;
align-items:center;
padding:20px;
color:white;
}

.card{
width:100%;
max-width:600px;
background:#2d394a;
border-radius:35px;
padding:45px 25px;
text-align:center;
}

.icon{
width:120px;
height:120px;
margin:auto;
border-radius:30px;
background:#63a52a;
display:flex;
align-items:center;
justify-content:center;
font-size:70px;
}

h1{
color:#63dc91;
font-size:42px;
margin:35px 0;
}

.profile{
width:140px;
height:140px;
border-radius:50%;
object-fit:cover;
margin:10px auto 25px;
}

.channel{
font-size:32px;
font-weight:bold;
margin-bottom:25px;
}

.message{
font-size:21px;
line-height:1.6;
color:#d0d6df;
}

.channelid{
margin-top:25px;
font-size:17px;
color:#bfc7d0;
word-break:break-all;
}

button{
margin-top:35px;
background:#ff3d43;
border:none;
color:white;
padding:20px 70px;
font-size:24px;
border-radius:20px;
}

</style>

</head>

<body>

<div class="card">

<div class="icon">✓</div>

<h1>Successfully Connected!</h1>

${thumbnail ? `<img class="profile" src="${thumbnail}">` : ""}

<div class="channel">${channelName}</div>

<div class="message">
Your Google and YouTube account has been connected successfully with FLIZSTREAM.
</div>

<div class="channelid">
Channel ID:<br>
${channelId}
</div>

<button onclick="window.close()">Close</button>

</div>

</body>
</html>
    `);

  } catch (error) {

    console.error(error.response?.data || error.message);

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
// GET CONNECTED ACCOUNT
// ==========================================

app.get("/api/account", (req, res) => {

  if (!connectedAccount) {
    return res.status(404).json({
      success: false,
      message: "No YouTube account connected"
    });
  }

  res.json({
    success: true,
    account: {
      connected: true,
      channelId: connectedAccount.channelId,
      channelName: connectedAccount.channelName,
      thumbnail: connectedAccount.thumbnail,
      connectedAt: connectedAccount.connectedAt
    }
  });

});

// ==========================================
// CHECK AUTHENTICATION
// ==========================================

function checkAuthentication(req, res, next) {

  if (!connectedAccount || !connectedAccount.tokens) {
    return res.status(401).json({
      success: false,
      message: "Please connect your YouTube account first"
    });
  }

  oauth2Client.setCredentials(
    connectedAccount.tokens
  );

  next();
}

// ==========================================
// CREATE YOUTUBE LIVE
// ==========================================

app.post(
  "/api/live/create",
  checkAuthentication,
  async (req, res) => {

    try {

      const {
        title,
        description,
        privacyStatus,
        scheduledStartTime,
        enableDvr,
        enableAutoStart,
        enableAutoStop
      } = req.body;

      // VALIDATION

      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Live title is required"
        });
      }

      // DEFAULT START TIME
      // Current time + 5 minutes

      let startTime;

      if (scheduledStartTime) {
        startTime = new Date(
          scheduledStartTime
        ).toISOString();
      } else {
        startTime = new Date(
          Date.now() + 5 * 60 * 1000
        ).toISOString();
      }

      const youtube = google.youtube({
        version: "v3",
        auth: oauth2Client
      });

      // =====================================
      // STEP 1: CREATE LIVE BROADCAST
      // =====================================

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
                privacyStatus || "public",

              selfDeclaredMadeForKids:
                false

            },

            contentDetails: {

              enableDvr:
                enableDvr !== false,

              enableAutoStart:
                enableAutoStart === true,

              enableAutoStop:
                enableAutoStop === true,

              enableEmbed:
                true,

              recordFromStart:
                true

            }

          }

        });

      const broadcast =
        broadcastResponse.data;

      // =====================================
      // STEP 2: CREATE LIVE STREAM
      // =====================================

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

      const stream =
        streamResponse.data;

      // =====================================
      // STEP 3: BIND STREAM TO BROADCAST
      // =====================================

      const bindResponse =
        await youtube.liveBroadcasts.bind({

          part: [
            "id",
            "snippet",
            "contentDetails",
            "status"
          ],

          id:
            broadcast.id,

          streamId:
            stream.id

        });

      // =====================================
      // GET STREAM DETAILS
      // =====================================

      const ingestionInfo =
        stream.cdn?.ingestionInfo;

      const streamName =
        ingestionInfo?.streamName;

      const ingestionAddress =
        ingestionInfo?.ingestionAddress;

      const backupAddress =
        ingestionInfo?.backupIngestionAddress;

      // =====================================
      // RESPONSE
      // =====================================

      res.json({

        success: true,

        message:
          "YouTube Live created successfully!",

        channel: {

          channelId:
            connectedAccount.channelId,

          channelName:
            connectedAccount.channelName

        },

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

          status:
            broadcast.status?.lifeCycleStatus

        },

        stream: {

          id:
            stream.id,

          title:
            stream.snippet?.title,

          status:
            stream.status?.streamStatus

        },

        rtmp: {

          server:
            ingestionAddress,

          streamKey:
            streamName,

          backupServer:
            backupAddress,

          fullUrl:
            ingestionAddress && streamName
              ? `${ingestionAddress}/${streamName}`
              : null

        },

        youtubeUrl:
          `https://www.youtube.com/watch?v=${broadcast.id}`,

        bind:
          bindResponse.data

      });

    } catch (error) {

      console.error(
        "CREATE LIVE ERROR:",
        error.response?.data || error.message
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to create YouTube Live",

        error:
          error.response?.data?.error?.message ||
          error.message

      });

    }

  }
);

// ==========================================
// LIST YOUTUBE LIVE BROADCASTS
// ==========================================

app.get(
  "/api/live/list",
  checkAuthentication,
  async (req, res) => {

    try {

      const youtube = google.youtube({
        version: "v3",
        auth: oauth2Client
      });

      const response =
        await youtube.liveBroadcasts.list({

          part: [
            "id",
            "snippet",
            "status",
            "contentDetails"
          ],

          mine: true,

          broadcastStatus:
            req.query.status || "all",

          maxResults:
            50

        });

      res.json({

        success: true,

        total:
          response.data.items?.length || 0,

        broadcasts:
          response.data.items || []

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          "Failed to get live broadcasts",

        error:
          error.response?.data?.error?.message ||
          error.message

      });

    }

  }
);

// ==========================================
// GET LIVE STREAM DETAILS
// ==========================================

app.get(
  "/api/live/:id",
  checkAuthentication,
  async (req, res) => {

    try {

      const youtube = google.youtube({
        version: "v3",
        auth: oauth2Client
      });

      const response =
        await youtube.liveBroadcasts.list({

          part: [
            "id",
            "snippet",
            "status",
            "contentDetails"
          ],

          id:
            req.params.id

        });

      const broadcast =
        response.data.items?.[0];

      if (!broadcast) {

        return res.status(404).json({

          success: false,

          message:
            "Live broadcast not found"

        });

      }

      res.json({

        success: true,

        broadcast

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          "Failed to get live details",

        error:
          error.response?.data?.error?.message ||
          error.message

      });

    }

  }
);

// ==========================================
// DELETE LIVE BROADCAST
// ==========================================

app.delete(
  "/api/live/:id",
  checkAuthentication,
  async (req, res) => {

    try {

      const youtube = google.youtube({
        version: "v3",
        auth: oauth2Client
      });

      await youtube.liveBroadcasts.delete({

        id:
          req.params.id

      });

      res.json({

        success: true,

        message:
          "Live broadcast deleted successfully"

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          "Failed to delete live broadcast",

        error:
          error.response?.data?.error?.message ||
          error.message

      });

    }

  }
);

// ==========================================
// DISCONNECT ACCOUNT
// ==========================================

app.post("/api/disconnect", (req, res) => {

  connectedAccount = null;

  oauth2Client.setCredentials({});

  res.json({

    success: true,

    message:
      "YouTube account disconnected successfully"

  });

});

// ==========================================
// 404
// ==========================================

app.use((req, res) => {

  res.status(404).json({

    success: false,

    message: "Route not found",

    path: req.originalUrl

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
