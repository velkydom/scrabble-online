const socket = io();
const boardEl = document.getElementById('board');
const messagesEl = document.getElementById('messages');

for (let r = 0; r < 15; r++) {
  const tr = document.createElement('tr');
  for (let c = 0; c < 15; c++) {
    const td = document.createElement('td');
    td.dataset.row = r;
    td.dataset.col = c;
    tr.appendChild(td);
  }
  boardEl.appendChild(tr);
}

socket.on('init', state => {
  console.log('Init state:', state);
});

socket.on('update', state => {
  console.log('Update state:', state);
});

socket.on('errorMessage', msg => {
  messagesEl.textContent = msg;
});
