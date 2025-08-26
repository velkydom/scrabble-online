# Scrabble-online (Slovak) — ready-to-deploy

This is a minimal 2-player Scrabble implementation (Slovak letters) using Node.js + Express + Socket.IO.

## What is included
- `server.js` — Node.js server managing rooms, state and scoring
- `public/index.html` — client interface (open in a browser)
- `package.json` — dependencies and start script
- `.gitignore`

## Run locally
1. `npm install`
2. `npm start`
3. Open `http://localhost:3000` in two browsers (or share your host after deploy).
4. Enter same Room ID in both clients.

## Deploy to Render (recommended)
1. Create GitHub repo and push these files.
2. Create a Render account and connect GitHub.
3. New -> Web Service -> choose repo -> Branch `main` -> Start command: `npm start`.
4. Deploy. After deploy you will get a public URL — open it and share the URL + Room ID with your friend.

Notes:
- No dictionary validation is included (players agree on allowed words).
- If you want me to deploy to Render for you, give me the GitHub repo URL or push and share it and I will provide specific deploy steps.
