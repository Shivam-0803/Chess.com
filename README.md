# Chess.com (with extra features) Clone

A real-time multiplayer chess application inspired by Chess.com, built with Express, EJS, Socket.IO, and WebRTC for smooth gameplay and communication.

## Overview

This project is a clone of the popular Chess.com website with added extra features (Live video chatting , spectator mode), allowing users to play chess in real-time against other players. The application features a fully functional chess board with proper game mechanics, live multiplayer functionality, video/voice chat capabilities, spectator mode, and a clean, intuitive user interface rendered with EJS templates.

## Features

- Complete chess game implementation
- Real-time multiplayer gameplay via Socket.IO
- Live video and voice chat using WebRTC
- Spectator mode to watch ongoing games
- Legal move validation
- Check and checkmate detection
- Piece movement animations
- Responsive design for various screen sizes
- Interactive chess board with highlighted possible moves
- Game state tracking
- User authentication and profiles
- Game history and statistics

## Technologies Used

- **Frontend**:
  - HTML5
  - CSS3
  - JavaScript (Vanilla)
  - EJS (Embedded JavaScript templates)
  - WebRTC (for video/voice communication)
  

- **Backend**:
  - Node.js
  - Express.js
  - Socket.IO (for real-time game updates)
  - MongoDB (for user data and game history)

- **Other**:
  - Modern ES6+ syntax
  - Responsive layout techniques
  - WebRTC adapter for cross-browser compatibility

## Getting Started

### Prerequisites

- Node.js (v14+ recommended)
- npm or yarn
- MongoDB instance (local or cloud)
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Webcam and microphone (for video/voice chat features)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/Shivam-0803/Chess.com.git
   ```

2. Navigate to the project directory:
   ```
   cd Chess.com
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   SESSION_SECRET=your_session_secret
   ```

5. Start the development server:
   ```
   npm run dev
   ```

6. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## How to Play

1. Register an account or log in
2. Create a new game or join an existing one
3. Enable camera/microphone when prompted (for chat features)
4. The game starts with white's turn
5. Click on a piece to see available moves
6. Click on a highlighted square to move the selected piece
7. Use the voice/video chat to communicate with your opponent
8. Share the game link for others to watch in spectator mode

## Spectator Mode

- Spectators can join a game by using a shared game link
- Spectators can observe the game in real-time without affecting gameplay
- Spectators can participate in a separate chat stream
- Game hosts can control spectator permissions

## Video/Voice Chat Features

- Live one-on-one video chat with your opponent
- Audio-only option for players with limited bandwidth
- Mute/unmute and camera on/off toggles
- Chat persistence during the entire game session

## Project Structure

```
Chess.com/
├── server.js                # Main application entry point
├── app.js                   # Express application setup
├── config/                  # Configuration files
├── routes/                  # Express routes
├── controllers/             # Route controllers
├── models/                  # MongoDB models
├── middleware/              # Custom middleware
├── public/                  # Static assets
│   ├── css/                 # Stylesheets
│   ├── js/                  # Client-side JavaScript
│   └── assets/              # Images and other static assets
├── views/                   # EJS templates
│   ├── partials/            # Reusable template parts
│   ├── index.ejs            # Homepage
│   ├── game.ejs             # Game page
│   └── spectate.ejs         # Spectator view
├── socket/                  # Socket.IO handlers
│   ├── game.js              # Game socket events
│   └── chat.js              # Chat socket events
└── webrtc/                  # WebRTC setup and handlers
    ├── signaling.js         # WebRTC signaling
    └── media.js             # Media stream management
```

## Future Enhancements

- Tournament system
- AI opponents with adjustable difficulty
- Game analysis tools
- Mobile application
- Advanced statistics and performance metrics
- Integration with chess engines for move suggestions
- Chess puzzles and learning resources

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Inspired by [Chess.com](https://www.chess.com/)
- Chess piece designs from [standard chess iconography](https://en.wikipedia.org/wiki/Chess_piece)
- Thanks to all contributors who have helped with the project

## Contact

Shivam - [GitHub Profile](https://github.com/Shivam-0803)

Project Link: [https://github.com/Shivam-0803/Chess.com](https://github.com/Shivam-0803/Chess.com)
