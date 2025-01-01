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
  - Points system (First guess: 100pts, Quick guess: 50pts, Normal guess: 25pts)
  - Round-based gameplay
  - Turn rotation among players
  - Round timer with automatic progression
- **Game customization**
  - Adjustable rounds (1-10)
  - Custom drawing time (30-180 seconds)
  - Custom word lists
- **Real-time features**
  - Live drawing synchronization
  - In-game chat for guessing
  - Player ready system
  - Score tracking
  - Player join/leave notifications
- **UI/UX**
  - Hand-drawn aesthetic throughout
  - Responsive design for all screen sizes
  - Touch screen support
  - Visual feedback for tool selection
  - Tooltips for buttons
  - Recent colors palette
  - Game state synchronization
- **End-game features**
  - Final scoreboard
  - Winner announcement
  - Play again option

## How to Play

1. Enter your username
2. Create a new game or join with a code
3. Wait for players in the lobby
4. Mark yourself as ready
5. Take turns drawing and guessing!
6. First correct guess gets 100 points
7. Quick guesses (within 10s) get 50 points
8. Regular guesses get 25 points

## Technology Stack

- PeerJS for P2P connections
- TailwindCSS for styling
- HTML5 Canvas for drawing
- Pure JavaScript for game logic
- Font Awesome for icons
- Google Fonts for typography

## Quick Start

1. Clone the repository
2. Open `index.html` in your browser
3. Share the game with friends!

## Technical Details

- Built with vanilla JavaScript (no framework dependencies)
- Uses WebRTC through PeerJS for real-time communication
- Implements flood fill algorithm for paint bucket tool
- Canvas state management for undo/redo functionality
- Responsive canvas scaling
- Touch event handling for mobile support

> **Note:** This game uses a trial TURN server with a 500MB monthly limit (renews Jan-31-2025).
> If the limit is exceeded, peer-to-peer connectivity may be affected.

## Contributing 

Feel free to open issues and pull requests to help improve the game!