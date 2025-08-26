const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

const LETTERS = "AAAAAAAAÁÁÁÁBBBBCCČČDDDĎĎEEEEEEEEÉÉFFGGHHCHCHIIIIÍÍÍJJKKLLĽĽMMNNOOOOOOOÓÓPPQRRŘSSŠŠTTŤŤUUUUÚÚVVWWXXYYÝÝZZŽŽ";

function getRandomRack(size = 7) {
  let rack = [];
  for (let i = 0; i < size; i++) {
    rack.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
  }
  return rack;
}

let players = {};
let board = Array.from({ length: 15 }, () => Array(15).fill(""));

io.on("connection", (socket) => {
  console.log("hráč pripojený:", socket.id);

  players[socket.id] = {
    rack: getRandomRack(),
    score: 0
  };

  socket.emit("init", { board, rack: players[socket.id].rack });

  socket.on("placeWord", ({ tiles }) => {
    const rows = tiles.map(t => t.row);
    const cols = tiles.map(t => t.col);
    const sameRow = rows.every(r => r === rows[0]);
    const sameCol = cols.every(c => c === cols[0]);

    if (!(sameRow || sameCol)) {
      socket.emit("errorMsg", "Slovo musí byť v jednom riadku alebo stĺpci!");
      return;
    }

    // Kontrola súvislosti (bez medzier medzi písmenami)
    if (sameRow) {
      const row = rows[0];
      const minC = Math.min(...cols), maxC = Math.max(...cols);
      for (let c = minC; c <= maxC; c++) {
        if (!tiles.find(t => t.col === c)) {
          socket.emit("errorMsg", "Medzera v slove!");
          return;
        }
      }
    } else {
      const col = cols[0];
      const minR = Math.min(...rows), maxR = Math.max(...rows);
      for (let r = minR; r <= maxR; r++) {
        if (!tiles.find(t => t.row === r)) {
          socket.emit("errorMsg", "Medzera v slove!");
          return;
        }
      }
    }

    tiles.forEach(t => {
      board[t.row][t.col] = t.letter;
    });

    players[socket.id].score += tiles.length;
    players[socket.id].rack = getRandomRack();

    io.emit("update", {
      board,
      scores: Object.fromEntries(Object.entries(players).map(([id, p]) => [id, p.score]))
    });
    socket.emit("rack", players[socket.id].rack);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    console.log("hráč odpojený:", socket.id);
  });
});

server.listen(PORT, () => console.log(`Server beží na http://localhost:${PORT}`));
