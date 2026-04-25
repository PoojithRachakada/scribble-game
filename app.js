const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_FIREBASE_AUTH_DOMAIN",
  databaseURL: "REPLACE_WITH_FIREBASE_DATABASE_URL",
  projectId: "REPLACE_WITH_FIREBASE_PROJECT_ID",
  storageBucket: "REPLACE_WITH_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_FIREBASE_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_FIREBASE_APP_ID"
};

const wordBank = [
  "Cat",
  "Sun",
  "Tree",
  "House",
  "Balloon",
  "Fish",
  "Rainbow",
  "Ice Cream",
  "Butterfly",
  "Car",
  "Apple",
  "Cloud"
];

const roundDurationSeconds = 60;
const maxStoredSegments = 5000;

const els = {
  playerName: document.getElementById("player-name"),
  roomId: document.getElementById("room-id"),
  createRoomBtn: document.getElementById("create-room-btn"),
  joinBtn: document.getElementById("join-btn"),
  leaveBtn: document.getElementById("leave-btn"),
  readyBtn: document.getElementById("ready-btn"),
  startBtn: document.getElementById("start-btn"),
  clearBtn: document.getElementById("clear-btn"),
  statusText: document.getElementById("status-text"),
  roomLabel: document.getElementById("room-label"),
  playersList: document.getElementById("players-list"),
  startHint: document.getElementById("start-hint"),
  promptWord: document.getElementById("prompt-word"),
  roundTimer: document.getElementById("round-timer"),
  phaseBadge: document.getElementById("phase-badge"),
  brushColor: document.getElementById("brush-color"),
  brushSize: document.getElementById("brush-size"),
  canvas: document.getElementById("scribble-canvas")
};

const ctx = els.canvas.getContext("2d");
ctx.lineCap = "round";
ctx.lineJoin = "round";

let firebaseApp = null;
let db = null;
let roomRef = null;
let roomUnsubscribe = null;
let playerId = "";
let currentRoomId = "";
let currentState = null;
let joinedName = "";
let isDrawing = false;
let lastPoint = null;
let timerInterval = null;

bootstrap();

async function bootstrap() {
  try {
    const [{ initializeApp }, databaseModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js")
    ]);

    const {
      getDatabase,
      ref,
      get,
      set,
      update,
      remove,
      onValue,
      onDisconnect
    } = databaseModule;

    firebaseApp = initializeApp(firebaseConfig);
    db = getDatabase(firebaseApp);

    const api = { ref, get, set, update, remove, onValue, onDisconnect };
    wireEvents(api);
    setStatus("Ready to connect. Add Firebase config first.");
    renderPlayers({});
    renderPhase("waiting");
  } catch (error) {
    console.error(error);
    setStatus("Firebase setup failed. Check app config in app.js.");
  }
}

function wireEvents(api) {
  els.createRoomBtn.addEventListener("click", () => {
    els.roomId.value = generateRoomCode();
  });

  els.joinBtn.addEventListener("click", () => {
    void joinRoom(api);
  });

  els.leaveBtn.addEventListener("click", () => {
    void leaveRoom(api, true);
  });

  els.readyBtn.addEventListener("click", () => {
    void toggleReady(api);
  });

  els.startBtn.addEventListener("click", () => {
    void startGame(api);
  });

  els.clearBtn.addEventListener("click", () => {
    void clearBoard(api);
  });

  attachCanvasEvents(api);
  window.addEventListener("beforeunload", () => {
    void leaveRoom(api, false);
  });
}

async function joinRoom(api) {
  const name = els.playerName.value.trim();
  const roomId = els.roomId.value.trim().toUpperCase();

  if (!name) {
    setStatus("Enter your name first.");
    return;
  }

  if (!roomId) {
    setStatus("Create or enter a room code.");
    return;
  }

  if (firebaseConfig.apiKey.startsWith("REPLACE_WITH")) {
    setStatus("Add your Firebase config in app.js before joining.");
    return;
  }

  if (currentRoomId && currentRoomId !== roomId) {
    await leaveRoom(api, false);
  }

  playerId = playerId || crypto.randomUUID();
  joinedName = name;
  currentRoomId = roomId;

  const roomRoot = api.ref(db, `rooms/${roomId}`);
  const playerRef = api.ref(db, `rooms/${roomId}/players/${playerId}`);
  roomRef = roomRoot;

  const roomSnapshot = await api.get(roomRoot);

  if (!roomSnapshot.exists()) {
    await api.set(roomRoot, {
      createdAt: Date.now(),
      phase: "lobby",
      roundEndsAt: null,
      currentWord: "",
      board: [],
      players: {}
    });
  }

  await api.update(playerRef, {
    id: playerId,
    name,
    ready: false,
    joinedAt: Date.now()
  });

  await api.onDisconnect(playerRef).remove();
  subscribeToRoom(api, roomRoot);
  setStatus(`Joined room ${roomId}.`);
}

function subscribeToRoom(api, roomRoot) {
  if (roomUnsubscribe) {
    roomUnsubscribe();
  }

  roomUnsubscribe = api.onValue(roomRoot, (snapshot) => {
    currentState = snapshot.val() || null;

    if (!currentState) {
      renderPlayers({});
      clearCanvas();
      renderPhase("waiting");
      return;
    }

    els.roomLabel.textContent = `Room: ${currentRoomId}`;
    renderPlayers(currentState.players || {});
    renderPhase(currentState.phase || "lobby");
    renderBoard((currentState.board || []).slice(-maxStoredSegments));
    syncTimer(currentState.roundEndsAt);
    updateControls();
  });
}

async function toggleReady(api) {
  if (!currentRoomId || !playerId) {
    setStatus("Join a room first.");
    return;
  }

  const player = currentState?.players?.[playerId];
  if (!player) {
    setStatus("Player not found in the room.");
    return;
  }

  await api.update(api.ref(db, `rooms/${currentRoomId}/players/${playerId}`), {
    ready: !player.ready
  });
}

async function startGame(api) {
  if (!currentRoomId || !currentState) {
    setStatus("Join a room first.");
    return;
  }

  const players = Object.values(currentState.players || {});
  if (players.length === 0) {
    setStatus("Need at least one player.");
    return;
  }

  const allReady = players.every((player) => player.ready);
  if (!allReady) {
    setStatus("All players must click ready first.");
    return;
  }

  const nextWord = wordBank[Math.floor(Math.random() * wordBank.length)];
  const roundEndsAt = Date.now() + roundDurationSeconds * 1000;
  const nextPlayers = Object.fromEntries(
    Object.entries(currentState.players || {}).map(([id, player]) => [
      id,
      { ...player, ready: false }
    ])
  );

  await api.update(api.ref(db, `rooms/${currentRoomId}`), {
    phase: "drawing",
    currentWord: nextWord,
    roundEndsAt,
    board: [],
    players: nextPlayers
  });

  setStatus("Game started.");
}

async function clearBoard(api) {
  if (!currentRoomId || currentState?.phase !== "drawing") {
    return;
  }

  await api.update(api.ref(db, `rooms/${currentRoomId}`), {
    board: []
  });
}

async function leaveRoom(api, clearLocalState) {
  if (!currentRoomId || !playerId) {
    return;
  }

  try {
    await api.remove(api.ref(db, `rooms/${currentRoomId}/players/${playerId}`));
  } catch (error) {
    console.warn("Could not remove player cleanly.", error);
  }

  if (roomUnsubscribe) {
    roomUnsubscribe();
    roomUnsubscribe = null;
  }

  if (clearLocalState) {
    currentRoomId = "";
    currentState = null;
    els.roomLabel.textContent = "Room: --";
    renderPlayers({});
    clearCanvas();
    renderPhase("waiting");
    setStatus("Left the room.");
  }
}

function attachCanvasEvents(api) {
  const beginStroke = (event) => {
    if (currentState?.phase !== "drawing") {
      return;
    }

    isDrawing = true;
    lastPoint = getCanvasPoint(event);
  };

  const moveStroke = (event) => {
    if (!isDrawing || !lastPoint || currentState?.phase !== "drawing") {
      return;
    }

    const point = getCanvasPoint(event);
    const segment = {
      x1: lastPoint.x,
      y1: lastPoint.y,
      x2: point.x,
      y2: point.y,
      color: els.brushColor.value,
      size: Number(els.brushSize.value),
      playerId,
      at: Date.now()
    };

    lastPoint = point;
    drawSegment(segment);
    void pushSegment(api, segment);
  };

  const endStroke = () => {
    isDrawing = false;
    lastPoint = null;
  };

  els.canvas.addEventListener("pointerdown", beginStroke);
  els.canvas.addEventListener("pointermove", moveStroke);
  els.canvas.addEventListener("pointerup", endStroke);
  els.canvas.addEventListener("pointerleave", endStroke);
}

async function pushSegment(api, segment) {
  if (!currentRoomId || !currentState) {
    return;
  }

  const board = [...(currentState.board || []), segment].slice(-maxStoredSegments);
  await api.update(api.ref(db, `rooms/${currentRoomId}`), { board });
}

function renderPlayers(playersMap) {
  const entries = Object.values(playersMap).sort((a, b) => a.joinedAt - b.joinedAt);

  els.playersList.innerHTML = "";

  if (entries.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No players yet.";
    els.playersList.appendChild(empty);
    return;
  }

  for (const player of entries) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const state = document.createElement("span");

    name.textContent = player.id === playerId ? `${player.name} (You)` : player.name;
    state.textContent = player.ready ? "Ready" : "Waiting";
    state.className = player.ready ? "player-ready" : "player-waiting";

    item.append(name, state);
    els.playersList.appendChild(item);
  }
}

function renderPhase(phase) {
  if (phase === "drawing") {
    els.phaseBadge.textContent = "Drawing";
    els.promptWord.textContent = currentState?.currentWord || "Draw!";
    els.startHint.textContent = "Draw together from different places in the same room.";
    return;
  }

  els.phaseBadge.textContent = "Lobby";
  els.promptWord.textContent = "Waiting for game start...";
  els.roundTimer.textContent = String(roundDurationSeconds);
  els.startHint.textContent = "Everyone joins, then each player clicks ready. Any player can start once all are ready.";
}

function renderBoard(segments) {
  clearCanvas();
  for (const segment of segments) {
    drawSegment(segment);
  }
}

function drawSegment(segment) {
  ctx.strokeStyle = segment.color;
  ctx.lineWidth = segment.size;
  ctx.beginPath();
  ctx.moveTo(segment.x1, segment.y1);
  ctx.lineTo(segment.x2, segment.y2);
  ctx.stroke();
}

function clearCanvas() {
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
}

function syncTimer(roundEndsAt) {
  window.clearInterval(timerInterval);

  if (!roundEndsAt) {
    els.roundTimer.textContent = String(roundDurationSeconds);
    return;
  }

  const updateTimer = () => {
    const remaining = Math.max(0, Math.ceil((roundEndsAt - Date.now()) / 1000));
    els.roundTimer.textContent = String(remaining);

    if (remaining <= 0) {
      window.clearInterval(timerInterval);
      finishRoundIfNeeded();
    }
  };

  updateTimer();
  timerInterval = window.setInterval(updateTimer, 500);
}

async function finishRoundIfNeeded() {
  if (!db || !currentRoomId || currentState?.phase !== "drawing") {
    return;
  }

  const roomPath = `rooms/${currentRoomId}`;
  const roomModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
  await roomModule.update(roomModule.ref(db, roomPath), {
    phase: "lobby",
    roundEndsAt: null
  });
}

function updateControls() {
  const players = Object.values(currentState?.players || {});
  const allReady = players.length > 0 && players.every((player) => player.ready);

  els.readyBtn.disabled = !currentRoomId || currentState?.phase === "drawing";
  els.startBtn.disabled = !allReady || currentState?.phase === "drawing";
  els.clearBtn.disabled = currentState?.phase !== "drawing";
}

function getCanvasPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  const scaleX = els.canvas.width / rect.width;
  const scaleY = els.canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Made with Bob
