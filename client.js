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

let isFillMode = false;

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

fillBtn.onclick = toggleFillMode;
clearBtn.onclick = clearCanvas;

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
        case 'fill':
            if (!isDrawer) {
                floodFill(data.x, data.y, data.color);
            }
            break;
        case 'canvas_state':
            if (!isDrawer) {
                const img = new Image();
                img.src = data.state;
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                };
            }
            break;
        case 'clear_canvas':
            if (!isDrawer) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
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
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    if (isFillMode) {
        floodFill(x, y, colorPicker.value);
        sendData({
            type: 'fill',
            x: x,
            y: y,
            color: colorPicker.value
        });
        return;
    }
    
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

function clearCanvas() {
    if (!isDrawer) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
}

function colorMatch(c1, c2) {
    return Math.abs(c1[0] - c2[0]) < 5 && 
           Math.abs(c1[1] - c2[1]) < 5 && 
           Math.abs(c1[2] - c2[2]) < 5 && 
           Math.abs(c1[3] - c2[3]) < 5;
}
