const socket = io();
const chess  = new Chess();
const boardElement =document.querySelector(".chessboard")

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;


const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion:'q'
    };
    
    socket.emit("move", move);
};

const getPieceUnicode =(piece)=>{
    const unicodepiece={
        p:"♙",
        r:"♖",
        n:"♘",
    b:"♗",
    q:"♕",
    k:"♔",
    P:"♟",
    R:"♜",
    N:"♞",
    B:"♝",
    Q:"♛",
    K:"♚",
}
return unicodepiece[piece.type]||"";
}
const renderBoard =()=>{ 
    const board = chess.board();
    boardElement.innerHTML="";
    board.forEach((row , rowindex)=>{
        row.forEach((square, squareindex)=>{
           const squareElement =  document.createElement("div")

           squareElement.classList.add("square" ,
             (rowindex+squareindex)%2===0?"light":"dark");
             squareElement.dataset.row = rowindex
             squareElement.dataset.col = squareindex

             if(square){
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece" , square.color ==="w"?"white":"black");
            
                pieceElement.innerText = getPieceUnicode(square)
                if (playerRole === square.color) {
                    pieceElement.setAttribute("draggable", "true");
                } else {
                    pieceElement.removeAttribute("draggable");
                }
                

                pieceElement.addEventListener("dragstart" , (e) =>{
                    if(pieceElement.draggable){
                        draggedPiece = pieceElement
                        sourceSquare = {row:rowindex , col:squareindex}
                        e.dataTransfer.setData("text/plain" , "");
                        //necessity     draggabel chalne me dikkat ni hoti
                        
                    }
                })
                pieceElement.addEventListener("dragend" , (e)=>{
                    draggedPiece = null;
                    sourceSquare = null;

                })
                squareElement.appendChild(pieceElement);
            }
            squareElement.addEventListener("dragover" , function(e){
                e.preventDefault();
            } )
            squareElement.addEventListener("drop" , function(e){
                e.preventDefault();
                if(draggedPiece){
                    const targetSquare = {
                        row:
                    parseInt(squareElement.dataset.row) ,
                         col:
                         parseInt(squareElement.dataset.col)};
                         console.log("Move from", sourceSquare, "to", targetSquare);
                         handleMove(sourceSquare , targetSquare);
                }
            })
            boardElement.appendChild(squareElement)
        })
    })
    

 }

socket.on("playerRole" , function(role){
    playerRole  = role;
    renderBoard();
 })

 socket.on("spectatorRole" , function(){
    playerRole=null;
    renderBoard();

 })

 socket.on("boardState", function(fen){
    chess.load(fen)
    renderBoard();
})
socket.on("move", function(move){
    chess.move(move)
    renderBoard();
})
  renderBoard()