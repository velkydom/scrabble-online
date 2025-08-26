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
  bag: [] // zásoba písmen
};

// Funkcia na vytvorenie zásoby písmen a ich náhodného miešania
function createBag() {
  const letters = [
    'A','A','A','A','A','A','A','A','A',
    'B','B','C','C','D','D','D','E','E','E','E','E','E','E','E','E','E','E','E','F','G','H','CH','I','I','I','I','I','I','I','I','J','K','L','L','L','M','M','N','N','N','N','O','O','O','O','O','P','P','Q','R','R','R','R','S','S','S','S','Š','T','T','T','U','U','U','Ú','V','V','W','X','Y','Z','Z','Ž'
  ];
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  gameState.bag = letters;
}

// Funkcia na validáciu umiestnenia písmen (rovný riadok alebo stĺpec, súvislé)
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
    gameState.players[socket.id] = { score: 0, rack: [] };
    if (!gameState.turn) gameState.turn = socket.id;
  }
  if (gameState.bag.length === 0) createBag();

  // Napln stojan hráča 7 písmenami
  while (gameState.players[socket.id].rack.length < 7 && gameState.bag.length > 0) {
    gameState.players[socket.id].rack.push(gameState.bag.pop());
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
      const index = gameState.players[socket.id].rack.indexOf(t.letter);
      if (index > -1) gameState.players[socket.id].rack.splice(index, 1);
    });
    gameState.players[socket.id].score += score;

    // doplnenie stojanu hráča
    while (gameState.players[socket.id].rack.length < 7 && gameState.bag.length > 0) {
      gameState.players[socket.id].rack.push(gameState.bag.pop());
    }

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