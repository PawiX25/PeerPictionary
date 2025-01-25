# Peer Pictionary

A real-time multiplayer drawing and guessing game built with PeerJS, featuring a hand-drawn aesthetic and intuitive controls.

## Features

- **Peer-to-peer multiplayer** - No central server needed!
- **Easy room creation** - Generate a 4-digit code and share with friends
- **Drawing tools** 
  - Brush size control
  - Color picker with recent colors history
  - Fill tool for quick coloring
  - Eraser tool with double-width
  - Undo/Redo functionality
  - Canvas clearing
- **Game mechanics**
  - Points system (First: 100pts, Quick: 50pts, Normal: 25pts)
  - Round-based gameplay with turn rotation
  - Round timer with automatic progression
  - Word selection system
  - Custom word suggestions from players
- **Game customization**
  - Adjustable rounds (1-10)
  - Custom drawing time (30-180 seconds)
  - Custom word lists
- **Real-time features**
  - Live drawing synchronization
  - In-game chat for guessing
  - Player ready system
  - Score tracking
  - Synchronized timers
- **UI/UX**
  - Hand-drawn aesthetic
  - Responsive design
  - Touch screen support
  - Color-coded timers
- **Replay system**
  - Full game replay after completion
  - VCR-style controls (play/pause/prev/next)
  - Adjustable playback speed (0.5x to 4x)
  - Progress bar with seek functionality
  - Chat replay synchronized with drawings

## How to Play

1. Enter your username
2. Create a new game or join with a code
3. Wait for players in the lobby
4. Mark yourself as ready
5. Take turns drawing and guessing!
6. When drawing:
   - Choose from 3 random words
   - Use drawing tools to illustrate the word
   - Cannot reveal word in chat
7. When guessing:
   - Type guesses in the chat
   - First correct guess gets 100 points
   - Quick guesses (within 10s) get 50 points
   - Regular guesses get 25 points

## Quick Start

1. Clone the repository
2. Open `index.html` in your browser
3. Share the game with friends!

> **Note:** This game uses a trial TURN server with a 500MB monthly limit (renews Jan-31-2025).
> If the limit is exceeded, peer-to-peer connectivity may be affected.

## Contributing 

Feel free to open issues and pull requests to help improve the game!