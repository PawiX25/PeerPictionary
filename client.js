let peer = null;
let conn = null;
let isHost = false;
let isDrawer = false;
let isDrawing = false;
const words = ['dog', 'cat', 'house', 'tree', 'car', 'sun', 'moon', 'book'];
let currentWord = null;
let recentColors = ['#000000'];
const maxRecentColors = 8;
const recentColorsContainer = document.getElementById('recent-colors');
let username = '';

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

guessInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isDrawer) {
        const guess = guessInput.value;
        if (isHost) {
            if (guess.toLowerCase() === currentWord.toLowerCase()) {
                addChatMessage(`Correct! ${username} guessed the word: ${currentWord}`);
                setTimeout(nextRound, 3000);
            }
        } else {
            sendData({
                type: 'guess',
                guess: guess,
                username: username
            });
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

function updateStatus(message) {
    addChatMessage(`<i class="fas fa-info-circle text-blue-500"></i> ${message}`);
}

function generateGameCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function createGame() {
    isHost = true;
    isDrawer = true;
    const gameId = generateGameCode();
    
    peer = new Peer(gameId);
    peer.on('open', () => {
        const codeElement = gameCode.querySelector('.bg-white');
        codeElement.textContent = gameId;
        const copyBtn = gameCode.querySelector('button');
        copyBtn.onclick = () => copyGameCode(gameId);
        gameCode.classList.remove('hidden');
        updateStatus('Waiting for player to join...');
    });
    
    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection();
        currentWord = getRandomWord();
        wordDisplay.textContent = `Draw: ${currentWord}`;
    });
}

function joinGame() {
    const gameId = joinInput.value;
    if (!gameId) return;
    
    peer = new Peer();
    peer.on('open', () => {
        conn = peer.connect(gameId);
        setupConnection();
    });
}

function setupConnection() {
    conn.on('open', () => {
        sendData({
            type: 'user_info',
            username: username
        });
        updateStatus('Connected!');
    });
    
    conn.on('data', handleMessage);
}

function sendData(data) {
    if (conn && conn.open) {
        conn.send(data);
    }
}

function handleMessage(data) {
    switch(data.type) {
        case 'drawing':
            if (!isDrawer) {
                drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
            }
            break;
        case 'user_info':
            addChatMessage(`${data.username} joined the game!`);
            break;
        case 'guess':
            if (isHost && data.guess.toLowerCase() === currentWord.toLowerCase()) {
                sendData({
                    type: 'correct_guess',
                    word: currentWord,
                    username: data.username
                });
                setTimeout(nextRound, 3000);
            }
            addChatMessage(`${data.username}: ${data.guess}`);
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY + window.scrollY;
    
    if (e.type === 'mousedown') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        updateRecentColors(colorPicker.value);
    } else {
        drawLine(ctx.lastX, ctx.lastY, x, y, colorPicker.value, brushSize.value);
        sendData({
            type: 'drawing',
            x0: ctx.lastX,
            y0: ctx.lastY,
            x1: x,
            y1: y,
            color: colorPicker.value,
            size: brushSize.value
        });
    }
    
    ctx.lastX = x;
    ctx.lastY = y;
}

function drawLine(x0, y0, x1, y1, color = '#000000', size = 2) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
}

function addChatMessage(message) {
    const div = document.createElement('div');
    div.innerHTML = message;
    div.className = 'mb-2 p-2 hand-drawn bg-gray-50';
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    
    div.style.animation = 'fadeIn 0.3s ease-in';
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
