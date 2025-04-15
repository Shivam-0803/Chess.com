const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();

const server = http.createServer(app);

const io = socket(server);

const chess = new Chess();
let players = {};
let currentPlayer = "W";

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index");
});

io.on("connection", function (uniquesocket) {
  console.log("Connected");

  if (!players.white) {
    players.white = uniquesocket.id;
    uniquesocket.emit("playerRole", "w");
  } else if (!players.black) {
    players.black = uniquesocket.id;
    uniquesocket.emit("playerRole", "b");
  } else {
    uniquesocket.emit("spectatorRole");

  }

  uniquesocket.on("disconnect", function () {
    if (uniquesocket.id === players.white) {
      delete players.white;
    } else if (uniquesocket.id === players.black) {
      delete players.black;
    }




    // Modifications to app.js to support WebRTC

// Add this after existing socket listeners in the io.on('connection') block:

  // WebRTC signaling
  uniquesocket.on('webrtc_offer', (offerData) => {
    // Forward the offer to the other player
    if (offerData.role === 'w' && players.black) {
      io.to(players.black).emit('webrtc_offer', offerData);
    } else if (offerData.role === 'b' && players.white) {
      io.to(players.white).emit('webrtc_offer', offerData);
    }
  });

  uniquesocket.on('webrtc_answer', (answerData) => {
    // Forward the answer to the other player
    if (answerData.role === 'b' && players.white) {
      io.to(players.white).emit('webrtc_answer', answerData);
    } else if (answerData.role === 'w' && players.black) {
      io.to(players.black).emit('webrtc_answer', answerData);
    }
  });

  uniquesocket.on('webrtc_ice_candidate', (candidateData) => {
    // Forward ICE candidate to the other player
    if (candidateData.role === 'w' && players.black) {
      io.to(players.black).emit('webrtc_ice_candidate', candidateData);
    } else if (candidateData.role === 'b' && players.white) {
      io.to(players.white).emit('webrtc_ice_candidate', candidateData);
    }
  });
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
      } else {
        console.log("Invalid move");
        uniquesocket.emit("Invalid move", move);
      }
    } catch (err) {
      console.log(err);
      uniquesocket.emit("Invalid move", move);
    }
  });
});



server.listen(3000, function () {
  console.log("Running server");
});
