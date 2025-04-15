const socket = io();
const chess  = new Chess();
const boardElement = document.querySelector(".chessboard");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let flipped = false; // ✅ NEW: Track if board should be flipped

// ✅ Load saved state on refresh
const savedFEN = localStorage.getItem("savedFEN");
const savedRole = localStorage.getItem("savedRole");
if (savedFEN) chess.load(savedFEN);
if (savedRole) {
    playerRole = savedRole;
    flipped = playerRole === "b";
}

const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion:'q'
    };
    
    socket.emit("move", move);
};

const getPieceUnicode = (piece) => {
    const unicodepiece = {
        p: "♙",
        r: "♖",
        n: "♘",
        b: "♗",
        q: "♕",
        k: "♔",
        P: "♟",
        R: "♜",
        N: "♞",
        B: "♝",
        Q: "♛",
        K: "♚",
    };
    return unicodepiece[piece.type] || "";
};

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";

    const displayRows = flipped ? [...board].reverse() : board;

    displayRows.forEach((row, rowIndex) => {
        const actualRow = flipped ? 7 - rowIndex : rowIndex;
        const displayRow = flipped ? [...row].reverse() : row;

        displayRow.forEach((square, colIndex) => {
            const actualCol = flipped ? 7 - colIndex : colIndex;

            const squareElement = document.createElement("div");
            squareElement.classList.add(
                "square",
                (actualRow + actualCol) % 2 === 0 ? "light" : "dark"
            );
            squareElement.dataset.row = actualRow;
            squareElement.dataset.col = actualCol;

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece", square.color === "w" ? "white" : "black");
                pieceElement.innerText = getPieceUnicode(square);

                if (playerRole === square.color) {
                    pieceElement.setAttribute("draggable", "true");
                } else {
                    pieceElement.removeAttribute("draggable");
                }

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: actualRow, col: actualCol };
                        e.dataTransfer.setData("text/plain", "");
                    }
                });

                pieceElement.addEventListener("dragend", () => {
                    draggedPiece = null;
                    sourceSquare = null;
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", function (e) {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", function (e) {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };
                    console.log("Move from", sourceSquare, "to", targetSquare);
                    handleMove(sourceSquare, targetSquare);
                }
            });

            boardElement.appendChild(squareElement);
        });
    });
};

socket.on("playerRole", function (role) {
    playerRole = role;
    flipped = role === "b"; // ✅ Flip if player is black
    localStorage.setItem("savedRole", role); // ✅ Save role
    renderBoard();
});

socket.on("spectatorRole", function () {
    playerRole = null;
    flipped = false;
    localStorage.removeItem("savedRole"); // ✅ Clear role
    renderBoard();
});

socket.on("boardState", function (fen) {
    chess.load(fen);
    localStorage.setItem("savedFEN", fen); // ✅ Save FEN
    updateTimersForTurn(); // ✅ Update timer for turn
    renderBoard();
});

socket.on("move", function (move) {
    chess.move(move);
    localStorage.setItem("savedFEN", chess.fen()); // ✅ Save FEN after move
    updateTimersForTurn(); // ✅ Update timer for turn
    renderBoard();
});

renderBoard();


// ✅ Timer Logic Starts Here
let whiteTime = 600; // 10 minutes in seconds
let blackTime = 600;
let whiteInterval = null;
let blackInterval = null;

const whiteTimerElement = document.getElementById("white-timer");
const blackTimerElement = document.getElementById("black-timer");

function formatTime(seconds) {
    const min = String(Math.floor(seconds / 60)).padStart(2, '0');
    const sec = String(seconds % 60).padStart(2, '0');
    return `${min}:${sec}`;
}

function updateTimersDisplay() {
    whiteTimerElement.textContent = formatTime(whiteTime);
    blackTimerElement.textContent = formatTime(blackTime);
}

function startWhiteTimer() {
    clearInterval(blackInterval);
    clearInterval(whiteInterval);
    whiteInterval = setInterval(() => {
        whiteTime--;
        updateTimersDisplay();
        if (whiteTime <= 0) {
            clearInterval(whiteInterval);
            alert("White ran out of time!");
        }
    }, 1000);
}

function startBlackTimer() {
    clearInterval(whiteInterval);
    clearInterval(blackInterval);
    blackInterval = setInterval(() => {
        blackTime--;
        updateTimersDisplay();
        if (blackTime <= 0) {
            clearInterval(blackInterval);
            alert("Black ran out of time!");
        }
    }, 1000);
}

function updateTimersForTurn() {
    const turn = chess.turn(); // 'w' or 'b'
    if (turn === 'w') {
        startWhiteTimer();
    } else {
        startBlackTimer();
    }
}

updateTimersDisplay(); // initial render
