const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();

const server = http.createServer(app);

// Configure Socket.IO with CORS and increased ping timeout
const io = socket(server, {
  pingTimeout: 60000,
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const chess = new Chess();
let players = {};
let currentPlayer = "W";

// Debug logger
function logDebug(type, message, data = null) {
  const emoji = {
    info: "ℹ️",
    success: "✅",
    error: "❌",
    warning: "⚠️",
    connection: "🔌",
    game: "♟️",
    webrtc: "📡"
  };
  
  console.log(`${emoji[type] || "🔍"} ${message}`, data || "");
}

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index");
});

io.on("connection", function (uniquesocket) {
  logDebug("connection", `New connection: ${uniquesocket.id}`);

  // Assign player roles
  if (!players.white) {
    players.white = uniquesocket.id;
    uniquesocket.emit("playerRole", "w");
    logDebug("game", `Player assigned as white: ${uniquesocket.id}`);
  } else if (!players.black) {
    players.black = uniquesocket.id;
    uniquesocket.emit("playerRole", "b");
    logDebug("game", `Player assigned as black: ${uniquesocket.id}`);
  } else {
    uniquesocket.emit("spectatorRole");
    logDebug("game", `Spectator joined: ${uniquesocket.id}`);
  }

  uniquesocket.on("disconnect", function () {
    logDebug("connection", `Disconnected: ${uniquesocket.id}`);
    
    if (uniquesocket.id === players.white) {
      delete players.white;
      logDebug("game", "White player left");
      
      // Notify black player if they exist
      if (players.black) {
        io.to(players.black).emit("webrtc_disconnect");
      }
    } else if (uniquesocket.id === players.black) {
      delete players.black;
      logDebug("game", "Black player left");
      
      // Notify white player if they exist
      if (players.white) {
        io.to(players.white).emit("webrtc_disconnect");
      }
    }
  });

  // WebRTC signaling
  uniquesocket.on('webrtc_offer', (offerData) => {
    try {
      // Forward the offer to the other player
      if (offerData.role === 'w' && players.black) {
        logDebug("webrtc", `Forwarding offer from white to black`);
        io.to(players.black).emit('webrtc_offer', offerData);
      } else if (offerData.role === 'b' && players.white) {
        logDebug("webrtc", `Forwarding offer from black to white`);
        io.to(players.white).emit('webrtc_offer', offerData);
      } else {
        logDebug("warning", `Cannot forward offer - target player not connected`, offerData.role);
      }
    } catch (err) {
      logDebug("error", `Error handling WebRTC offer: ${err.message}`);
    }
  });

  uniquesocket.on('webrtc_answer', (answerData) => {
    try {
      // Forward the answer to the other player
      if (answerData.role === 'b' && players.white) {
        logDebug("webrtc", `Forwarding answer from black to white`);
        io.to(players.white).emit('webrtc_answer', answerData);
      } else if (answerData.role === 'w' && players.black) {
        logDebug("webrtc", `Forwarding answer from white to black`);
        io.to(players.black).emit('webrtc_answer', answerData);
      } else {
        logDebug("warning", `Cannot forward answer - target player not connected`, answerData.role);
      }
    } catch (err) {
      logDebug("error", `Error handling WebRTC answer: ${err.message}`);
    }
  });

  uniquesocket.on('webrtc_ice_candidate', (candidateData) => {
    try {
      // Forward ICE candidate to the other player
      if (candidateData.role === 'w' && players.black) {
        logDebug("webrtc", `Forwarding ICE candidate from white to black`);
        io.to(players.black).emit('webrtc_ice_candidate', candidateData);
      } else if (candidateData.role === 'b' && players.white) {
        logDebug("webrtc", `Forwarding ICE candidate from black to white`);
        io.to(players.white).emit('webrtc_ice_candidate', candidateData);
      } else {
        logDebug("warning", `Cannot forward ICE candidate - target player not connected`, candidateData.role);
      }
    } catch (err) {
      logDebug("error", `Error handling WebRTC ICE candidate: ${err.message}`);
    }
  });
  
  // Add disconnect notification
  uniquesocket.on('webrtc_disconnect', () => {
    try {
      if (uniquesocket.id === players.white && players.black) {
        logDebug("webrtc", `Forwarding disconnect from white to black`);
        io.to(players.black).emit('webrtc_disconnect');
      } else if (uniquesocket.id === players.black && players.white) {
        logDebug("webrtc", `Forwarding disconnect from black to white`);
        io.to(players.white).emit('webrtc_disconnect');
      }
    } catch (err) {
      logDebug("error", `Error handling WebRTC disconnect: ${err.message}`);
    }
  });

  uniquesocket.on("move", (move) => {
    try {
      if (chess.turn() === "w" && uniquesocket.id !== players.white) return;
      if (chess.turn() === "b" && uniquesocket.id !== players.black) return;
      const result = chess.move(move);
      if (result) {
        currentPlayer = chess.turn();
        io.emit("move", move);
        io.emit("boardState", chess.fen());
        logDebug("game", `Move from ${move.from} to ${move.to} by ${chess.turn() === 'w' ? 'black' : 'white'}`);
      } else {
        logDebug("warning", "Invalid move", move);
        uniquesocket.emit("Invalid move", move);
      }
    } catch (err) {
      logDebug("error", `Error processing move: ${err.message}`);
      uniquesocket.emit("Invalid move", move);
    }
  });
});

server.listen(3000, function () {
  logDebug("success", "Server running on port 3000");
});
