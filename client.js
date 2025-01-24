let peer = null;
let conn = null;
let isHost = false;
let isDrawer = false;
let isDrawing = false;
let words = [];
let wordsByCategory = {};
let currentWord = null;
let recentColors = ['#000000'];
const maxRecentColors = 8;
const recentColorsContainer = document.getElementById('recent-colors');
let username = '';

let isFillMode = false;
let isEraserMode = false;
let wordChoiceTimeLeft = 0;
let wordChoiceTimer = null;
let wordSelectionTimer = null;
const WORD_SELECTION_TIME = 15;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const guessInput = document.getElementById('guess-input');
const wordDisplay = document.getElementById('word-display');
const chat = document.getElementById('chat');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const joinInput = document.getElementById('joinInput');
const gameCode = document.getElementById('gameCode');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const brushSizeValue = document.getElementById('brushSizeValue');
const usernameInput = document.getElementById('usernameInput');
const usernameBtn = document.getElementById('usernameBtn');
const usernamePanel = document.getElementById('username-panel');
const connectionPanel = document.getElementById('connection-panel');

const fillBtn = document.getElementById('fillBtn');
const clearBtn = document.getElementById('clearBtn');
const eraserBtn = document.getElementById('eraserBtn');

let undoStack = [];
let redoStack = [];
let currentPath = [];
let isUndoRedoing = false;

const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

undoBtn.onclick = undo;
redoBtn.onclick = redo;

createBtn.onclick = createGame;
joinBtn.onclick = joinGame;

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

brushSize.addEventListener('input', () => {
    brushSizeValue.textContent = brushSize.value;
});

colorPicker.addEventListener('change', () => updateRecentColors(colorPicker.value));

const colorPalettes = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

function displayColorPalette() {
    const paletteContainer = document.getElementById('color-palette');
    paletteContainer.innerHTML = '';
    
    colorPalettes.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'w-8 h-8 hand-drawn cursor-pointer hover:scale-110 transition-transform';
        swatch.style.backgroundColor = color;
        swatch.title = color;
        swatch.onclick = () => {
            colorPicker.value = color;
            updateRecentColors(color);
        };
        paletteContainer.appendChild(swatch);
    });
}

function containsWord(message, word) {
    if (!word) return false;
    const messageWords = message.toLowerCase().split(/\W+/);
    const targetWord = word.toLowerCase();
    return messageWords.includes(targetWord);
}

guessInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const guess = guessInput.value.trim();
        if (!guess || !roundInProgress || isSpectator) {
            if (isSpectator) {
                addChatMessage('<span class="text-red-600"><i class="fas fa-exclamation-circle"></i> Spectators cannot make guesses until the next round.</span>');
            }
            guessInput.value = '';
            return;
        }

        if (isDrawer) {
            if (containsWord(guess, currentWord)) {
                addChatMessage('<span class="text-red-600"><i class="fas fa-exclamation-circle"></i> You cannot reveal the word!</span>');
            } else {
                addChatMessage(`${username}: ${guess}`);
                sendData({
                    type: 'chat_message',
                    username: username,
                    message: guess
                });
            }
        } else {
            if (isHost) {
                if (guess.toLowerCase() === currentWord.toLowerCase()) {
                    endCurrentRound('guess', { username, guesser: players.get(username) });
                } else {
                    addChatMessage(`${username}: ${guess}`);
                    sendData({
                        type: 'chat_message',
                        username: username,
                        message: guess
                    });
                }
            } else {
                addChatMessage(`${username}: ${guess}`);
                sendData({
                    type: 'guess',
                    guess: guess,
                    username: username
                });
            }
        }
        guessInput.value = '';
    }
});

usernameBtn.onclick = () => {
    if (usernameInput.value.trim()) {
        username = usernameInput.value.trim();
        usernamePanel.classList.add('hidden');
        connectionPanel.classList.remove('hidden');
    }
};

fillBtn.onclick = toggleFillMode;
clearBtn.onclick = clearCanvas;
eraserBtn.onclick = toggleEraserMode;

function updateStatus(message) {
    addChatMessage(`<i class="fas fa-info-circle text-blue-500"></i> ${message}`);
}

function generateGameCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

let connections = new Map();
let hasAnyoneGuessed = false;
let roundStartTime = Date.now();
let roundInProgress = false;
let isSpectator = false;

function createGame() {
    isHost = true;
    const gameId = generateGameCode();
    
    peer = new Peer(gameId, {
        config: {
            'iceServers': [
                {
                    urls: "stun:stun.relay.metered.ca:80",
                },
                {
                    urls: "turn:global.relay.metered.ca:80",
                    username: "aa4c11e375ec6112aaec44e8",
                    credential: "L6YD9q3C07uyeaBB",
                },
                {
                    urls: "turn:global.relay.metered.ca:80?transport=tcp",
                    username: "aa4c11e375ec6112aaec44e8",
                    credential: "L6YD9q3C07uyeaBB",
                },
                {
                    urls: "turn:global.relay.metered.ca:443",
                    username: "aa4c11e375ec6112aaec44e8",
                    credential: "L6YD9q3C07uyeaBB",
                },
                {
                    urls: "turns:global.relay.metered.ca:443?transport=tcp",
                    username: "aa4c11e375ec6112aaec44e8",
                    credential: "L6YD9q3C07uyeaBB",
                },
            ]
        },
        debug: 3
    });

    peer.on('open', () => {
        const codeElement = gameCode.querySelector('.bg-white');
        codeElement.textContent = gameId;
        const copyBtn = gameCode.querySelector('button');
        copyBtn.onclick = () => copyGameCode(gameId);
        gameCode.classList.remove('hidden');
        updateStatus('Waiting for player to join...');
    });
    
    peer.on('connection', (connection) => {
        const connId = connection.peer;
        connections.set(connId, connection);
        setupConnection(connection);
        
        connection.on('open', () => {
            connection.send({
                type: 'game_state',
                players: Array.from(players.entries()),
                settings: gameSettings,
                currentDrawer: currentDrawer,
                currentWord: currentWord,
                roundNumber: roundNumber,
                gameInProgress: roundInProgress,
                gamePhase: gamePhase,
                timerData: roundTimer || transitionTimer ? {
                    phase: gamePhase,
                    timeLeft: currentTimeLeft,
                    serverTime: Date.now()
                } : null
            });
        });
    });
}

function joinGame() {
    const gameId = joinInput.value;
    if (!gameId) return;
    
    peer = new Peer({
        config: {
            'iceServers': [
                {
                    urls: "stun:stun.relay.metered.ca:80",
                },
                {
                    urls: "turn:global.relay.metered.ca:80",
                    username: "aa4c11e375ec6112aaec44e8",
                    credential: "L6YD9q3C07uyeaBB",
                },
                {
                    urls: "turn:global.relay.metered.ca:80?transport=tcp",
                    username: "aa4c11e375ec6112aaec44e8",
                    credential: "L6YD9q3C07uyeaBB",
                },
                {
                    urls: "turn:global.relay.metered.ca:443",
                    username: "aa4c11e375ec6112aaec44e8",
                    credential: "L6YD9q3C07uyeaBB",
                },
                {
                    urls: "turns:global.relay.metered.ca:443?transport=tcp",
                    username: "aa4c11e375ec6112aaec44e8",
                    credential: "L6YD9q3C07uyeaBB",
                },
            ]
        },
        debug: 3
    });

    peer.on('open', () => {
        conn = peer.connect(gameId);
        setupConnection(conn);
    });
}

function sendData(data) {
    if (isHost) {
        connections.forEach(conn => {
            if (conn.open) conn.send(data);
        });
    } else if (conn && conn.open) {
        conn.send(data);
    }
}

function setupConnection(connection) {
    connection.on('open', () => {
        sendData({
            type: 'user_info',
            username: username,
            isHost: isHost
        });
        updateStatus('Connected!');
        
        if (gamePhase === 'waiting') {
            initializeLobby();
        }
        
        if (!isHost) {
            sendData({
                type: 'request_sync',
                joinTime: Date.now()
            });
        }
        
        if (isHost && isDrawer) {
            connection.send({
                type: 'canvas_state',
                state: canvas.toDataURL()
            });
        }

        if (isHost && roundTimer) {
            sendData({
                type: 'timer_sync',
                phase: roundTimer ? 'round' : 'transition',
                timeLeft: parseInt(timerDisplay?.textContent.match(/\d+/)[0] || 0)
            });
        }

        if (isHost && gamePhase !== 'waiting') {
            sendData({
                type: 'timer_sync',
                phase: gamePhase,
                timeLeft: currentTimeLeft,
                serverTime: Date.now()
            });
        }
    });
    
    connection.on('data', handleMessage);
    
    connection.on('close', () => {
        if (players.has(username)) {
            players.delete(username);
            updatePlayerList();
            updateStatus('Disconnected from game');
        }
    });
}

function handleMessage(data) {
    switch(data.type) {
        case 'drawing':
            if (!isDrawer) {
                drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
                if (isHost && gameRecording.currentRound) {
                    recordAction({
                        type: 'draw',
                        x0: data.x0,
                        y0: data.y0,
                        x1: data.x1,
                        y1: data.y1,
                        color: data.color,
                        size: data.size
                    });
                }
                if (isHost) {
                    sendData(data);
                }
            }
            break;
        case 'user_info':
            players.set(data.username, { ready: false, score: 0, isSpectator: roundInProgress });
            addChatMessage(`${data.username} joined the game!`);
            updatePlayerList();
            updateScoreDisplay();
            
            if (isHost) {
                if (gamePhase === 'waiting') {
                    initializeLobby();
                }
                sendData({
                    type: 'player_sync',
                    players: Array.from(players.entries())
                });
            }
            break;
        case 'guess':
            if (isHost && roundInProgress) {
                if (data.guess.toLowerCase() === currentWord.toLowerCase()) {
                    const guesser = players.get(data.username);
                    endCurrentRound('guess', { username: data.username, guesser });
                } else {
                    addChatMessage(`${data.username}: ${data.guess}`);
                    sendData({
                        type: 'chat_message',
                        username: data.username,
                        message: data.guess
                    });
                }
            }
            break;
        
        case 'chat_message':
            if (data.username !== username) {
                addChatMessage(`${data.username}: ${data.message}`);
            }
            if (isHost) {
                sendData(data);
            }
            break;
        
        case 'correct_guess':
            players = new Map(data.scores);
            updateScoreDisplay();
            addChatMessage(`<span class="text-green-600"><i class="fas fa-check-circle"></i> ${data.username} guessed the word!</span>`);
            if (isHost) {
                const serverTime = Date.now();
                startTransitionTimer(TRANSITION_TIME, serverTime);
                sendData({
                    type: 'timer_sync',
                    phase: 'transition',
                    timeLeft: TRANSITION_TIME,
                    serverTime: serverTime
                });
            }
            break;
        case 'new_round':
            if (gameRecording.currentRound) {
                gameRecording.rounds.push(gameRecording.currentRound);
            }
            
            gameRecording.currentRound = {
                roundNumber: data.roundNumber,
                drawer: data.drawer,
                word: null,
                startTime: Date.now(),
                actions: []
            };
            
            if (isSpectator) {
                isSpectator = false;
                const player = players.get(username);
                if (player) {
                    player.isSpectator = false;
                    addChatMessage(`<span class="text-green-600"><i class="fas fa-user-plus"></i> You are now an active player!</span>`);
                }
            }
            currentDrawer = data.drawer;
            isDrawer = currentDrawer === username;
            if (isDrawer) {
                showWordSelectionModal(getRandomWords(3));
            } else {
                wordDisplay.textContent = 'Guess the word!';
            }
            roundNumber = data.roundNumber;
            hasAnyoneGuessed = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            updateScoreDisplay();
            updateDrawingControls();
            break;
        case 'fill':
            if (!isDrawer) {
                floodFill(data.x, data.y, data.color);
                if (isHost) {
                    sendData(data);
                }
            }
            break;
        case 'canvas_state':
            if (!isDrawer) {
                const img = new Image();
                img.src = data.state;
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    if (isHost) {
                        sendData(data);
                    }
                };
            }
            break;
        case 'clear_canvas':
            if (!isDrawer) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                if (isHost && gameRecording.currentRound) {
                    recordAction({
                        type: 'clear'
                    });
                }
                if (isHost) {
                    sendData(data);
                }
            }
            break;
        case 'player_ready':
            const readyPlayer = players.get(data.username);
            if (readyPlayer) {
                readyPlayer.ready = data.ready;
                if (isHost) {
                    sendData({
                        type: 'player_sync',
                        players: Array.from(players.entries())
                    });
                }
                updatePlayerList();
            }
            break;
        case 'game_settings':
            if (!isHost) {
                gameSettings = data.settings;
                document.getElementById('rounds').value = gameSettings.rounds;
                document.getElementById('drawTime').value = gameSettings.drawTime;
                document.getElementById('customWords').value = gameSettings.customWords.join(',');
                words = gameSettings.customWords.length > 0 ? 
                    gameSettings.customWords : 
                    ['dog', 'cat', 'house', 'tree', 'car', 'sun', 'moon', 'book'];
            }
            break;
        case 'start_game':
            document.getElementById('lobby-panel').classList.add('hidden');
            document.getElementById('container').classList.remove('hidden');
            document.getElementById('container').style.display = 'flex';
            startGame(false);
            break;
        case 'player_sync':
            const oldPlayers = new Map(players);
            players = new Map(data.players);
            
            if (!isHost) {
                const localPlayer = oldPlayers.get(username);
                const syncedPlayer = players.get(username);
                if (localPlayer && syncedPlayer) {
                    syncedPlayer.ready = localPlayer.ready;
                }
            }
            
            updatePlayerList();
            updateScoreDisplay();
            break;
        case 'player_disconnect':
            if (players.has(data.username)) {
                players.delete(data.username);
                addChatMessage(`${data.username} left the game`);
                updatePlayerList();
            }
            break;
        case 'game_state':
            if (!isHost) {
                players = new Map(data.players);
                gameSettings = data.settings;
                currentDrawer = data.currentDrawer;
                currentWord = data.currentWord;
                roundNumber = data.roundNumber;
                gamePhase = data.gamePhase;
                gameRecording.expectedTotalRounds = data.expectedTotalRounds; 
                
                if (data.gameInProgress) {
                    document.getElementById('lobby-panel').classList.add('hidden');
                    document.getElementById('container').classList.remove('hidden');
                    document.getElementById('container').style.display = 'flex';
                    
                    if (!players.has(username)) {
                        isSpectator = true;
                        players.set(username, { 
                            ready: true, 
                            score: 0, 
                            isSpectator: true 
                        });
                        addChatMessage(`<span class="text-blue-600"><i class="fas fa-eye"></i> You joined as a spectator and will be able to play starting next round.</span>`);
                        
                        if (data.currentWord) {
                            wordDisplay.textContent = 'Guess the word!';
                        }
                        
                        if (data.timerData) {
                            clearTimers();
                            if (data.timerData.phase === 'round') {
                                startRoundTimer(data.timerData.timeLeft, data.timerData.serverTime);
                            } else if (data.timerData.phase === 'transition') {
                                startTransitionTimer(data.timerData.timeLeft, data.timerData.serverTime);
                            }
                        }
                    }
                } else {
                    initializeLobby();
                }
                
                updatePlayerList();
                updateScoreDisplay();
                isDrawer = currentDrawer === username;
                updateDrawingControls();
            }
            break;
        case 'request_sync':
            if (isHost) {
                sendData({
                    type: 'player_sync',
                    players: Array.from(players.entries())
                });
            }
            break;
        case 'game_end':
            if (gameRecording.currentRound) {
                gameRecording.rounds.push(gameRecording.currentRound);
            }
            displayGameEnd(data.winner, data.finalScores);
            break;
        case 'time_up':
            clearTimers();
            gamePhase = 'transition';
            addChatMessage(`<span class="text-red-600"><i class="fas fa-clock"></i> Time's up! The word was: ${data.word}</span>`);
            startTransitionTimer(TRANSITION_TIME, data.serverTime);
            if (isHost) {
                sendData(data);
            }
            break;
        case 'timer_sync':
            clearTimers();
            if (data.phase === 'round') {
                startRoundTimer(data.timeLeft, data.serverTime);
            } else if (data.phase === 'transition') {
                startTransitionTimer(data.timeLeft, data.serverTime);
            }
            gamePhase = data.phase;
            break;
        case 'selecting_word':
            if (!isDrawer) {
                wordDisplay.textContent = `${data.username} is choosing a word...`;
                clearTimers();
                startWordSelectionTimer();
                if (isHost) {
                    sendData(data);
                }
            }
            break;
        case 'word_selected':
            if (!isDrawer) {
                currentWord = data.word;
                wordDisplay.textContent = 'Guess the word!';
                
                if (gameRecording.currentRound) {
                    gameRecording.currentRound.word = data.word;
                }
            }
            roundStartTime = data.serverTime;
            hasAnyoneGuessed = false;
            
            const serverTime = data.serverTime;
            clearTimers();
            startRoundTimer(gameSettings.drawTime, serverTime);
            
            if (isHost) {
                sendData(data);
            }
            break;
        case 'spectator_converted':
            if (data.username === username) {
                isSpectator = false;
                const player = players.get(username);
                if (player) {
                    player.isSpectator = false;
                    addChatMessage(`<span class="text-green-600"><i class="fas fa-user-plus"></i> You are now an active player!</span>`);
                    guessInput.disabled = false;
                    guessInput.placeholder = "Type your guess...";
                }
            }
            updatePlayerList();
            updateScoreDisplay();
            break;
        case 'round_complete':
            clearTimers();
            gamePhase = 'transition';
            addChatMessage(`<span class="text-blue-600"><i class="fas fa-star"></i> Everyone has guessed the word: ${data.word}</span>`);
            startTransitionTimer(TRANSITION_TIME, data.serverTime);
            break;
        case 'word_suggestion':
            if (isHost) {
                if (!pendingSuggestions.has(data.username)) {
                    pendingSuggestions.set(data.username, new Set());
                }
                pendingSuggestions.get(data.username).add(data.word);
                updatePendingSuggestions();
                addChatMessage(`<span class="text-blue-600"><i class="fas fa-lightbulb"></i> ${data.username} suggested: ${data.word}</span>`);
            }
            break;
            
        case 'word_suggestion_response':
            if (data.username === username) {
                const icon = data.accepted ? 'check-circle' : 'times-circle';
                const color = data.accepted ? 'green' : 'red';
                addChatMessage(`<span class="text-${color}-600"><i class="fas fa-${icon}"></i> Host ${data.accepted ? 'accepted' : 'rejected'} your word: ${data.word}</span>`);
            }
            break;
        case 'sync_recording':
            if (!isHost) {
                gameRecording = data.recording;
            }
            break;
    }
}

function startWordSelectionTimer() {
    wordChoiceTimeLeft = WORD_SELECTION_TIME;
    
    timerDisplay = document.createElement('div');
    timerDisplay.className = 'text-xl font-bold text-center mt-2';
    wordDisplay.parentNode.insertBefore(timerDisplay, wordDisplay.nextSibling);
    
    const updateTimer = () => {
        if (timerDisplay) {
            timerDisplay.innerHTML = `<span class="text-purple-600">Choosing word: ${wordChoiceTimeLeft}s</span>`;
        }
        if (wordChoiceTimeLeft <= 0) {
            clearTimers();
        }
        wordChoiceTimeLeft--;
    };
    
    updateTimer();
    wordChoiceTimer = setInterval(updateTimer, 1000);
}

function nextRound() {
    if (!isHost) return;
    
    const spectatorsToConvert = [];
    players.forEach((data, playerName) => {
        if (data.isSpectator) {
            data.isSpectator = false;
            spectatorsToConvert.push(playerName);
        }
    });
    
    spectatorsToConvert.forEach(playerName => {
        sendData({
            type: 'spectator_converted',
            username: playerName
        });
    });
    
    roundInProgress = true;
    const playerArray = Array.from(players.keys());
    const currentIndex = playerArray.indexOf(currentDrawer);
    const nextIndex = (currentIndex + 1) % playerArray.length;
    currentDrawer = playerArray[nextIndex];
    
    roundNumber++;
    hasAnyoneGuessed = false;
    
    if (roundNumber > gameSettings.rounds * playerArray.length) {
        endGame();
        return;
    }
    
    sendData({
        type: 'new_round',
        drawer: currentDrawer,
        roundNumber: roundNumber
    });
    
    isDrawer = currentDrawer === username;
    if (isDrawer) {
        showWordSelectionModal(getRandomWords(3));
    } else {
        wordDisplay.textContent = 'Guess the word!';
    }
    
    updateScoreDisplay();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    correctGuesses = new Set();
    totalPossibleGuessers = Array.from(players.entries())
        .filter(([name, data]) => !data.isSpectator && name !== currentDrawer)
        .length;
    updateDrawingControls();
    
    if (gameRecording.currentRound) {
        gameRecording.rounds.push(gameRecording.currentRound);
    }
    
    gameRecording.currentRound = {
        roundNumber: roundNumber,
        globalRoundNumber: ++gameRecording.totalRounds,
        drawer: currentDrawer,
        word: null,
        startTime: Date.now(),
        actions: []
    };
    
    
    if (isHost) {
        sendData({
            type: 'sync_recording',
            recording: gameRecording
        });
    }
}

function getRandomWord() {
    return words[Math.floor(Math.random() * words.length)];
}

function getCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.pageX - (rect.left + window.pageXOffset)) * scaleX;
    const y = (e.pageY - (rect.top + window.pageYOffset)) * scaleY;
    
    return { x, y };
}

function compressPath(path) {
    return path.map(p => [
        Math.round(p.x0), 
        Math.round(p.y0),
        Math.round(p.x1), 
        Math.round(p.y1),
        p.color,
        p.size
    ]);
}

function startDrawing(e) {
    if (!isDrawer) return;
    
    const point = getCanvasPoint(e);
    
    if (isFillMode) {
        floodFill(Math.floor(point.x), Math.floor(point.y), colorPicker.value);
        undoStack.push({
            type: 'fill',
            x: Math.floor(point.x),
            y: Math.floor(point.y),
            color: colorPicker.value
        });
        redoStack = [];
        sendData({
            type: 'fill',
            x: Math.floor(point.x),
            y: Math.floor(point.y),
            color: colorPicker.value
        });
        return;
    }
    
    isDrawing = true;
    currentPath = [];
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lastX = point.x;
    ctx.lastY = point.y;
}

function draw(e) {
    if (!isDrawing || !isDrawer) return;
    
    const point = getCanvasPoint(e);
    const currentColor = isEraserMode ? '#FFFFFF' : colorPicker.value;
    const currentSize = isEraserMode ? parseInt(brushSize.value) * 2 : brushSize.value;
    
    if (!isUndoRedoing) {
        currentPath.push({
            x0: ctx.lastX,
            y0: ctx.lastY,
            x1: point.x,
            y1: point.y,
            color: currentColor,
            size: currentSize
        });
        
        
        recordAction({
            type: 'draw',
            x0: ctx.lastX,
            y0: ctx.lastY,
            x1: point.x,
            y1: point.y,
            color: currentColor,
            size: currentSize
        });
    }
    
    drawLine(ctx.lastX, ctx.lastY, point.x, point.y, currentColor, currentSize);
    
    if (!isUndoRedoing) {
        sendData({
            type: 'drawing',
            x0: ctx.lastX,
            y0: ctx.lastY,
            x1: point.x,
            y1: point.y,
            color: currentColor,
            size: currentSize
        });
    }
    
    ctx.lastX = point.x;
    ctx.lastY = point.y;
}

function stopDrawing() {
    if (isDrawing && currentPath.length > 0) {
        undoStack.push({
            type: 'path',
            data: compressPath(currentPath)
        });
        redoStack = [];
    }
    isDrawing = false;
    currentPath = [];
}

canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', stopDrawing);

function handleTouchStart(e) {
    e.preventDefault();
    if (!isDrawer) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    if (isFillMode) {
        floodFill(Math.floor(x), Math.floor(y), colorPicker.value);
        sendData({
            type: 'fill',
            x: Math.floor(x),
            y: Math.floor(y),
            color: colorPicker.value
        });
        return;
    }
    
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lastX = x;
    ctx.lastY = y;
    
    if (!isFillMode) {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        redoStack = [];
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!isDrawing || !isDrawer) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    const currentColor = isEraserMode ? '#FFFFFF' : colorPicker.value;
    const currentSize = isEraserMode ? parseInt(brushSize.value) * 2 : brushSize.value;
    
    drawLine(ctx.lastX, ctx.lastY, x, y, currentColor, currentSize);
    sendData({
        type: 'drawing',
        x0: ctx.lastX,
        y0: ctx.lastY,
        x1: x,
        y1: y,
        color: currentColor,
        size: currentSize
    });
    
    ctx.lastX = x;
    ctx.lastY = y;
}

function setupCanvas() {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;
    const scale = containerWidth / canvas.width;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = (canvas.height * scale) + 'px';
    
    canvas.style.touchAction = 'none';
}

window.addEventListener('load', async () => {
    await loadWords();
    setupCanvas();
    displayColorPalette();
});

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
        
        setupCanvas();
        
        ctx.drawImage(tempCanvas, 0, 0);
        
        if (isDrawer) {
            sendData({
                type: 'canvas_state',
                state: canvas.toDataURL()
            });
        }
    }, 250);
});


function drawLine(x0, y0, x1, y1, color = '#000000', size = 2, context = ctx) {
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = 'round';
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
}


function floodFill(startX, startY, fillColor, context = ctx) {
    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const pixels = imageData.data;
    
    const startPos = (startY * context.canvas.width + startX) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];
    const startA = pixels[startPos + 3];
    
    if (colorMatch(fillColor, [startR, startG, startB, startA])) return;
    
    const fillR = parseInt(fillColor.substr(1,2), 16);
    const fillG = parseInt(fillColor.substr(3,2), 16);
    const fillB = parseInt(fillColor.substr(5,2), 16);
    
    const stack = [[startX, startY]];
    
    while (stack.length) {
        const [x, y] = stack.pop();
        const pos = (y * context.canvas.width + x) * 4;
        
        if (x < 0 || x >= context.canvas.width || y < 0 || y >= context.canvas.height) continue;
        if (!colorMatch([pixels[pos], pixels[pos + 1], pixels[pos + 2], pixels[pos + 3]], 
                       [startR, startG, startB, startA])) continue;
        
        pixels[pos] = fillR;
        pixels[pos + 1] = fillG;
        pixels[pos + 2] = fillB;
        pixels[pos + 3] = 255;
        
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    context.putImageData(imageData, 0, 0);
    
    if (isDrawer || (isHost && context === ctx)) {
        recordAction({
            type: 'fill',
            x: startX,
            y: startY,
            color: fillColor
        });
    }
}

function undo() {
    if (!isDrawer || undoStack.length === 0) return;
    
    const operation = undoStack.pop();
    redoStack.push(operation);
    
    redrawCanvas();
    sendData({ type: 'canvas_state', state: canvas.toDataURL() });
}

function redo() {
    if (!isDrawer || redoStack.length === 0) return;
    
    const operation = redoStack.pop();
    undoStack.push(operation);
    
    redrawCanvas();
    sendData({ type: 'canvas_state', state: canvas.toDataURL() });
}

function redrawCanvas() {
    isUndoRedoing = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (const operation of undoStack) {
        if (operation.type === 'fill') {
            floodFill(operation.x, operation.y, operation.color);
        } else if (operation.type === 'path') {
            for (const [x0, y0, x1, y1, color, size] of operation.data) {
                drawLine(x0, y0, x1, y1, color, size);
            }
        }
    }
    isUndoRedoing = false;
}

function addChatMessage(message) {
    const div = document.createElement('div');
    div.innerHTML = message;
    div.className = 'mb-2 p-2 hand-drawn bg-gray-50';
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    
    div.style.animation = 'fadeIn 0.3s ease-in';
    
    recordAction({
        type: 'chat',
        message: message
    });
}

function updateRecentColors(color) {
    if (color === recentColors[0]) return;
    recentColors = [color, ...recentColors.filter(c => c !== color)].slice(0, maxRecentColors);
    displayRecentColors();
}

function displayRecentColors() {
    recentColorsContainer.innerHTML = '';
    recentColors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch hand-drawn w-8 h-8 cursor-pointer hover:scale-110 transition-transform';
        swatch.style.backgroundColor = color;
        swatch.addEventListener('click', () => {
            colorPicker.value = color;
        });
        recentColorsContainer.appendChild(swatch);
    });
}

const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);

displayRecentColors();

function copyGameCode(code) {
    navigator.clipboard.writeText(code)
        .then(() => {
            const copyBtn = gameCode.querySelector('button');
            const tooltip = copyBtn.querySelector('.tooltip-text');
            const originalIcon = copyBtn.querySelector('i').className;
            const originalTooltip = tooltip.textContent;
            
            copyBtn.querySelector('i').className = 'fas fa-check text-green-500';
            tooltip.textContent = 'Copied!';
            
            setTimeout(() => {
                copyBtn.querySelector('i').className = originalIcon;
                tooltip.textContent = originalTooltip;
            }, 2000);
        })
        .catch(err => console.error('Failed to copy:', err));
}

function clearCanvas() {
    if (!isDrawer) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undoStack = [];
    redoStack = [];
    
    recordAction({
        type: 'clear'
    });
    
    sendData({ type: 'clear_canvas' });
}

function floodFill(startX, startY, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    const startPos = (startY * canvas.width + startX) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];
    const startA = pixels[startPos + 3];
    
    if (colorMatch(fillColor, [startR, startG, startB, startA])) return;
    
    const fillR = parseInt(fillColor.substr(1,2), 16);
    const fillG = parseInt(fillColor.substr(3,2), 16);
    const fillB = parseInt(fillColor.substr(5,2), 16);
    
    const stack = [[startX, startY]];
    
    while (stack.length) {
        const [x, y] = stack.pop();
        const pos = (y * canvas.width + x) * 4;
        
        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
        if (!colorMatch([pixels[pos], pixels[pos + 1], pixels[pos + 2], pixels[pos + 3]], 
                       [startR, startG, startB, startA])) continue;
        
        pixels[pos] = fillR;
        pixels[pos + 1] = fillG;
        pixels[pos + 2] = fillB;
        pixels[pos + 3] = 255;
        
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    if (isDrawer) {
        recordAction({
            type: 'fill',
            x: startX,
            y: startY,
            color: fillColor
        });
    }
}

function colorMatch(c1, c2) {
    return Math.abs(c1[0] - c2[0]) < 5 && 
           Math.abs(c1[1] - c2[1]) < 5 && 
           Math.abs(c1[2] - c2[2]) < 5 && 
           Math.abs(c1[3] - c2[3]) < 5;
}

function toggleFillMode() {
    isFillMode = !isFillMode;
    if (isEraserMode) toggleEraserMode();
    fillBtn.classList.toggle('bg-green-400');
    fillBtn.classList.toggle('bg-yellow-400');
    canvas.style.cursor = isFillMode ? 'crosshair' : 'default';
}

function toggleEraserMode() {
    if (isFillMode) toggleFillMode();
    isEraserMode = !isEraserMode;
    eraserBtn.classList.toggle('bg-gray-400');
    eraserBtn.classList.toggle('bg-yellow-400');
    canvas.style.cursor = isEraserMode ? 'crosshair' : 'default';
}

let players = new Map();
let gameSettings = {
    rounds: 3,
    drawTime: 60,
    customWords: []
};

let currentDrawer = null;
let roundNumber = 1;
const POINTS = {
    FIRST_GUESS: 100,
    QUICK_GUESS: 50,
    NORMAL_GUESS: 25
};

let gamePhase = 'waiting';
let currentTimeLeft = 0;
let lastServerSync = 0;
let roundTimer = null;
let transitionTimer = null;
let timerDisplay = null;
const TRANSITION_TIME = 5;
const TIME_WARNING = 10;
let lastDisplayedTime = -1;

let correctGuesses = new Set();
let totalPossibleGuessers = 0;

async function loadWords() {
    try {
        const response = await fetch('words.json');
        wordsByCategory = await response.json();
        words = Object.values(wordsByCategory).flat();
    } catch (error) {
        console.error('Error loading words:', error);
        words = ['dog', 'cat', 'house', 'tree', 'car', 'sun', 'moon', 'book'];
    }
}

function initializeLobby() {
    const lobbyPanel = document.getElementById('lobby-panel');
    const readyBtn = document.getElementById('readyBtn');
    const startBtn = document.getElementById('startBtn');
    const playerList = document.getElementById('player-list');
    
    lobbyPanel.classList.remove('hidden');
    
    if (isHost) {
        document.getElementById('rounds').onchange = updateGameSettings;
        document.getElementById('drawTime').onchange = updateGameSettings;
        document.getElementById('customWords').onchange = updateGameSettings;
        startBtn.classList.remove('hidden');
        startBtn.onclick = startGame;
    }
    
    readyBtn.onclick = toggleReady;
    
    players.set(username, { ready: false, score: 0 });
    updatePlayerList();
    updateScoreDisplay();
    initializeWordSuggestions();
}

function updateGameSettings() {
    if (!isHost) return;
    
    const customWords = document.getElementById('customWords').value
        .split(',')
        .map(w => w.trim())
        .filter(w => w.length > 0);
        
    gameSettings = {
        rounds: parseInt(document.getElementById('rounds').value),
        drawTime: parseInt(document.getElementById('drawTime').value),
        customWords: customWords
    };
    
    if (customWords.length > 0) {
        words = customWords;
    } else {
        words = ['dog', 'cat', 'house', 'tree', 'car', 'sun', 'moon', 'book'];
    }
    
    sendData({
        type: 'game_settings',
        settings: gameSettings
    });
}

function toggleReady() {
    const player = players.get(username);
    if (!player) return;
    
    player.ready = !player.ready;
    
    const readyBtn = document.getElementById('readyBtn');
    readyBtn.classList.toggle('bg-yellow-400');
    readyBtn.classList.toggle('bg-green-400');
    readyBtn.innerHTML = player.ready ? 
        '<i class="fas fa-check mr-2"></i>Ready!' :
        '<i class="fas fa-check mr-2"></i>Ready';
    
    sendData({
        type: 'player_ready',
        username: username,
        ready: player.ready
    });
    
    updatePlayerList();
}

function updatePlayerList() {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = '';
    
    players.forEach((data, playerName) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'flex items-center justify-between p-2 hand-drawn bg-gray-50';
        playerDiv.innerHTML = `
            <span>${playerName}${isHost && playerName === username ? ' (Host)' : ''}
                  ${data.isSpectator ? ' <i class="fas fa-eye text-blue-500" title="Spectator"></i>' : ''}</span>
            <span class="flex items-center gap-4">
                <span class="text-sm">${data.score} pts</span>
                <i class="fas fa-${data.ready ? 'check text-green-600' : 'clock text-yellow-600'}"></i>
            </span>
        `;
        playerList.appendChild(playerDiv);
    });
    
    if (isHost) {
        const allReady = Array.from(players.values())
            .filter(p => !p.isSpectator)
            .every(p => p.ready);
        const startBtn = document.getElementById('startBtn');
        startBtn.disabled = !allReady;
        startBtn.classList.toggle('opacity-50', !allReady);
    }
}

function startGame(isInitiator = true) {
    if (isInitiator && isHost) {
        sendData({ 
            type: 'start_game',
            serverTime: Date.now()
        });
    }
    
    document.getElementById('lobby-panel').classList.add('hidden');
    document.getElementById('container').classList.remove('hidden');
    document.getElementById('container').style.display = 'flex';
    
    if (isHost) {
        currentDrawer = Array.from(players.keys())[0];
        roundNumber = 0; 
        gameRecording.expectedTotalRounds = players.size * gameSettings.rounds;
        gameRecording.totalRounds = 0; 
        
        sendData({
            type: 'game_state',
            players: Array.from(players.entries()),
            settings: gameSettings,
            currentDrawer: currentDrawer,
            currentWord: currentWord,
            roundNumber: roundNumber,
            gameInProgress: true,
            gamePhase: 'starting',
            serverTime: Date.now(),
            expectedTotalRounds: gameRecording.expectedTotalRounds 
        });
        nextRound();
    }
    updateDrawingControls();
}

function updateScoreDisplay() {
    const scoresDiv = document.getElementById('scores');
    scoresDiv.innerHTML = '';
    
    if (isSpectator) {
        const spectatorDiv = document.createElement('div');
        spectatorDiv.className = 'mb-4 p-2 hand-drawn bg-blue-100';
        spectatorDiv.innerHTML = `
            <div class="text-center text-blue-600">
                <i class="fas fa-eye"></i> You are spectating
                <div class="text-sm">You'll be able to play in the next round</div>
            </div>
        `;
        scoresDiv.appendChild(spectatorDiv);
    }
    
    const sortedPlayers = Array.from(players.entries())
        .filter(([, data]) => !data.isSpectator)
        .sort(([,a], [,b]) => b.score - a.score);
    
    sortedPlayers.forEach(([name, data]) => {
        const scoreDiv = document.createElement('div');
        scoreDiv.className = `flex justify-between items-center p-2 hand-drawn 
            ${name === currentDrawer ? 'bg-purple-100' : 'bg-gray-50'}`;
        scoreDiv.innerHTML = `
            <span>${name} ${name === currentDrawer ? ' (Drawing)' : ''}</span>
            <span class="font-bold">${data.score}</span>
        `;
        scoresDiv.appendChild(scoreDiv);
    });
}

function endGame() {
    gamePhase = 'ended';
    clearTimers();
    if (timerDisplay) {
        timerDisplay.remove();
        timerDisplay = null;
    }

    
    if (gameRecording.currentRound && 
        gameRecording.currentRound.roundNumber <= gameRecording.expectedTotalRounds &&
        !gameRecording.rounds.some(r => r.globalRoundNumber === gameRecording.currentRound.globalRoundNumber)) {
        gameRecording.rounds.push(gameRecording.currentRound);
    }
    gameRecording.currentRound = null;

    
    gameRecording.rounds.sort((a, b) => a.globalRoundNumber - b.globalRoundNumber);

    if (!isHost) return;
    
    const sortedPlayers = Array.from(players.entries())
        .sort(([,a], [,b]) => b.score - a.score);
    
    const winner = sortedPlayers[0];
    
    sendData({
        type: 'game_end',
        winner: winner[0],
        finalScores: sortedPlayers
    });
    
    displayGameEnd(winner[0], sortedPlayers);
}

function displayGameEnd(winner, finalScores) {
    if (roundTimer) {
        clearInterval(roundTimer);
        roundTimer = null;
    }

    const container = document.getElementById('container');
    container.innerHTML = `
        <div class="bg-white p-6 hand-drawn max-w-md mx-auto">
            <h2 class="text-2xl font-bold mb-4 text-center">
                <i class="fas fa-crown text-yellow-500"></i>
                ${winner === username ? 'You won!' : `${winner} wins!`}
            </h2>
            <div class="space-y-2 mb-6">
                ${finalScores.map(([name, data]) => `
                    <div class="flex justify-between items-center p-2 hand-drawn 
                        ${name === winner ? 'bg-yellow-100' : 'bg-gray-50'}">
                        <span>${name}</span>
                        <span class="font-bold">${data.score} pts</span>
                    </div>
                `).join('')}
            </div>
            <button onclick="location.reload()" 
                    class="hand-drawn-btn bg-green-400 px-6 py-3 font-bold hover:bg-green-500">
                <i class="fas fa-redo mr-2"></i>Play Again
            </button>
        </div>
    `;
    
    if (gameRecording.currentRound) {
        gameRecording.rounds.push(gameRecording.currentRound);
    }
    
    const replayViewer = createReplayViewer(gameRecording);
    container.appendChild(replayViewer);
}

function startRoundTimer(duration, serverTime = Date.now()) {
    clearTimers();
    
    timerDisplay = document.createElement('div');
    timerDisplay.className = 'text-xl font-bold text-center mt-2';
    wordDisplay.parentNode.insertBefore(timerDisplay, wordDisplay.nextSibling);
    
    gamePhase = 'round';
    roundInProgress = true;
    currentTimeLeft = duration;
    lastServerSync = serverTime;
    lastDisplayedTime = -1;
    
    if (!timerDisplay) {
        timerDisplay = document.createElement('div');
        timerDisplay.className = 'text-xl font-bold text-center mt-2';
        wordDisplay.parentNode.insertBefore(timerDisplay, wordDisplay.nextSibling);
    }

    const timerUpdate = () => {
        const elapsed = Math.floor((Date.now() - lastServerSync) / 1000);
        const newTimeLeft = Math.max(0, duration - elapsed);
        
        if (newTimeLeft !== lastDisplayedTime) {
            lastDisplayedTime = newTimeLeft;
            currentTimeLeft = newTimeLeft;
            updateTimerDisplay(currentTimeLeft);
            
            if (currentTimeLeft <= 0 && roundInProgress) {
                if (isHost) {
                    endCurrentRound('timeout');
                } else {
                    clearTimers();
                }
            }
        }
    };

    timerUpdate();
    roundTimer = setInterval(timerUpdate, 1000);
}

function startTransitionTimer(duration, serverTime = Date.now()) {
    clearTimers();
    
    timerDisplay = document.createElement('div');
    timerDisplay.className = 'text-xl font-bold text-center mt-2';
    wordDisplay.parentNode.insertBefore(timerDisplay, wordDisplay.nextSibling);
    
    gamePhase = 'transition';
    currentTimeLeft = duration;
    lastServerSync = serverTime;
    lastDisplayedTime = -1;
    
    const timerUpdate = () => {
        const elapsed = Math.floor((Date.now() - lastServerSync) / 1000);
        const newTimeLeft = Math.max(0, duration - elapsed);
        
        if (newTimeLeft !== lastDisplayedTime) {
            lastDisplayedTime = newTimeLeft;
            currentTimeLeft = newTimeLeft;
            updateTimerDisplay(currentTimeLeft, true);
            
            if (currentTimeLeft <= 0) {
                clearTimers();
                if (isHost) {
                    nextRound();
                }
            }
        }
    };

    timerUpdate();
    transitionTimer = setInterval(timerUpdate, 1000);
}

function updateTimerDisplay(timeLeft, isTransition = false) {
    if (!timerDisplay) return;

    const timeStr = formatTime(timeLeft);
    
    if (isTransition) {
        timerDisplay.innerHTML = `<span class="text-blue-600">Next round in: ${timeStr}</span>`;
        return;
    }

    let colorClass = getTimerColorClass(timeLeft);
    timerDisplay.innerHTML = `<span class="${colorClass}"><i class="fas fa-clock mr-2"></i>${timeStr}</span>`;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTimerColorClass(timeLeft) {
    if (timeLeft <= 5) return 'text-red-600 animate-pulse';
    if (timeLeft <= TIME_WARNING) return 'text-yellow-600';
    return 'text-gray-800';
}

function clearTimers() {
    if (roundTimer) {
        clearInterval(roundTimer);
        roundTimer = null;
    }
    if (transitionTimer) {
        clearInterval(transitionTimer);
        transitionTimer = null;
    }
    if (timerDisplay) {
        timerDisplay.remove();
        timerDisplay = null;
    }
    if (wordSelectionTimer) {
        clearInterval(wordSelectionTimer);
        wordSelectionTimer = null;
    }
    if (wordChoiceTimer) {
        clearInterval(wordChoiceTimer);
        wordChoiceTimer = null;
    }
}

function endCurrentRound(reason, data = {}) {
    if (!roundInProgress) return false;

    if (reason === 'timeout' && !isHost) {
        return false;
    }

    if (reason === 'guess') {
        const { username, guesser } = data;
        if (guesser && !correctGuesses.has(username)) {
            correctGuesses.add(username);
            
            if (correctGuesses.size === 1) {
                guesser.score += POINTS.FIRST_GUESS;
            } else {
                const guessTime = (Date.now() - roundStartTime) / 1000;
                if (guessTime < 10) {
                    guesser.score += POINTS.QUICK_GUESS;
                } else {
                    guesser.score += POINTS.NORMAL_GUESS;
                }
            }
            updateScoreDisplay();
        }
        
        addChatMessage(`<span class="text-green-600"><i class="fas fa-check-circle"></i> ${username} guessed correctly!</span>`);
        if (isHost) {
            sendData({
                type: 'correct_guess',
                word: null,
                username: username,
                scores: Array.from(players.entries())
            });

            const remainingGuessers = Array.from(players.entries())
                .filter(([name, data]) => !data.isSpectator && name !== currentDrawer && !correctGuesses.has(name))
                .length;

            if (remainingGuessers === 0) {
                roundInProgress = false;
                clearTimers();
                const serverTime = Date.now();
                
                const activePlayers = Array.from(players.entries())
                    .filter(([name, data]) => !data.isSpectator).length;
                    
                if (activePlayers > 2) {
                    addChatMessage(`<span class="text-blue-600"><i class="fas fa-star"></i> Everyone has guessed the word: ${currentWord}</span>`);
                }
                
                startTransitionTimer(TRANSITION_TIME, serverTime);
                sendData({
                    type: 'round_complete',
                    word: currentWord,
                    serverTime: serverTime
                });
            }
            return true;
        }
    } else if (reason === 'timeout') {
        roundInProgress = false;
        clearTimers();
        gamePhase = 'transition';
        addChatMessage(`<span class="text-red-600"><i class="fas fa-clock"></i> Time's up! The word was: ${currentWord}</span>`);
        if (isHost) {
            const serverTime = Date.now();
            startTransitionTimer(TRANSITION_TIME, serverTime);
            sendData({
                type: 'time_up',
                word: currentWord,
                serverTime: serverTime
            });
        }
    }

    return true;
}

function showWordSelectionModal(wordChoices) {
    const modal = document.getElementById('word-select-modal');
    const choicesContainer = document.getElementById('word-choices');
    
    clearTimers();
    
    const existingTimerDiv = modal.querySelector('.timer-div');
    if (existingTimerDiv) {
        existingTimerDiv.remove();
    }
    
    sendData({
        type: 'selecting_word',
        username: username
    });
    
    const timerDiv = document.createElement('div');
    timerDiv.className = 'text-xl font-bold text-center mb-4 timer-div';
    modal.querySelector('h3').after(timerDiv);
    
    let timeLeft = WORD_SELECTION_TIME;
    const updateTimer = () => {
        timerDiv.innerHTML = `<span class="text-purple-600">Choose in: ${timeLeft}s</span>`;
        if (timeLeft <= 0) {
            const randomWord = wordChoices[Math.floor(Math.random() * wordChoices.length)];
            selectWord(randomWord);
        }
        timeLeft--;
    };
    
    updateTimer();
    wordSelectionTimer = setInterval(updateTimer, 1000);
    
    function selectWord(word) {
        clearInterval(wordSelectionTimer);
        modal.classList.add('hidden');
        currentWord = word;
        wordDisplay.textContent = `Draw: ${word}`;
        const serverTime = Date.now();
        
        roundStartTime = serverTime;
        hasAnyoneGuessed = false;
        
        if (gameRecording.currentRound) {
            gameRecording.currentRound.word = word;
        }
        
        sendData({
            type: 'word_selected',
            word: word,
            serverTime: serverTime,
            roundData: gameRecording.currentRound 
        });
        
        clearTimers();
        startRoundTimer(gameSettings.drawTime, serverTime);
    }
    
    wordDisplay.textContent = 'Choosing a word...';
    choicesContainer.innerHTML = '';
    
    wordChoices.forEach(word => {
        const button = document.createElement('button');
        button.className = 'w-full hand-drawn-btn bg-purple-400 px-6 py-3 font-bold hover:bg-purple-500 mb-2';
        button.textContent = word;
        button.onclick = () => selectWord(word);
        choicesContainer.appendChild(button);
    });
    
    modal.classList.remove('hidden');
}

function getRandomWords(count = 3) {
    const categories = Object.keys(wordsByCategory);
    if (categories.length > 0) {
        const result = new Set();
        while (result.size < count) {
            const category = categories[Math.floor(Math.random() * categories.length)];
            const categoryWords = wordsByCategory[category];
            const word = categoryWords[Math.floor(Math.random() * categoryWords.length)];
            result.add(word);
        }
        return Array.from(result);
    }
    
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

let pendingSuggestions = new Map();
function initializeWordSuggestions() {
    const suggestWordBtn = document.getElementById('suggestWordBtn');
    const wordSuggestionInput = document.getElementById('wordSuggestionInput');
    const pendingSuggestionsDiv = document.getElementById('pendingSuggestions');

    if (!isHost) {
        document.getElementById('customWords').parentElement.style.display = 'none';
    } else {
        document.getElementById('wordSuggestionInput').parentElement.style.display = 'none';
    }

    suggestWordBtn.onclick = () => {
        const word = wordSuggestionInput.value.trim();
        if (word && !isHost) {
            sendData({
                type: 'word_suggestion',
                word: word,
                username: username
            });
            wordSuggestionInput.value = '';
            addChatMessage(`<span class="text-blue-600"><i class="fas fa-lightbulb"></i> You suggested the word: ${word}</span>`);
        }
    };

    wordSuggestionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            suggestWordBtn.click();
        }
    });
}

function updatePendingSuggestions() {
    if (!isHost) return;

    const pendingSuggestionsDiv = document.getElementById('pendingSuggestions');
    pendingSuggestionsDiv.innerHTML = '';

    pendingSuggestions.forEach((words, suggestingUser) => {
        words.forEach(word => {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.className = 'flex items-center justify-between p-2 hand-drawn bg-gray-50';
            suggestionDiv.innerHTML = `
                <span>${suggestingUser}: ${word}</span>
                <div class="flex gap-2">
                    <button class="hand-drawn-btn bg-green-400 p-1 hover:bg-green-500" onclick="handleSuggestionResponse('${suggestingUser}', '${word}', true)">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="hand-drawn-btn bg-red-400 p-1 hover:bg-red-500" onclick="handleSuggestionResponse('${suggestingUser}', '${word}', false)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            pendingSuggestionsDiv.appendChild(suggestionDiv);
        });
    });
}

function handleSuggestionResponse(suggestingUser, word, accepted) {
    if (!isHost) return;

    const userSuggestions = pendingSuggestions.get(suggestingUser);
    if (userSuggestions) {
        userSuggestions.delete(word);
        if (userSuggestions.size === 0) {
            pendingSuggestions.delete(suggestingUser);
        }
    }

    if (accepted) {
        const customWordsInput = document.getElementById('customWords');
        const currentWords = customWordsInput.value.split(',').map(w => w.trim()).filter(w => w);
        currentWords.push(word);
        customWordsInput.value = currentWords.join(', ');
        updateGameSettings();
    }

    sendData({
        type: 'word_suggestion_response',
        username: suggestingUser,
        word: word,
        accepted: accepted
    });

    updatePendingSuggestions();
}

function updateDrawingControls() {
    const drawingControls = document.getElementById('drawing-controls');
    const canvasElement = document.getElementById('canvas');
    
    if (!isDrawer || isSpectator) {
        drawingControls.classList.add('opacity-50', 'pointer-events-none');
        canvasElement.classList.add('cursor-not-allowed');
        canvasElement.classList.remove('cursor-crosshair');
        
        if (isFillMode) toggleFillMode();
        if (isEraserMode) toggleEraserMode();
    } else {
        drawingControls.classList.remove('opacity-50', 'pointer-events-none');
        canvasElement.classList.remove('cursor-not-allowed');
        canvasElement.classList.add('cursor-crosshair');
    }
}


let gameRecording = {
    rounds: [],
    currentRound: null,
    totalRounds: 0,
    expectedTotalRounds: 0 
};

function recordAction(action) {
    if (!gameRecording.currentRound) return;
    
    action.timestamp = Date.now() - gameRecording.currentRound.startTime;
    gameRecording.currentRound.actions.push(action);
}


function nextRound() {
    if (!isHost) return;
    
    const spectatorsToConvert = [];
    players.forEach((data, playerName) => {
        if (data.isSpectator) {
            data.isSpectator = false;
            spectatorsToConvert.push(playerName);
        }
    });
    
    spectatorsToConvert.forEach(playerName => {
        sendData({
            type: 'spectator_converted',
            username: playerName
        });
    });
    
    roundInProgress = true;
    const playerArray = Array.from(players.keys());
    const currentIndex = playerArray.indexOf(currentDrawer);
    const nextIndex = (currentIndex + 1) % playerArray.length;
    currentDrawer = playerArray[nextIndex];
    
    roundNumber++;
    
    
    if (roundNumber > gameRecording.expectedTotalRounds) {
        endGame();
        return;
    }
    
    sendData({
        type: 'new_round',
        drawer: currentDrawer,
        roundNumber: roundNumber
    });
    
    isDrawer = currentDrawer === username;
    if (isDrawer) {
        showWordSelectionModal(getRandomWords(3));
    } else {
        wordDisplay.textContent = 'Guess the word!';
    }
    
    updateScoreDisplay();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    correctGuesses = new Set();
    totalPossibleGuessers = Array.from(players.entries())
        .filter(([name, data]) => !data.isSpectator && name !== currentDrawer)
        .length;
    updateDrawingControls();
    
    
    if (gameRecording.currentRound && 
        !gameRecording.rounds.some(r => r.globalRoundNumber === gameRecording.currentRound.globalRoundNumber)) {
        gameRecording.rounds.push(gameRecording.currentRound);
    }
    
    gameRecording.currentRound = {
        roundNumber: roundNumber,
        globalRoundNumber: roundNumber,
        drawer: currentDrawer,
        word: null,
        startTime: Date.now(),
        actions: []
    };
    
    
    if (isHost) {
        sendData({
            type: 'sync_recording',
            recording: gameRecording
        });
    }
}

function draw(e) {
    if (!isDrawing || !isDrawer) return;
    
    const point = getCanvasPoint(e);
    const currentColor = isEraserMode ? '#FFFFFF' : colorPicker.value;
    const currentSize = isEraserMode ? parseInt(brushSize.value) * 2 : brushSize.value;
    
    if (!isUndoRedoing) {
        currentPath.push({
            x0: ctx.lastX,
            y0: ctx.lastY,
            x1: point.x,
            y1: point.y,
            color: currentColor,
            size: currentSize
        });
    }
    
    drawLine(ctx.lastX, ctx.lastY, point.x, point.y, currentColor, currentSize);
    
    if (!isUndoRedoing) {
        sendData({
            type: 'drawing',
            x0: ctx.lastX,
            y0: ctx.lastY,
            x1: point.x,
            y1: point.y,
            color: currentColor,
            size: currentSize
        });
        
        if (isDrawer && !isUndoRedoing) {
            recordAction({
                type: 'draw',
                x0: ctx.lastX,
                y0: ctx.lastY,
                x1: point.x,
                y1: point.y,
                color: currentColor,
                size: currentSize
            });
        }
    }
    
    ctx.lastX = point.x;
    ctx.lastY = point.y;
}

function floodFill(startX, startY, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    const startPos = (startY * canvas.width + startX) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];
    const startA = pixels[startPos + 3];
    
    if (colorMatch(fillColor, [startR, startG, startB, startA])) return;
    
    const fillR = parseInt(fillColor.substr(1,2), 16);
    const fillG = parseInt(fillColor.substr(3,2), 16);
    const fillB = parseInt(fillColor.substr(5,2), 16);
    
    const stack = [[startX, startY]];
    
    while (stack.length) {
        const [x, y] = stack.pop();
        const pos = (y * canvas.width + x) * 4;
        
        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
        if (!colorMatch([pixels[pos], pixels[pos + 1], pixels[pos + 2], pixels[pos + 3]], 
                       [startR, startG, startB, startA])) continue;
        
        pixels[pos] = fillR;
        pixels[pos + 1] = fillG;
        pixels[pos + 2] = fillB;
        pixels[pos + 3] = 255;
        
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    if (isDrawer) {
        recordAction({
            type: 'fill',
            x: startX,
            y: startY,
            color: fillColor
        });
    }
}

function addChatMessage(message) {
    const div = document.createElement('div');
    div.innerHTML = message;
    div.className = 'mb-2 p-2 hand-drawn bg-gray-50';
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    
    div.style.animation = 'fadeIn 0.3s ease-in';
    
    recordAction({
        type: 'chat',
        message: message
    });
}


function createReplayViewer(recording) {
    const replayContainer = document.createElement('div');
    replayContainer.className = 'bg-white p-6 hand-drawn';
    replayContainer.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-2xl font-bold">
                <i class="fas fa-film text-purple-600"></i> Game Replay
            </h3>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                    <label class="font-bold">Speed:</label>
                    <select id="replaySpeed" class="hand-drawn px-2 py-1">
                        <option value="0.5">0.5x</option>
                        <option value="1" selected>1x</option>
                        <option value="2">2x</option>
                        <option value="4">4x</option>
                    </select>
                </div>
                <div class="flex gap-2">
                    <button id="replayPrevRound" class="hand-drawn-btn bg-gray-400 p-2 hover:bg-gray-500">
                        <i class="fas fa-step-backward"></i>
                    </button>
                    <button id="replayPlayPause" class="hand-drawn-btn bg-green-400 p-2 hover:bg-green-500">
                        <i class="fas fa-play"></i>
                    </button>
                    <button id="replayNextRound" class="hand-drawn-btn bg-gray-400 p-2 hover:bg-gray-500">
                        <i class="fas fa-step-forward"></i>
                    </button>
                </div>
            </div>
        </div>
        <div class="relative w-full h-2 mb-4 hand-drawn bg-gray-200">
            <div id="replayProgress" class="absolute left-0 top-0 h-full bg-purple-500" style="width: 0%"></div>
        </div>
        <div class="flex gap-8">
            <div class="flex-1">
                <canvas id="replayCanvas" width="800" height="400" class="bg-white w-full hand-drawn"></canvas>
                <div id="replayInfo" class="mt-2 text-center font-bold text-purple-600"></div>
            </div>
            <div class="w-64">
                <div id="replayChat" class="bg-white p-4 hand-drawn h-[400px] overflow-y-auto"></div>
            </div>
        </div>
    `;

    let currentRoundIndex = 0;
    let isPlaying = false;
    let playbackSpeed = 1;
    let startTime = 0;
    let currentTime = 0;
    const replayCtx = replayContainer.querySelector('#replayCanvas').getContext('2d');
    const replayChat = replayContainer.querySelector('#replayChat');
    const infoDisplay = replayContainer.querySelector('#replayInfo');

    function executeReplayAction(action, ctx, chat) {
        switch (action.type) {
            case 'draw':
                drawLine(action.x0, action.y0, action.x1, action.y1, action.color, action.size, ctx);
                break;
            case 'fill':
                floodFill(action.x, action.y, action.color, ctx);
                break;
            case 'clear':
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                break;
            case 'chat':
                const div = document.createElement('div');
                div.innerHTML = action.message;
                div.className = 'mb-2 p-2 hand-drawn bg-gray-50';
                chat.appendChild(div);
                chat.scrollTop = chat.scrollHeight;
                break;
        }
    }

    function displayRoundInfo() {
        const round = recording.rounds[currentRoundIndex];
        if (!round) return;
        
        const totalRounds = recording.expectedTotalRounds || recording.rounds.length;
        const drawerInfo = `${round.drawer} drawing "${round.word || '?'}"`;
        infoDisplay.innerHTML = `
            <div class="text-lg">Round ${round.roundNumber}/${totalRounds}</div>
            <div class="text-sm text-gray-600">${drawerInfo}</div>
        `;
    }
    
    replayContainer.querySelector('#replayPrevRound').title = 'Previous Round';
    replayContainer.querySelector('#replayNextRound').title = 'Next Round';
    
    function updateNavigationButtons() {
        const prevBtn = replayContainer.querySelector('#replayPrevRound');
        const nextBtn = replayContainer.querySelector('#replayNextRound');
        
        prevBtn.disabled = currentRoundIndex === 0;
        nextBtn.disabled = currentRoundIndex === recording.rounds.length - 1;
        
        prevBtn.classList.toggle('opacity-50', prevBtn.disabled);
        nextBtn.classList.toggle('opacity-50', nextBtn.disabled);
    }
    
    function playRound() {
        const round = recording.rounds[currentRoundIndex];
        if (!round || !round.actions || round.actions.length === 0) {
            console.warn('No actions to replay for this round');
            return;
        }

        replayCtx.clearRect(0, 0, replayCtx.canvas.width, replayCtx.canvas.height);
        replayChat.innerHTML = '';
        
        let lastActionIndex = 0;
        if (!startTime) startTime = performance.now() - (currentTime / playbackSpeed);

        const progressBar = replayContainer.querySelector('#replayProgress');
        const totalDuration = round.actions[round.actions.length - 1].timestamp;

        function animate(timestamp) {
            currentTime = (timestamp - startTime) * playbackSpeed;
            
            const progress = Math.min((currentTime / totalDuration) * 100, 100);
            progressBar.style.width = `${progress}%`;
            
            while (lastActionIndex < round.actions.length && 
                   round.actions[lastActionIndex].timestamp <= currentTime) {
                const action = round.actions[lastActionIndex];
                executeReplayAction(action, replayCtx, replayChat);
                lastActionIndex++;
            }
            
            if (lastActionIndex < round.actions.length && isPlaying) {
                requestAnimationFrame(animate);
            } else {
                isPlaying = false;
                updatePlayPauseButton();
            }
        }
        
        if (isPlaying) {
            requestAnimationFrame(animate);
        }
    }

    const progressContainer = replayContainer.querySelector('.hand-drawn.bg-gray-200');
    progressContainer.addEventListener('click', (e) => {
        const round = recording.rounds[currentRoundIndex];
        if (!round || !round.actions || round.actions.length === 0) return;

        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const totalDuration = round.actions[round.actions.length - 1].timestamp;
        
        currentTime = totalDuration * percentage;
        startTime = performance.now() - (currentTime / playbackSpeed);
        
        replayCtx.clearRect(0, 0, replayCtx.canvas.width, replayCtx.canvas.height);
        replayChat.innerHTML = '';
        
        for (const action of round.actions) {
            if (action.timestamp <= currentTime) {
                executeReplayAction(action, replayCtx, replayChat);
            }
        }
        
        if (!isPlaying) {
            isPlaying = true;
            updatePlayPauseButton();
            playRound();
        }
    });

    function updatePlayPauseButton() {
        const btn = replayContainer.querySelector('#replayPlayPause');
        btn.innerHTML = `<i class="fas fa-${isPlaying ? 'pause' : 'play'}"></i>`;
        btn.classList.toggle('bg-green-400', !isPlaying);
        btn.classList.toggle('bg-yellow-400', isPlaying);
    }
    
    replayContainer.querySelector('#replayPlayPause').onclick = () => {
        isPlaying = !isPlaying;
        if (isPlaying) {
            startTime = 0;
            playRound();
        }
        updatePlayPauseButton();
    };
    
    replayContainer.querySelector('#replayPrevRound').onclick = () => {
        if (currentRoundIndex > 0) {
            isPlaying = false;
            currentRoundIndex--;
            startTime = 0;
            currentTime = 0;
            displayRoundInfo();
            updateNavigationButtons();
            
            replayCtx.clearRect(0, 0, replayCtx.canvas.width, replayCtx.canvas.height);
            replayChat.innerHTML = '';
            
            isPlaying = true;
            updatePlayPauseButton();
            playRound();
        }
    };
    
    replayContainer.querySelector('#replayNextRound').onclick = () => {
        if (currentRoundIndex < recording.rounds.length - 1) {
            isPlaying = false;
            currentRoundIndex++;
            startTime = 0;
            currentTime = 0;
            displayRoundInfo();
            updateNavigationButtons();
            
            replayCtx.clearRect(0, 0, replayCtx.canvas.width, replayCtx.canvas.height);
            replayChat.innerHTML = '';
            
            isPlaying = true;
            updatePlayPauseButton();
            playRound();
        }
    };
    
    replayContainer.querySelector('#replaySpeed').onchange = (e) => {
        playbackSpeed = parseFloat(e.target.value);
        if (isPlaying) {
            startTime = 0;
            playRound();
        }
    };
    
    isPlaying = true;
    updatePlayPauseButton();
    playRound();
    
    displayRoundInfo();
    updateNavigationButtons();
    
    isPlaying = true;
    updatePlayPauseButton();
    if (recording.rounds.length > 0) {
        playRound();
    } else {
        infoDisplay.innerHTML = '<div class="text-lg text-gray-500">No rounds to replay</div>';
    }
    
    return replayContainer;
}
