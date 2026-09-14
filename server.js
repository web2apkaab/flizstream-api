const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

// ==========================================
// BASIC CONFIGURATION
// ==========================================

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// GOOGLE / YOUTUBE OAUTH CONFIGURATION
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
// ==========================================

// NOTE:
// Render restart hone par ye data reset ho jayega.
// Production ke liye MongoDB / database use karna better hoga.

let streams = [];

let connectedYouTubeAccounts = [];

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
    message: "FLIZSTREAM Streaming API is working"
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
        message:
          "Google OAuth environment variables are missing. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Render."
      });
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",

      // Google se refresh token lene ke liye
      prompt: "consent",

      scope: [
        "openid",
        "email",
        "profile",

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

// पुराने URL को भी support करेंगे
app.get("/auth/youtube", (req, res) => {
  res.redirect("/auth/google");
});

// ==========================================
// GOOGLE CALLBACK
// ==========================================

app.get("/auth/google/callback", async (req, res) => {
  try {

    // अगर user ने Google login cancel किया
    if (req.query.error) {
      return res.status(400).json({
        success: false,
        message: "Google authentication cancelled",
        error: req.query.error
      });
    }

    const code = req.query.code;

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
    // GET GOOGLE USER INFORMATION
    // ==========================================

    const oauth2 = google.oauth2({
      version: "v2",
      auth: oauth2Client
    });

    const userInfo = await oauth2.userinfo.get();

    // ==========================================
    // GET YOUTUBE CHANNEL INFORMATION
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
          "statistics",
          "contentDetails"
        ],
        mine: true
      });

      if (
        channelResponse.data.items &&
        channelResponse.data.items.length > 0
      ) {
        channelData = channelResponse.data.items[0];
      }

    } catch (youtubeError) {
      console.error(
        "YouTube Channel Error:",
        youtubeError.message
      );
    }

    // ==========================================
    // SAVE CONNECTED ACCOUNT
    // ==========================================

    const account = {
      id: userInfo.data.id,

      email: userInfo.data.email,

      name: userInfo.data.name,

      picture: userInfo.data.picture,

      connectedAt: new Date().toISOString(),

      tokens: {
        access_token: tokens.access_token,

        refresh_token: tokens.refresh_token,

        expiry_date: tokens.expiry_date
      },

      youtubeChannel: channelData
        ? {
            id: channelData.id,

            title: channelData.snippet.title,

            description:
              channelData.snippet.description,

            subscribers:
              channelData.statistics.subscriberCount,

            videos:
              channelData.statistics.videoCount,

            views:
              channelData.statistics.viewCount
          }
        : null
    };

    // पुराने account को हटाकर नया update करें
    connectedYouTubeAccounts =
      connectedYouTubeAccounts.filter(
        item => item.email !== account.email
      );

    connectedYouTubeAccounts.push(account);

    console.log(
      "Google / YouTube Account Connected:",
      account.email
    );

    // ==========================================
    // SUCCESS PAGE
    // ==========================================

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>FLIZSTREAM - Connected</title>

        <meta name="viewport"
              content="width=device-width, initial-scale=1">

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
            max-width: 450px;
            padding: 30px;
            border-radius: 20px;
            background: #1f2937;
            text-align: center;
            box-shadow:
              0 10px 40px rgba(0,0,0,.5);
          }

          .success {
            font-size: 60px;
          }

          h1 {
            color: #22c55e;
          }

          p {
            color: #d1d5db;
            line-height: 1.6;
          }

          img {
            width: 70px;
            height: 70px;
            border-radius: 50%;
            margin: 10px;
          }

          .channel {
            margin-top: 20px;
            padding: 15px;
            background: #111827;
            border-radius: 12px;
          }

          button {
            margin-top: 20px;
            padding: 14px 25px;
            border: none;
            border-radius: 10px;
            background: #ef4444;
            color: white;
            font-size: 16px;
            cursor: pointer;
          }
        </style>

      </head>

      <body>

        <div class="card">

          <div class="success">✅</div>

          <h1>Successfully Connected!</h1>

          ${
            account.picture
              ? `<img src="${account.picture}" alt="Profile">`
              : ""
          }

          <p>
            <strong>${account.name || "Google User"}</strong>
          </p>

          <p>${account.email || ""}</p>

          ${
            account.youtubeChannel
              ? `
                <div class="channel">

                  <h3>
                    📺 ${account.youtubeChannel.title}
                  </h3>

                  <p>
                    Subscribers:
                    ${account.youtubeChannel.subscribers}
                  </p>

                  <p>
                    Videos:
                    ${account.youtubeChannel.videos}
                  </p>

                </div>
              `
              : `
                <p>
                  Google account connected successfully.
                </p>
              `
          }

          <button onclick="window.close()">
            Close
          </button>

        </div>

      </body>
      </html>
    `);

  } catch (error) {

    console.error(
      "Google Callback Error:",
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
// पुराने YouTube CALLBACK को भी support करें
// ==========================================

app.get("/auth/youtube/callback", async (req, res) => {
  res.redirect(
    "/auth/google/callback?" +
    new URLSearchParams(req.query).toString()
  );
});

// ==========================================
// GET CONNECTED ACCOUNTS
// ==========================================

app.get("/api/accounts", (req, res) => {
  const safeAccounts =
    connectedYouTubeAccounts.map(account => ({
      id: account.id,
      email: account.email,
      name: account.name,
      picture: account.picture,
      connectedAt: account.connectedAt,
      youtubeChannel: account.youtubeChannel
    }));

  res.json({
    success: true,
    count: safeAccounts.length,
    accounts: safeAccounts
  });
});

// ==========================================
// CREATE STREAM
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
      message: "Stream title is required"
    });
  }

  const stream = {
    id: Date.now().toString(),

    title,

    description:
      description || "",

    privacyStatus:
      privacyStatus || "public",

    status: "created",

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
    count: streams.length,
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
    stream: deletedStream[0]
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
