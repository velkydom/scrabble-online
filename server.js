import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.resolve("./public")));

let gameState = {
  board: Array(15).fill(null).map(() => Array(15).fill("")),
  players: {},
  turn: null,
};

function isValidPlacement(tiles) {
  if (tiles.length === 0) return false;
  const rows = tiles.map(t => t.row);
  const cols = tiles.map(t => t.col);
  const sameRow = rows.every(r => r === rows[0]);
  const sameCol = cols.every(c => c === cols[0]);
  if (!sameRow && !sameCol) return false;

  if (sameRow) {
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    for (let c = minCol; c <= maxCol; c++) {
      if (!tiles.find(t => t.col === c)) return false;
    }
  }
  if (sameCol) {
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    for (let r = minRow; r <= maxRow; r++) {
      if (!tiles.find(t => t.row === r)) return false;
    }
  }
  return true;
}

io.on("connection", socket => {
  console.log("User connected", socket.id);
  if (!gameState.players[socket.id]) {
    gameState.players[socket.id] = { score: 0 };
    if (!gameState.turn) gameState.turn = socket.id;
  }
  socket.emit("init", gameState);

  socket.on("placeWord", ({ tiles, score }) => {
    if (socket.id !== gameState.turn) return;
    if (!isValidPlacement(tiles)) {
      socket.emit("errorMessage", "Písmená musia byť v stĺpci alebo riadku bez medzier.");
      return;
    }
    tiles.forEach(t => {
      gameState.board[t.row][t.col] = t.letter;
    });
    gameState.players[socket.id].score += score;

    const ids = Object.keys(gameState.players);
    const currentIndex = ids.indexOf(socket.id);
    gameState.turn = ids[(currentIndex + 1) % ids.length];

    io.emit("update", gameState);
  });

  socket.on("disconnect", () => {
    delete gameState.players[socket.id];
    if (gameState.turn === socket.id) {
      gameState.turn = Object.keys(gameState.players)[0] || null;
    }
    io.emit("update", gameState);
  });
});

server.listen(3000, () => console.log("Server beží na porte 3000"));
