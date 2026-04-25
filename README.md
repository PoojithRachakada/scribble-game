# Scribble Party

Scribble Party is a browser game designed in three play styles:

- **Single-device mode**: all players use the same phone, tablet, or laptop
- **Local two-window mode**: two browser windows on the same device separate drawer and guesser views
- **Future multi-device mode**: players use separate devices and will need a live backend later

## Current implementation

The current code in [`index.html`](scribble-game/index.html), [`styles.css`](scribble-game/styles.css), and [`app.js`](scribble-game/app.js:1) currently supports:

- Single-device mode
- Local two-window mode
- A visible multi-device placeholder in the UI

## Play modes

### 1. Single-device mode

Best for:
- parent and child on one tablet
- siblings sharing one laptop
- quick local play without setup

Flow:
1. Open [`index.html`](scribble-game/index.html)
2. Type player 1 name and join
3. Type player 2 name and join
4. Repeat for all players
5. Make everyone ready
6. Start the round
7. One player becomes the drawer
8. Drawer draws on the canvas
9. Other players guess on the same device

### 2. Local two-window mode

Best for:
- one laptop with two browser windows
- keeping the secret word hidden from guessers
- local play without a backend

How to use:
1. Open one browser window using [`index.html?view=drawer`](scribble-game/index.html)
2. Open another browser window using [`index.html?view=guesser`](scribble-game/index.html)
3. Use the same browser on the same device
4. Create room and join players
5. Start the round
6. Drawer window can draw and see the word
7. Guesser window can guess and cannot see the word
8. Both windows show guess feedback

Important:
- this works only on the same device and same browser storage
- it does not support different phones or different laptops

### 3. Future multi-device mode

This is only planned for later.

For true multi-device play, a backend will be required for:
- room state
- player list
- live drawing sync
- guesses
- score updates

Recommended later options:
- Firebase Realtime Database
- Supabase
- a small Node.js WebSocket server

## Why no shared JSON file for real multiplayer

A static shared JSON file on GitHub Pages cannot act like a live database.
Browsers can read static files, but they cannot safely update one shared file for all players in real time.

## Recommended usage now

Use locally for now:

- normal [`index.html`](scribble-game/index.html) for single-device play
- [`index.html?view=drawer`](scribble-game/index.html) for drawer window
- [`index.html?view=guesser`](scribble-game/index.html) for guesser window

This keeps the game simple for now.

---

## Hosting and database plan for later

This section is for future use, so you do not need to inspect the code again later.

### Current hosting capability

The current project can already be hosted as a static frontend later.

What that will support:
- single-device mode
- local two-window mode

What that will **not** support by itself:
- true multiplayer across different devices

For true multi-device play, a backend database is required.

---

## Database-backed hosting for future real multi-device play

If later you want players on different devices, you will need a database/backend.

### Best simple option: Firebase Realtime Database

This is the easiest future upgrade for:
- room creation
- player join/leave
- start state
- live drawing updates
- live guesses
- timer sync
- scores

### What you need later

You will need:
- a Firebase project
- a web app created inside Firebase
- Realtime Database enabled
- the Firebase web config added into [`app.js`](scribble-game/app.js:1)
- the current placeholder multi-device mode replaced with live database sync logic

### Firebase setup steps for later

#### Step 1: Create a Firebase project
1. Go to Firebase Console
2. Click **Create a project**
3. Give it a name
4. Finish the setup

#### Step 2: Create a web app
1. Open your Firebase project
2. Click **Add app**
3. Choose **Web**
4. Give it an app name
5. Register app

Firebase will show a config object like this:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

Save this for later.

#### Step 3: Enable Realtime Database
1. In Firebase Console, open **Realtime Database**
2. Click **Create Database**
3. Choose a region
4. Start in test mode for initial setup
5. Create database

#### Step 4: Plan database structure
A simple structure for this game later can be:

```json
{
  "rooms": {
    "ROOM123": {
      "phase": "drawing",
      "drawerId": "player-1",
      "currentWord": "Cat",
      "roundEndsAt": 1714032000000,
      "players": {
        "player-1": {
          "name": "Asha",
          "ready": true,
          "score": 2
        },
        "player-2": {
          "name": "Ravi",
          "ready": true,
          "score": 1
        }
      },
      "board": [],
      "lastGuess": "cat",
      "lastGuessPlayer": "Ravi",
      "lastGuessCorrect": true
    }
  }
}
```

#### Step 5: Add Firebase to the frontend
Later, update [`app.js`](scribble-game/app.js:1) to:
- import Firebase SDK
- initialize Firebase with your config
- store room state in database
- listen for live updates
- sync drawing and guesses across devices

#### Step 6: Host frontend separately later
Later, when you choose a hosting platform, keep this split:

- static hosting = frontend files
- Firebase Realtime Database = multiplayer backend

So the later architecture becomes:

- hosted frontend for [`index.html`](scribble-game/index.html), [`styles.css`](scribble-game/styles.css), and [`app.js`](scribble-game/app.js:1)
- Firebase Realtime Database for multiplayer state

---

## Future configuration checklist

When you come back later for true multi-device hosting, remember this checklist:

- [ ] Prepare static hosting for [`index.html`](scribble-game/index.html), [`styles.css`](scribble-game/styles.css), [`app.js`](scribble-game/app.js:1), and [`README.md`](scribble-game/README.md)
- [ ] Create Firebase project
- [ ] Create Firebase web app
- [ ] Enable Realtime Database
- [ ] Copy Firebase config
- [ ] Update [`app.js`](scribble-game/app.js:1) with Firebase logic
- [ ] Replace placeholder multi-device mode with live sync
- [ ] Test room join from two separate devices

## Quick reminder for future you

- current static hosting = single-device and two-window same-device use
- true different-device multiplayer = requires database/backend later
- the easiest future path is Firebase Realtime Database