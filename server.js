const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

// =====================================
// MIDDLEWARE
// =====================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================
// CONFIGURATION
// =====================================

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// IMPORTANT:
// Google Cloud Console me bhi EXACT yehi URL hona chahiye

const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "https://flizstream-api.onrender.com/auth/google/callback";

// =====================================
// OAUTH CLIENT
// =====================================

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// =====================================
// TEMPORARY STORAGE
// =====================================

let connectedAccount = null;

let streams = [];

// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {

  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
    status: "online",

    endpoints: {

      status: "/api/status",

      googleLogin: "/auth/google",

      youtubeLogin: "/auth/youtube",

      connectedAccount: "/api/account",

      streams: "/api/streams"

    }

  });

});

// =====================================
// API STATUS
// =====================================

app.get("/api/status", (req, res) => {

  res.json({

    success: true,

    status: "online",

    app: "FLIZSTREAM",

    message: "FLIZSTREAM API is working successfully!"

  });

});

// =====================================
// GOOGLE LOGIN
// =====================================

app.get("/auth/google", (req, res) => {

  try {

    if (!CLIENT_ID || !CLIENT_SECRET) {

      return res.status(500).json({

        success: false,

        message:
          "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in Render Environment Variables"

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

    console.error("Google Login Error:", error);

    res.status(500).json({

      success: false,

      message: "Unable to start Google authentication",

      error: error.message

    });

  }

});

// =====================================
// YOUTUBE LOGIN
// =====================================

app.get("/auth/youtube", (req, res) => {

  try {

    if (!CLIENT_ID || !CLIENT_SECRET) {

      return res.status(500).json({

        success: false,

        message:
          "Google OAuth Environment Variables are missing"

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

    console.error(error);

    res.status(500).json({

      success: false,

      message: "Unable to start YouTube authentication",

      error: error.message

    });

  }

});

// =====================================
// GOOGLE CALLBACK
// =====================================

app.get("/auth/google/callback", async (req, res) => {

  try {

    // Google Error Check

    if (req.query.error) {

      return res.status(400).send(`
      
      <!DOCTYPE html>

      <html>

      <head>

      <title>Authentication Failed</title>

      <style>

      body {
        background:#08111f;
        color:white;
        font-family:Arial;
        display:flex;
        justify-content:center;
        align-items:center;
        height:100vh;
        margin:0;
      }

      .card {
        background:#243042;
        padding:40px;
        border-radius:25px;
        text-align:center;
        max-width:500px;
      }

      h1 {
        color:#ff5252;
      }

      </style>

      </head>

      <body>

      <div class="card">

      <h1>Authentication Failed</h1>

      <p>${req.query.error}</p>

      </div>

      </body>

      </html>

      `);

    }

    // Authorization Code

    const code = req.query.code;

    if (!code) {

      return res.status(400).json({

        success: false,

        message: "Authorization code not received"

      });

    }

    // Get Tokens

    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // =====================================
    // YOUTUBE API
    // =====================================

    const youtube = google.youtube({

      version: "v3",

      auth: oauth2Client

    });

    // =====================================
    // GET CONNECTED CHANNEL
    // =====================================

    const channelResponse =
      await youtube.channels.list({

        part: [

          "snippet",

          "statistics",

          "contentDetails"

        ],

        mine: true

      });

    const channels = channelResponse.data.items;

    // =====================================
    // NO CHANNEL FOUND
    // =====================================

    if (!channels || channels.length === 0) {

      connectedAccount = {

        connected: true,

        channelFound: false,

        tokens: tokens,

        connectedAt: new Date().toISOString()

      };

      return res.send(`

      <!DOCTYPE html>

      <html>

      <head>

      <meta name="viewport"
      content="width=device-width, initial-scale=1.0">

      <title>Connected Successfully</title>

      <style>

      * {
        box-sizing:border-box;
      }

      body {

        margin:0;

        min-height:100vh;

        background:#08111f;

        font-family:Arial, sans-serif;

        display:flex;

        justify-content:center;

        align-items:center;

        color:white;

        padding:20px;

      }

      .card {

        width:100%;

        max-width:600px;

        background:#2b3748;

        border-radius:30px;

        padding:50px 25px;

        text-align:center;

      }

      .icon {

        width:120px;

        height:120px;

        background:#64a52a;

        border-radius:25px;

        display:flex;

        justify-content:center;

        align-items:center;

        font-size:70px;

        margin:auto;

      }

      h1 {

        color:#5bdd88;

        font-size:42px;

        margin-top:35px;

      }

      p {

        color:#d0d6df;

        font-size:20px;

        line-height:1.6;

      }

      button {

        margin-top:30px;

        border:none;

        padding:20px 55px;

        border-radius:20px;

        font-size:22px;

        background:#ff3d42;

        color:white;

      }

      </style>

      </head>

      <body>

      <div class="card">

      <div class="icon">✓</div>

      <h1>Successfully Connected!</h1>

      <p>

      Your Google account has been connected successfully with FLIZSTREAM.

      </p>

      <button onclick="window.close()">

      Close

      </button>

      </div>

      </body>

      </html>

      `);

    }

    // =====================================
    // CHANNEL DETAILS
    // =====================================

    const channel = channels[0];

    const channelId = channel.id;

    const channelName =
      channel.snippet.title;

    const description =
      channel.snippet.description || "";

    const thumbnail =
      channel.snippet.thumbnails?.high?.url ||
      channel.snippet.thumbnails?.medium?.url ||
      channel.snippet.thumbnails?.default?.url ||
      "";

    // =====================================
    // SAVE ACCOUNT TEMPORARILY
    // =====================================

    connectedAccount = {

      connected: true,

      channelFound: true,

      channelId: channelId,

      channelName: channelName,

      description: description,

      thumbnail: thumbnail,

      statistics: channel.statistics,

      tokens: tokens,

      connectedAt: new Date().toISOString()

    };

    // =====================================
    // SUCCESS PAGE
    // =====================================

    res.send(`

    <!DOCTYPE html>

    <html>

    <head>

    <meta name="viewport"
    content="width=device-width, initial-scale=1.0">

    <title>FLIZSTREAM Connected</title>

    <style>

    * {

      box-sizing:border-box;

    }

    body {

      margin:0;

      min-height:100vh;

      background:#08111f;

      font-family:Arial, sans-serif;

      display:flex;

      justify-content:center;

      align-items:center;

      padding:20px;

      color:white;

    }

    .card {

      width:100%;

      max-width:620px;

      background:#2d394a;

      border-radius:35px;

      padding:45px 25px;

      text-align:center;

      box-shadow:
      0 10px 40px rgba(0,0,0,0.4);

    }

    .success-icon {

      width:120px;

      height:120px;

      background:#63a52a;

      border-radius:30px;

      display:flex;

      align-items:center;

      justify-content:center;

      font-size:70px;

      margin:auto;

    }

    h1 {

      color:#63dc91;

      font-size:42px;

      margin:35px 0;

    }

    .profile {

      width:150px;

      height:150px;

      border-radius:50%;

      object-fit:cover;

      margin:10px auto 25px;

      display:block;

      background:#555;

    }

    .channel {

      font-size:32px;

      font-weight:bold;

      margin-bottom:25px;

    }

    .message {

      color:#d1d7df;

      font-size:21px;

      line-height:1.6;

    }

    .channel-id {

      margin-top:30px;

      color:#bfc7d0;

      font-size:18px;

      word-break:break-all;

    }

    button {

      margin-top:35px;

      background:#ff3d43;

      border:none;

      color:white;

      padding:20px 70px;

      font-size:25px;

      border-radius:22px;

      cursor:pointer;

    }

    </style>

    </head>

    <body>

    <div class="card">

    <div class="success-icon">

    ✓

    </div>

    <h1>

    Successfully Connected!

    </h1>

    ${thumbnail
      ? `<img class="profile" src="${thumbnail}" />`
      : ""
    }

    <div class="channel">

    ${channelName}

    </div>

    <div class="message">

    Your Google and YouTube account has been connected successfully with FLIZSTREAM.

    </div>

    <div class="channel-id">

    Channel ID:<br>

    ${channelId}

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
      "YouTube Connection Error:",
      error.response?.data || error.message
    );

    res.status(500).json({

      success: false,

      message: "Failed to connect YouTube account",

      error:
        error.response?.data?.error?.message ||
        error.message

    });

  }

});

// =====================================
// YOUTUBE CALLBACK
// =====================================

// IMPORTANT:
// This redirects to the main Google callback

app.get("/auth/youtube/callback", (req, res) => {

  const queryString =
    new URLSearchParams(req.query).toString();

  res.redirect(
    `/auth/google/callback?${queryString}`
  );

});

// =====================================
// GET CONNECTED ACCOUNT
// =====================================

app.get("/api/account", (req, res) => {

  if (!connectedAccount) {

    return res.status(404).json({

      success: false,

      message: "No Google/YouTube account connected"

    });

  }

  res.json({

    success: true,

    account: {

      connected:
        connectedAccount.connected,

      channelFound:
        connectedAccount.channelFound,

      channelId:
        connectedAccount.channelId,

      channelName:
        connectedAccount.channelName,

      thumbnail:
        connectedAccount.thumbnail,

      connectedAt:
        connectedAccount.connectedAt

    }

  });

});

// =====================================
// DISCONNECT ACCOUNT
// =====================================

app.post("/api/disconnect", async (req, res) => {

  try {

    connectedAccount = null;

    oauth2Client.setCredentials({});

    res.json({

      success: true,

      message:
        "Google and YouTube account disconnected successfully"

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message:
        "Failed to disconnect account"

    });

  }

});

// =====================================
// CREATE STREAM
// =====================================

app.post("/api/streams", (req, res) => {

  const {

    title,

    description,

    streamKey,

    platform

  } = req.body;

  if (!title) {

    return res.status(400).json({

      success: false,

      message: "Stream title is required"

    });

  }

  const newStream = {

    id: Date.now().toString(),

    title:

      title,

    description:

      description || "",

    streamKey:

      streamKey || "",

    platform:

      platform || "YouTube",

    status:

      "created",

    createdAt:

      new Date().toISOString()

  };

  streams.push(newStream);

  res.json({

    success: true,

    message:
      "Stream created successfully",

    stream:

      newStream

  });

});

// =====================================
// GET ALL STREAMS
// =====================================

app.get("/api/streams", (req, res) => {

  res.json({

    success: true,

    total:

      streams.length,

    streams:

      streams

  });

});

// =====================================
// GET SINGLE STREAM
// =====================================

app.get("/api/streams/:id", (req, res) => {

  const stream =
    streams.find(

      item => item.id === req.params.id

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

    stream:

      stream

  });

});

// =====================================
// UPDATE STREAM
// =====================================

app.put("/api/streams/:id", (req, res) => {

  const index =
    streams.findIndex(

      item => item.id === req.params.id

    );

  if (index === -1) {

    return res.status(404).json({

      success: false,

      message:
        "Stream not found"

    });

  }

  streams[index] = {

    ...streams[index],

    ...req.body,

    updatedAt:
      new Date().toISOString()

  };

  res.json({

    success: true,

    message:
      "Stream updated successfully",

    stream:
      streams[index]

  });

});

// =====================================
// DELETE STREAM
// =====================================

app.delete("/api/streams/:id", (req, res) => {

  const index =
    streams.findIndex(

      item => item.id === req.params.id

    );

  if (index === -1) {

    return res.status(404).json({

      success: false,

      message:
        "Stream not found"

    });

  }

  const deletedStream =
    streams[index];

  streams.splice(index, 1);

  res.json({

    success: true,

    message:
      "Stream deleted successfully",

    stream:
      deletedStream

  });

});

// =====================================
// 404 ROUTE
// =====================================

app.use((req, res) => {

  res.status(404).json({

    success: false,

    message:
      "Route not found",

    path:
      req.originalUrl

  });

});

// =====================================
// START SERVER
// =====================================

app.listen(PORT, () => {

  console.log(
    `FLIZSTREAM API running on port ${PORT}`
  );

});
