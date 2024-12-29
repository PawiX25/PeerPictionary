const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

let peerConnection = null;
let dataChannel = null;
let isHost = false;
let isDrawer = false;
let isDrawing = false;
const words = ['dog', 'cat', 'house', 'tree', 'car', 'sun', 'moon', 'book'];
let currentWord = null;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const guessInput = document.getElementById('guess-input');
const wordDisplay = document.getElementById('word-display');
const chat = document.getElementById('chat');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const joinInput = document.getElementById('joinInput');
const gameCode = document.getElementById('gameCode');

createBtn.onclick = createGame;
joinBtn.onclick = joinGame;

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

guessInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isDrawer) {
        const guess = guessInput.value;
        if (isHost) {
            if (guess.toLowerCase() === currentWord.toLowerCase()) {
                addChatMessage(`Correct! The word was: ${currentWord}`);
                setTimeout(nextRound, 3000);
            }
        } else {
            sendData({
                type: 'guess',
                guess: guess
            });
        }
        addChatMessage(`${isHost ? 'You' : 'Guest'}: ${guess}`);
        guessInput.value = '';
    }
});

function updateStatus(message) {
    addChatMessage(`Connection: ${message}`);
}

async function createGame() {
    isHost = true;
    isDrawer = true;
    setupPeerConnection();
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    const gameState = {
        offer: offer,
        candidates: []
    };
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            gameState.candidates.push(event.candidate);
            const gameId = btoa(JSON.stringify(gameState));
            gameCode.textContent = `Game Code: ${gameId}`;
        }
    };
    
    currentWord = getRandomWord();
    wordDisplay.textContent = `Draw: ${currentWord}`;
    updateStatus('Waiting for player to join...');
}

async function joinGame() {
    try {
        const gameId = joinInput.value;
        if (!gameId) return;
        
        setupPeerConnection();
        
        const gameState = JSON.parse(atob(gameId));
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(gameState.offer));
        
        for (const candidate of gameState.candidates) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        const answerData = {
            answer: answer,
            candidates: []
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                answerData.candidates.push(event.candidate);
                const answerCode = btoa(JSON.stringify(answerData));
                gameCode.textContent = `Your Answer Code (give this to host): ${answerCode}`;
            }
        };
        
        updateStatus('Connected! Waiting for game to start...');
    } catch (err) {
        updateStatus(`Error joining: ${err.message}`);
    }
}

function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    
    if (isHost) {
        dataChannel = peerConnection.createDataChannel('gameChannel');
        setupDataChannel();
    } else {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel();
        };
    }
    
    peerConnection.onconnectionstatechange = () => {
        updateStatus(`Connection state: ${peerConnection.connectionState}`);
    };
}

document.body.insertAdjacentHTML('beforeend', `
    <div id="answer-panel" style="margin-top: 20px;">
        <input id="answerInput" placeholder="Enter answer code">
        <button id="submitAnswer">Submit Answer</button>
    </div>
`);

document.getElementById('submitAnswer').onclick = async () => {
    if (!isHost) return;
    
    try {
        const answerData = JSON.parse(atob(document.getElementById('answerInput').value));
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answerData.answer));
        
        for (const candidate of answerData.candidates) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        updateStatus('Answer accepted! Connection establishing...');
    } catch (err) {
        updateStatus(`Error processing answer: ${err.message}`);
    }
};

function setupDataChannel() {
    dataChannel.onmessage = handleMessage;
    dataChannel.onopen = () => {
        addChatMessage('Connected to peer!');
    };
}

function handleMessage(event) {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'drawing':
            if (!isDrawer) {
                drawLine(data.x0, data.y0, data.x1, data.y1);
            }
            break;
        case 'guess':
            if (isHost && data.guess.toLowerCase() === currentWord.toLowerCase()) {
                sendData({
                    type: 'correct_guess',
                    word: currentWord
                });
                setTimeout(nextRound, 3000);
            }
            break;
        case 'correct_guess':
            addChatMessage(`Correct! The word was: ${data.word}`);
            break;
        case 'new_round':
            if (!isHost) {
                isDrawer = !isDrawer;
                if (isDrawer) {
                    currentWord = data.word;
                    wordDisplay.textContent = `Draw: ${currentWord}`;
                } else {
                    wordDisplay.textContent = 'Guess the word!';
                }
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            break;
    }
}

function sendData(data) {
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(data));
    }
}

function nextRound() {
    if (isHost) {
        isDrawer = !isDrawer;
        currentWord = getRandomWord();
        sendData({
            type: 'new_round',
            word: currentWord
        });
        if (isDrawer) {
            wordDisplay.textContent = `Draw: ${currentWord}`;
        } else {
            wordDisplay.textContent = 'Guess the word!';
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function getRandomWord() {
    return words[Math.floor(Math.random() * words.length)];
}

function startDrawing(e) {
    if (!isDrawer) return;
    isDrawing = true;
    draw(e);
}

function draw(e) {
    if (!isDrawing || !isDrawer) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (e.type === 'mousedown') {
        ctx.beginPath();
        ctx.moveTo(x, y);
    } else {
        drawLine(ctx.lastX, ctx.lastY, x, y);
        sendData({
            type: 'drawing',
            x0: ctx.lastX,
            y0: ctx.lastY,
            x1: x,
            y1: y
        });
    }
    
    ctx.lastX = x;
    ctx.lastY = y;
}

function drawLine(x0, y0, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
}

function addChatMessage(message) {
    const div = document.createElement('div');
    div.textContent = message;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}
