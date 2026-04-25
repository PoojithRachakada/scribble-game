# Scribble Party

Scribble Party is a simple browser game that you can host on GitHub Pages and play with family from different places.

## What it does

- Each person types a name and joins a shared room
- Every player clicks ready
- Any player can press start once everyone is ready
- A shared scribble board opens for all players in that room

## Files

- `index.html` - game layout
- `styles.css` - visual design
- `app.js` - multiplayer logic and drawing sync

## Important hosting note

GitHub Pages can host the website, but it cannot by itself provide real-time multiplayer storage.
For players in different places, this project uses **Firebase Realtime Database** as the shared backend.

## Setup

### 1. Create a Firebase project

In Firebase console:

- Create a new project
- Enable **Realtime Database**
- Start in test mode for quick setup
- In project settings, create a web app

### 2. Update Firebase config

Open `app.js` and replace this object:

```js
const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_FIREBASE_AUTH_DOMAIN",
  databaseURL: "REPLACE_WITH_FIREBASE_DATABASE_URL",
  projectId: "REPLACE_WITH_FIREBASE_PROJECT_ID",
  storageBucket: "REPLACE_WITH_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_FIREBASE_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_FIREBASE_APP_ID"
};
```

with your real Firebase config.

### 3. Upload to GitHub

Create a GitHub repository and place these files inside it:

- `index.html`
- `styles.css`
- `app.js`
- `README.md`

If you keep them in a folder, publish that folder's content correctly from your repo structure.

### 4. Enable GitHub Pages

In your GitHub repository:

- Go to **Settings**
- Open **Pages**
- Set source to your branch
- Choose the correct folder
- Save

GitHub will give you a public website URL.

## How to play

1. One person opens the site and clicks **Create room**
2. Share the room code with others
3. Everyone enters a name and joins the same room
4. Each player clicks **I am ready**
5. After all players are ready, anyone clicks **Start Game**
6. Everyone can draw on the same shared canvas

## Suggested next improvements

- Add turn-based drawing instead of everyone drawing at once
- Add guessing with chat
- Add score tracking
- Add child-friendly word categories
- Add room password protection

## Recommendation

For a child-friendly game, the next best version would be:

- one player draws
- others guess
- automatic turns
- points per correct guess

That would feel closer to a real Scribble game.