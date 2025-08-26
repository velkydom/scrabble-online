const socket = io();
const boardEl = document.getElementById('board');
const rackEl = document.getElementById('rack');
const messagesEl = document.getElementById('messages');

function drawBoard(board) {
  boardEl.innerHTML = '';
  for (let r = 0; r < 15; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < 15; c++) {
      const td = document.createElement('td');
      td.textContent = board[r][c];
      td.dataset.row = r;
      td.dataset.col = c;
      tr.appendChild(td);
    }
    boardEl.appendChild(tr);
  }
}

function drawRack(rack) {
  rackEl.innerHTML = '';
  rack.forEach(letter => {
    const span = document.createElement('span');
    span.textContent = letter;
    span.style.marginRight = '5px';
    span.style.padding = '5px';
    span.style.border = '1px solid #000';
    span.style.cursor = 'pointer';
    rackEl.appendChild(span);
  });
}

socket.on('init', state => {
  drawBoard(state.board);
  drawRack(state.players[socket.id].rack);
});

socket.on('update', state => {
  drawBoard(state.board);
  drawRack(state.players[socket.id].rack);
});

socket.on('errorMessage', msg => {
  messagesEl.textContent = msg);
});