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
const sharedStateKey = "scribble-party-shared-state-v1";

const els = {
  playMode: document.getElementById("play-mode"),
  modeStatus: document.getElementById("mode-status"),
  playerName: document.getElementById("player-name"),
  roomId: document.getElementById("room-id"),
  createRoomBtn: document.getElementById("create-room-btn"),
  joinBtn: document.getElementById("join-btn"),
  leaveBtn: document.getElementById("leave-btn"),
  readyBtn: document.getElementById("ready-btn"),
  startBtn: document.getElementById("start-btn"),
  clearBtn: document.getElementById("clear-btn"),
  guessBtn: document.getElementById("guess-btn"),
  guessInput: document.getElementById("guess-input"),
  statusText: document.getElementById("status-text"),
  guessStatus: document.getElementById("guess-status"),
  guessFeed: document.getElementById("guess-feed"),
  roomLabel: document.getElementById("room-label"),
  playersList: document.getElementById("players-list"),
  startHint: document.getElementById("start-hint"),
  promptWord: document.getElementById("prompt-word"),
  drawerName: document.getElementById("drawer-name"),
  roundTimer: document.getElementById("round-timer"),
  phaseBadge: document.getElementById("phase-badge"),
  brushColor: document.getElementById("brush-color"),
  brushSize: document.getElementById("brush-size"),
  canvas: document.getElementById("scribble-canvas")
};

const ctx = els.canvas.getContext("2d");
ctx.lineCap = "round";
ctx.lineJoin = "round";

let gameState = loadSharedState();
let timerInterval = null;
let selectedPlayerId = "";
let isDrawing = false;
let lastPoint = null;
let viewRole = "";

bootstrap();

function bootstrap() {
  if (!validateElements()) {
    return;
  }

  wireEvents();
  syncViewRoleFromQuery();
  renderAll();
  setStatus("Single-device mode ready.");
  setGuessStatus("Only guessers can submit guesses.");
  setGuessFeed("No guesses yet.");
  updateModeUI();

  window.addEventListener("storage", function (event) {
    if (event.key === sharedStateKey && event.newValue) {
      gameState = parseSharedState(event.newValue);
      renderAll();
    }
  });
}

function validateElements() {
  const missing = Object.entries(els)
    .filter(function (entry) { return !entry[1]; })
    .map(function (entry) { return entry[0]; });

  if (missing.length > 0) {
    console.error("Missing UI elements:", missing);
    return false;
  }

  return true;
}

function wireEvents() {
  els.playMode.addEventListener("change", handleModeChange);
  els.createRoomBtn.addEventListener("click", handleCreateRoom);
  els.joinBtn.addEventListener("click", handleJoinPlayer);
  els.leaveBtn.addEventListener("click", handleLeavePlayer);
  els.readyBtn.addEventListener("click", handleToggleReady);
  els.startBtn.addEventListener("click", handleStartGame);
  els.clearBtn.addEventListener("click", handleClearBoard);
  els.guessBtn.addEventListener("click", handleGuessSubmit);
  els.guessInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      handleGuessSubmit();
    }
  });

  attachCanvasEvents();
}

function handleModeChange() {
  updateModeUI();

  if (els.playMode.value === "multi") {
    setStatus("Multi-device mode is a placeholder for now.");
    setGuessStatus("Enable a backend later to use this mode.");
    setGuessFeed("No guesses yet.");
    return;
  }

  setStatus("Single-device mode ready.");
  setGuessStatus("Only guessers can submit guesses.");
  setGuessFeed("No guesses yet.");
}

function handleCreateRoom() {
  if (isTwoWindowMode()) {
    gameState = createEmptyState();
    gameState.roomId = generateRoomCode();
    saveSharedState();
    setStatus("Two-window room created. Open one browser as drawer and another as guesser.");
    return;
  }

  els.roomId.value = generateRoomCode();
  setStatus("Room code created.");
}

function handleJoinPlayer() {
  if (els.playMode.value === "multi") {
    setStatus("Multi-device mode needs a backend and is not enabled yet.");
    return;
  }

  const name = els.playerName.value.trim();
  const roomId = els.roomId.value.trim().toUpperCase();

  if (!name) {
    setStatus("Enter a player name.");
    return;
  }

  if (!roomId) {
    setStatus("Create or type a room code.");
    return;
  }

  if (!gameState.roomId) {
    gameState.roomId = roomId;
  }

  if (gameState.roomId !== roomId) {
    setStatus("Use the same room code on this device.");
    return;
  }

  const existingPlayer = findPlayerByName(name);

  if (existingPlayer) {
    selectedPlayerId = existingPlayer.id;
    els.playerName.value = existingPlayer.name;
    existingPlayer.ready = true;
    saveSharedState();
    setStatus(existingPlayer.name + " selected and marked ready.");
    renderAll();
    return;
  }

  const playerId = createId();
  gameState.players[playerId] = {
    id: playerId,
    name: name,
    ready: false,
    joinedAt: Date.now(),
    score: 0
  };

  selectedPlayerId = playerId;
  gameState.players[playerId].ready = true;
  els.playerName.value = "";
  saveSharedState();
  setStatus(name + " joined room " + roomId + " and is ready.");
  renderAll();
}

function handleLeavePlayer() {
  if (!selectedPlayerId || !gameState.players[selectedPlayerId]) {
    setStatus("Select a player first.");
    return;
  }

  const leavingPlayerName = gameState.players[selectedPlayerId].name;
  const leavingPlayerId = selectedPlayerId;
  delete gameState.players[selectedPlayerId];

  const remainingPlayers = getPlayers();
  selectedPlayerId = remainingPlayers.length > 0 ? remainingPlayers[0].id : "";

  if (remainingPlayers.length === 0) {
    resetGame();
    setStatus(leavingPlayerName + " left. Room cleared.");
    return;
  }

  if (gameState.drawerId === leavingPlayerId && remainingPlayers.length > 0) {
    gameState.drawerId = remainingPlayers[0].id;
  }

  saveSharedState();
  setStatus(leavingPlayerName + " left the room.");
  renderAll();
}

function handleToggleReady() {
  if (!selectedPlayerId || !gameState.players[selectedPlayerId]) {
    setStatus("Join or select a player first.");
    return;
  }

  if (gameState.phase === "drawing") {
    setStatus("Wait until the round ends.");
    return;
  }

  const player = gameState.players[selectedPlayerId];
  player.ready = true;
  saveSharedState();
  setStatus(player.name + " is ready.");
  renderAll();
}

function handleStartGame() {
  if (els.playMode.value === "multi") {
    setStatus("Multi-device mode is not active yet.");
    return;
  }

  const players = getPlayers();

  if (players.length < 2) {
    setStatus("Add at least 2 players.");
    return;
  }

  if (!players.every(function (player) { return player.ready; })) {
    setStatus("All players must click ready first.");
    return;
  }

  const drawer = chooseNextDrawer(players);

  gameState.phase = "drawing";
  gameState.currentWord = randomWord();
  gameState.drawerId = drawer.id;
  gameState.roundEndsAt = Date.now() + roundDurationSeconds * 1000;
  gameState.board = [];
  gameState.winnerId = "";
  gameState.lastGuess = "";
  gameState.lastGuessPlayer = "";
  gameState.lastGuessCorrect = false;

  for (let i = 0; i < players.length; i += 1) {
    players[i].ready = false;
  }

  if (viewRole === "drawer") {
    selectedPlayerId = drawer.id;
  } else if (viewRole === "guesser") {
    selectedPlayerId = findFirstGuesserId();
  }

  clearCanvas();
  saveSharedState();
  startTimer();
  setStatus(drawer.name + " is drawing.");
  setGuessStatus("Guessers can now type guesses.");
  setGuessFeed("No guesses yet.");
  renderAll();
}

function handleClearBoard() {
  if (gameState.phase !== "drawing") {
    setStatus("Start the game first.");
    return;
  }

  if (!canCurrentViewDraw()) {
    setStatus("Only the drawer view can clear the board.");
    return;
  }

  gameState.board = [];
  clearCanvas();
  saveSharedState();
  setStatus("Board cleared.");
}

function handleGuessSubmit() {
  if (gameState.phase !== "drawing") {
    setGuessStatus("Start the game first.");
    return;
  }

  if (!canCurrentViewGuess()) {
    setGuessStatus("Only the guesser view can submit guesses.");
    return;
  }

  if (!selectedPlayerId || !gameState.players[selectedPlayerId]) {
    setGuessStatus("Select a guessing player first.");
    return;
  }

  if (gameState.players[selectedPlayerId].id === gameState.drawerId) {
    setGuessStatus("The drawer cannot guess.");
    return;
  }

  const guess = els.guessInput.value.trim();
  if (!guess) {
    setGuessStatus("Type a guess first.");
    return;
  }

  const player = gameState.players[selectedPlayerId];
  const isCorrect = normalizeText(guess) === normalizeText(gameState.currentWord);

  gameState.lastGuess = guess;
  gameState.lastGuessPlayer = player.name;
  gameState.lastGuessCorrect = isCorrect;

  if (isCorrect) {
    player.score = (player.score || 0) + 1;
    gameState.winnerId = player.id;
    saveSharedState();
    setGuessStatus(player.name + " guessed correctly ✓");
    setStatus(player.name + " wins this round.");
    setGuessFeed(player.name + " guessed \"" + guess + "\" ✓ Correct");
    els.guessInput.value = "";
    finishRound();
    return;
  }

  saveSharedState();
  setGuessStatus(player.name + " guessed \"" + guess + "\" ✗");
  setGuessFeed(player.name + " guessed \"" + guess + "\" ✗ Wrong");
  els.guessInput.value = "";
  renderAll();
}

function attachCanvasEvents() {
  els.canvas.addEventListener("pointerdown", function (event) {
    if (gameState.phase !== "drawing" || !canCurrentViewDraw()) {
      return;
    }

    isDrawing = true;
    lastPoint = getCanvasPoint(event);
  });

  els.canvas.addEventListener("pointermove", function (event) {
    if (!isDrawing || !lastPoint || gameState.phase !== "drawing" || !canCurrentViewDraw()) {
      return;
    }

    const point = getCanvasPoint(event);
    const segment = {
      x1: lastPoint.x,
      y1: lastPoint.y,
      x2: point.x,
      y2: point.y,
      color: els.brushColor.value,
      size: Number(els.brushSize.value)
    };

    gameState.board.push(segment);
    drawSegment(segment);
    lastPoint = point;
    saveSharedState();
  });

  function stopDrawing() {
    isDrawing = false;
    lastPoint = null;
  }

  els.canvas.addEventListener("pointerup", stopDrawing);
  els.canvas.addEventListener("pointerleave", stopDrawing);
  els.canvas.addEventListener("pointercancel", stopDrawing);
}

function renderAll() {
  ensureRoleSelection();
  renderPlayers();
  renderPhase();
  renderBoard();
  renderGuessFeed();
  updateControls();
  els.roomLabel.textContent = "Room: " + (gameState.roomId || "--");
}

function renderPlayers() {
  const players = getPlayers();
  els.playersList.innerHTML = "";

  if (players.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No players yet.";
    els.playersList.appendChild(emptyItem);
    return;
  }

  for (let i = 0; i < players.length; i += 1) {
    const player = players[i];
    const item = document.createElement("li");
    const nameButton = document.createElement("button");
    const state = document.createElement("span");

    nameButton.type = "button";
    nameButton.className = "player-select-btn secondary";

    let label = player.name;
    if (player.id === selectedPlayerId) {
      label += " (Current)";
    }
    if (player.id === gameState.drawerId) {
      label += " 🎨";
    }
    label += " - " + (player.score || 0);

    nameButton.textContent = label;
    nameButton.addEventListener("click", function () {
      if (isTwoWindowMode()) {
        if (viewRole === "drawer" && player.id !== gameState.drawerId) {
          setStatus("Drawer view always stays on the drawer.");
          return;
        }

        if (viewRole === "guesser" && player.id === gameState.drawerId) {
          setStatus("Guesser view cannot switch to the drawer.");
          return;
        }
      }

      selectedPlayerId = player.id;
      els.playerName.value = player.name;
      setStatus(player.name + " selected.");
      renderAll();
    });

    if (gameState.phase === "drawing" && player.id === gameState.drawerId) {
      state.textContent = "Drawing";
      state.className = "player-ready";
    } else {
      state.textContent = player.ready ? "Ready" : "Waiting";
      state.className = player.ready ? "player-ready" : "player-waiting";
    }

    item.appendChild(nameButton);
    item.appendChild(state);
    els.playersList.appendChild(item);
  }
}

function renderPhase() {
  if (gameState.phase === "drawing") {
    const drawer = gameState.players[gameState.drawerId];
    const secretVisible = isSecretWordVisible();

    els.phaseBadge.textContent = "Drawing";
    els.drawerName.textContent = drawer ? drawer.name : "Waiting...";
    els.promptWord.textContent = secretVisible ? gameState.currentWord : "Hidden from this view";
    els.startHint.textContent = buildRoundHint(secretVisible);
    return;
  }

  els.phaseBadge.textContent = "Lobby";
  els.drawerName.textContent = "Waiting...";
  els.promptWord.textContent = "Waiting for game start...";
  els.roundTimer.textContent = String(roundDurationSeconds);

  if (isTwoWindowMode()) {
    els.startHint.textContent = "Use one browser as Drawer View and another as Guesser View.";
    return;
  }

  els.startHint.textContent = "Add players, select each name, click ready, then start.";
}

function renderBoard() {
  clearCanvas();

  for (let i = 0; i < gameState.board.length; i += 1) {
    drawSegment(gameState.board[i]);
  }
}

function renderGuessFeed() {
  if (!gameState.lastGuessPlayer || !gameState.lastGuess) {
    setGuessFeed("No guesses yet.");
    return;
  }

  const resultText = gameState.lastGuessCorrect ? "✓ Correct" : "✗ Wrong";
  setGuessFeed(gameState.lastGuessPlayer + " guessed \"" + gameState.lastGuess + "\" " + resultText);
}

function updateControls() {
  const players = getPlayers();
  const allReady = players.length > 1 && players.every(function (player) { return player.ready; });
  const hasSelectedPlayer = Boolean(selectedPlayerId && gameState.players[selectedPlayerId]);
  const isMultiMode = els.playMode.value === "multi";
  const canDraw = canCurrentViewDraw();
  const canGuess = canCurrentViewGuess();

  els.readyBtn.disabled = isMultiMode || !hasSelectedPlayer || gameState.phase === "drawing";
  els.leaveBtn.disabled = isMultiMode || !hasSelectedPlayer;
  els.startBtn.disabled = isMultiMode || !allReady || gameState.phase === "drawing";
  els.clearBtn.disabled = isMultiMode || gameState.phase !== "drawing" || !canDraw;
  els.guessBtn.disabled = isMultiMode || gameState.phase !== "drawing" || !canGuess;
  els.guessInput.disabled = isMultiMode || gameState.phase !== "drawing" || !canGuess;
  els.brushColor.disabled = isMultiMode || gameState.phase !== "drawing" || !canDraw;
  els.brushSize.disabled = isMultiMode || gameState.phase !== "drawing" || !canDraw;
}

function startTimer() {
  window.clearInterval(timerInterval);

  function tick() {
    const remaining = Math.max(0, Math.ceil((gameState.roundEndsAt - Date.now()) / 1000));
    els.roundTimer.textContent = String(remaining);

    if (remaining <= 0) {
      finishRound();
    }
  }

  tick();
  timerInterval = window.setInterval(tick, 500);
}

function finishRound() {
  window.clearInterval(timerInterval);
  gameState.phase = "lobby";
  gameState.roundEndsAt = null;
  saveSharedState();
  setGuessStatus("Round ended. Get ready for the next turn.");
  renderAll();
}

function updateModeUI() {
  const isMultiMode = els.playMode.value === "multi";

  els.modeStatus.textContent = isMultiMode
    ? "Multi-device mode is visible, but not enabled yet."
    : "Single-device mode is active.";

  if (isTwoWindowMode()) {
    els.modeStatus.textContent = "Local two-window mode active. Use ?view=drawer and ?view=guesser.";
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

function setStatus(message) {
  els.statusText.textContent = message;
}

function setGuessStatus(message) {
  els.guessStatus.textContent = message;
}

function setGuessFeed(message) {
  els.guessFeed.textContent = message;
}

function getPlayers() {
  return Object.values(gameState.players).sort(function (a, b) {
    return a.joinedAt - b.joinedAt;
  });
}

function findPlayerByName(name) {
  const lowerName = name.toLowerCase();
  const players = getPlayers();

  for (let i = 0; i < players.length; i += 1) {
    if (players[i].name.toLowerCase() === lowerName) {
      return players[i];
    }
  }

  return null;
}

function chooseNextDrawer(players) {
  if (!gameState.drawerId) {
    return players[0];
  }

  let currentIndex = 0;
  for (let i = 0; i < players.length; i += 1) {
    if (players[i].id === gameState.drawerId) {
      currentIndex = i;
      break;
    }
  }

  return players[(currentIndex + 1) % players.length];
}

function findFirstGuesserId() {
  const players = getPlayers();

  for (let i = 0; i < players.length; i += 1) {
    if (players[i].id !== gameState.drawerId) {
      return players[i].id;
    }
  }

  return "";
}

function ensureRoleSelection() {
  if (!isTwoWindowMode() || gameState.phase !== "drawing") {
    return;
  }

  if (viewRole === "drawer") {
    selectedPlayerId = gameState.drawerId;
    return;
  }

  if (viewRole === "guesser" && (!selectedPlayerId || selectedPlayerId === gameState.drawerId)) {
    selectedPlayerId = findFirstGuesserId();
  }
}

function canCurrentViewDraw() {
  if (!isTwoWindowMode()) {
    return Boolean(selectedPlayerId) && selectedPlayerId === gameState.drawerId;
  }

  return viewRole === "drawer";
}

function canCurrentViewGuess() {
  if (!isTwoWindowMode()) {
    return Boolean(selectedPlayerId) && selectedPlayerId !== gameState.drawerId;
  }

  return viewRole === "guesser" && Boolean(selectedPlayerId) && selectedPlayerId !== gameState.drawerId;
}

function isTwoWindowMode() {
  return viewRole === "drawer" || viewRole === "guesser";
}

function isSecretWordVisible() {
  return canCurrentViewDraw();
}

function buildRoundHint(secretVisible) {
  if (isTwoWindowMode()) {
    return secretVisible
      ? "Drawer View: keep drawing and watch the guess feed below."
      : "Guesser View: secret word is hidden. Keep guessing and watch the result feed.";
  }

  return secretVisible
    ? "You are the drawer. Draw only, do not guess."
    : "You are a guesser. Watch the drawing and type your guess.";
}

function normalizeText(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function randomWord() {
  return wordBank[Math.floor(Math.random() * wordBank.length)];
}

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createId() {
  return "player-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
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

function createEmptyState() {
  return {
    roomId: "",
    phase: "lobby",
    currentWord: "",
    drawerId: "",
    winnerId: "",
    roundEndsAt: null,
    board: [],
    lastGuess: "",
    lastGuessPlayer: "",
    lastGuessCorrect: false,
    players: {}
  };
}

function resetGame() {
  gameState = createEmptyState();
  window.clearInterval(timerInterval);
  selectedPlayerId = "";
  els.guessInput.value = "";
  clearCanvas();
  saveSharedState();
  renderAll();
  setGuessStatus("Only guessers can submit guesses.");
  setGuessFeed("No guesses yet.");
}

function saveSharedState() {
  localStorage.setItem(sharedStateKey, JSON.stringify(gameState));
}

function loadSharedState() {
  const raw = localStorage.getItem(sharedStateKey);

  if (!raw) {
    return createEmptyState();
  }

  return parseSharedState(raw);
}

function parseSharedState(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Object.assign(createEmptyState(), parsed);
  } catch (error) {
    console.error("Could not parse shared game state.", error);
    return createEmptyState();
  }
}

function syncViewRoleFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const queryView = params.get("view");

  if (queryView === "drawer" || queryView === "guesser") {
    viewRole = queryView;
  }
}

// Made with Bob
