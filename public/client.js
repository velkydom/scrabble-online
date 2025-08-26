const socket = io();
let board = [];
let rack = [];
let selectedLetter = null;
let placed = [];

const boardEl = document.getElementById("board");
const rackEl = document.getElementById("rack");
const msgEl = document.getElementById("messages");
const scoresEl = document.getElementById("scores");
const submitBtn = document.getElementById("submit");

socket.on("init", (data) => {
  board = data.board;
  rack = data.rack;
  renderBoard();
  renderRack();
});

socket.on("update", (data) => {
  board = data.board;
  renderBoard();
  scoresEl.textContent = "Skóre: " + JSON.stringify(data.scores);
});

socket.on("rack", (newRack) => {
  rack = newRack;
  renderRack();
});

socket.on("errorMsg", (msg) => {
  msgEl.textContent = msg;
  setTimeout(() => msgEl.textContent = "", 3000);
});

function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < board.length; r++) {
    const row = document.createElement("tr");
    for (let c = 0; c < board[r].length; c++) {
      const cell = document.createElement("td");
      cell.textContent = board[r][c];
      cell.addEventListener("click", () => {
        if (selectedLetter && !cell.textContent) {
          cell.textContent = selectedLetter;
          placed.push({ row: r, col: c, letter: selectedLetter });
          selectedLetter = null;
          renderRack();
        }
      });
      row.appendChild(cell);
    }
    boardEl.appendChild(row);
  }
}

function renderRack() {
  rackEl.innerHTML = "";
  rack.forEach((letter, i) => {
    const span = document.createElement("span");
    span.textContent = letter;
    span.style.cursor = "pointer";
    span.addEventListener("click", () => {
      selectedLetter = letter;
      rack.splice(i, 1);
      renderRack();
    });
    rackEl.appendChild(span);
  });
}

submitBtn.addEventListener("click", () => {
  if (placed.length > 0) {
    socket.emit("placeWord", { tiles: placed });
    placed = [];
  }
});
