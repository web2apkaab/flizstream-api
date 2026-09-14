const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// =====================================
// GOOGLE OAUTH CONFIG
// =====================================

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

// =====================================
// TEMPORARY TOKEN STORAGE
// NOTE:
// Render restart होने पर यह memory clear हो जाएगी.
// बाद में database जोड़ेंगे.
// =====================================

let savedTokens = null;
let connectedUser = null;


// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FLIZSTREAM API is running successfully!",
    status: "online"
  });
});


// =====================================
// API STATUS
// =====================================

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: "online",
    googleConnected: !!savedTokens,
    user: connectedUser
  });
});


// =====================================
// GOOGLE / YOUTUBE LOGIN
// =====================================

app.get("/auth/google", (req, res) => {

  try {

    if (!CLIENT_ID || !CLIENT_SECRET) {

      return res.status(500).json({
        success: false,
        message: "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing"
      });

    }

    const authUrl = oauth2Client.generateAuthUrl({

      access_type: "offline",

      prompt: "consent",

      scope: [

        "https://www.googleapis.com/auth/youtube",

        "https://www.googleapis.com/auth/youtube.force-ssl",

        "https://www.googleapis.com/auth/userinfo.email",

        "https://www.googleapis.com/auth/userinfo.profile"

      ]

    });

    res.redirect(authUrl);

  } catch (error) {

    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to start Google authentication",
      error: error.message
    });

  }

});


// =====================================
// GOOGLE CALLBACK
// =====================================

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

    oauth2Client.setCredentials(tokens);

    savedTokens = tokens;


    // =====================================
    // GET GOOGLE USER INFO
    // =====================================

    const oauth2 = google.oauth2({
      version: "v2",
      auth: oauth2Client
    });

    const userResponse = await oauth2.userinfo.get();

    connectedUser = {
      email: userResponse.data.email,
      name: userResponse.data.name,
      picture: userResponse.data.picture
    };


    // =====================================
    // SUCCESS PAGE
    // =====================================

    res.send(`
<!DOCTYPE html>

<html>

<head>

<title>FLIZSTREAM Connected</title>

<meta name="viewport"
content="width=device-width, initial-scale=1">

<style>

*{
box-sizing:border-box;
}

body{

margin:0;

min-height:100vh;

font-family:Arial,sans-serif;

background:#111827;

display:flex;

align-items:center;

justify-content:center;

color:white;

padding:20px;

}

.card{

width:100%;

max-width:600px;

background:#263241;

border-radius:35px;

padding:50px 25px;

text-align:center;

box-shadow:
0 20px 60px rgba(0,0,0,.5);

}

.check{

width:110px;

height:110px;

margin:auto;

border-radius:25px;

background:#65a332;

display:flex;

align-items:center;

justify-content:center;

font-size:70px;

color:white;

}

h1{

color:#55d17a;

font-size:40px;

margin-top:35px;

}

h2{

font-size:28px;

}

.profile{

width:90px;

height:90px;

border-radius:50%;

object-fit:cover;

margin:20px;

}

p{

font-size:20px;

line-height:1.6;

color:#d1d5db;

}

button{

margin-top:25px;

background:#ff4141;

border:none;

color:white;

font-size:24px;

padding:18px 55px;

border-radius:20px;

cursor:pointer;

}

</style>

</head>

<body>

<div class="card">

<div class="check">✓</div>

<h1>Successfully Connected!</h1>

${connectedUser.picture
? `<img class="profile" src="${connectedUser.picture}">`
: ""}

<h2>${connectedUser.name || "Google User"}</h2>

<p>

Your Google and YouTube account has been connected successfully with FLIZSTREAM.

</p>

<p style="font-size:16px">

${connectedUser.email || ""}

</p>

<button onclick="window.close()">

Close

</button>

</div>

</body>

</html>
    `);

  } catch (error) {

    console.error("CALLBACK ERROR:", error);

    res.status(500).json({

      success: false,

      message: "Google authentication failed",

      error: error.message

    });

  }

});


// =====================================
// OLD YOUTUBE LOGIN ROUTE
// REDIRECT TO GOOGLE LOGIN
// =====================================

app.get("/auth/youtube", (req, res) => {

  res.redirect("/auth/google");

});


// =====================================
// OLD YOUTUBE CALLBACK SUPPORT
// =====================================

app.get("/auth/youtube/callback", async (req, res) => {

  res.redirect("/auth/google/callback");

});


// =====================================
// GET CONNECTED USER
// =====================================

app.get("/api/user", (req, res) => {

  if (!connectedUser) {

    return res.status(401).json({

      success: false,

      message: "No Google account connected"

    });

  }

  res.json({

    success: true,

    user: connectedUser

  });

});


// =====================================
// GET YOUTUBE CHANNEL
// =====================================

app.get("/api/youtube/channel", async (req, res) => {

  try {

    if (!savedTokens) {

      return res.status(401).json({

        success: false,

        message: "Please connect your Google account first"

      });

    }

    oauth2Client.setCredentials(savedTokens);

    const youtube = google.youtube({

      version: "v3",

      auth: oauth2Client

    });


    const response = await youtube.channels.list({

      part: [

        "snippet",

        "statistics",

        "contentDetails"

      ],

      mine: true

    });


    const channel = response.data.items[0];


    if (!channel) {

      return res.status(404).json({

        success: false,

        message: "No YouTube channel found on this Google account"

      });

    }


    res.json({

      success: true,

      channel: {

        id: channel.id,

        title: channel.snippet.title,

        description: channel.snippet.description,

        thumbnail:

          channel.snippet.thumbnails?.high?.url ||

          channel.snippet.thumbnails?.default?.url ||

          null,

        subscribers:

          channel.statistics.subscriberCount,

        videos:

          channel.statistics.videoCount,

        views:

          channel.statistics.viewCount

      }

    });

  } catch (error) {

    console.error("YOUTUBE CHANNEL ERROR:", error);

    res.status(500).json({

      success: false,

      message: "Unable to get YouTube channel",

      error: error.message

    });

  }

});


// =====================================
// LOGOUT
// =====================================

app.post("/api/logout", (req, res) => {

  savedTokens = null;

  connectedUser = null;

  oauth2Client.setCredentials({});

  res.json({

    success: true,

    message: "Logged out successfully"

  });

});


// =====================================
// 404 ROUTE
// =====================================

app.use((req, res) => {

  res.status(404).json({

    success: false,

    message: "Route not found",

    path: req.originalUrl

  });

});


// =====================================
// START SERVER
// =====================================

app.listen(PORT, () => {

  console.log(`FLIZSTREAM API running on port ${PORT}`);

});
