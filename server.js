// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));

// --- Slovak points + counts ---
const POINTS = {
  'A':1,'E':1,'I':1,'N':1,'O':1,'S':1,'T':1,'V':1,
  'Á':2,'B':2,'D':2,'J':2,'K':2,'L':2,'M':2,'P':2,'R':2,'U':2,'Y':2,'Z':2,
  'C':3,'Č':3,'É':3,'H':3,'Í':3,'Š':3,'Ú':3,'Ý':3,'Ž':3,
  'Ť':4,'Ľ':5,'F':6,'G':6,'Ň':7,'Ô':7,'Ä':8,'Ď':8,'Ó':8,'Ĺ':9,'Ŕ':9,'X':9,'Q':10,'W':10,
  'ŽOLÍK':0
};
const COUNTS = {
  'A':9,'Á':2,'Ä':1,'B':2,'C':1,'Č':1,'D':3,'Ď':1,'E':8,'É':1,'F':1,'G':1,'H':1,
  'I':6,'Í':1,'J':2,'K':4,'L':4,'Ľ':1,'Ĺ':1,'M':3,'N':5,'Ň':1,'O':10,'Ó':1,'Ô':1,
  'P':3,'R':5,'S':5,'Š':1,'T':4,'U':3,'Ú':1,'V':5,'Y':2,'Ý':1,'Z':2,'Ž':1,'X':1,
  'ŽOLÍK':2
};

const SIZE = 15;
const DL='DL', TL='TL', DW='DW', TW='TW', N='N';

const PREMIUMS = (()=>{
  const grid=[...Array(SIZE)].map(()=>Array(SIZE).fill(N));
  const place=(cells,type)=>cells.forEach(([r,c])=>{grid[r][c]=type;grid[SIZE-1-r][SIZE-1-c]=type;grid[r][SIZE-1-c]=type;grid[SIZE-1-r][c]=type});
  place([[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]],TW);
  for(let i=1;i<14;i++) grid[i][i]=grid[i][14-i]=DW; grid[7][7]=DW;
  [[1,5],[1,9],[5,1],[5,5],[5,9],[5,13],[9,1],[9,5],[9,9],[9,13],[13,5],[13,9]].forEach(([r,c])=>{grid[r][c]=TL});
  [[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],[6,2],[6,6],[6,8],[6,12],[7,3],[7,11],[8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],[12,6],[12,8],[14,3],[14,11]].forEach(([r,c])=>{grid[r][c]=DL});
  return grid;
})();

function makeTile(ch){ return { id: Math.random().toString(36).slice(2), ch, points: POINTS[ch] ?? 0, blankLetter: ch==='ŽOLÍK'? null : null }; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } }

const rooms = {};

function createRoom(roomId){
  const bag = [];
  for(const [ch,cnt] of Object.entries(COUNTS)) for(let i=0;i<cnt;i++) bag.push(makeTile(ch));
  shuffle(bag);
  const board = Array.from({length:SIZE}, ()=> Array(SIZE).fill(null));
  rooms[roomId] = { board, premiums: PREMIUMS, bag, racks: [[],[]], scores: [0,0], turn: 0, firstMove: true, sockets: {}, history: [] };
}

function drawToRack(room, player){
  const rack = room.racks[player];
  while(rack.length < 7 && room.bag.length) rack.push(room.bag.pop());
}

function sanitizeRoom(room){
  return {
    board: room.board,
    premiums: room.premiums,
    racks: room.racks.map(r=>r.map(t=>({ch:t.ch, points:t.points, id:t.id, blankLetter:t.blankLetter}))),
    scores: room.scores,
    turn: room.turn,
    firstMove: room.firstMove,
    bagCount: room.bag.length,
    history: room.history.slice().reverse()
  };
}

function displayChar(tile){ return tile.ch==='ŽOLÍK' ? (tile.blankLetter||'A') : tile.ch; }
function isSingleLineContiguous(board, placements){
  if(placements.length===0) return false;
  if(placements.length===1) return true;
  const rows=[...new Set(placements.map(p=>p.r))], cols=[...new Set(placements.map(p=>p.c))];
  if(rows.length!==1 && cols.length!==1) return false;
  if(rows.length===1){
    const r=rows[0], cs=placements.map(p=>p.c).sort((a,b)=>a-b);
    for(let x=cs[0]; x<=cs[cs.length-1]; x++) if(!board[r][x]) return false;
    return true;
  } else {
    const c=cols[0], rs=placements.map(p=>p.r).sort((a,b)=>a-b);
    for(let y=rs[0]; y<=rs[rs.length-1]; y++) if(!board[y][c]) return false;
    return true;
  }
}
function wordAt(board,r,c,dr,dc){
  while(r-dr>=0 && c-dc>=0 && r-dr<SIZE && c-dc<SIZE && board[r-dr][c-dc]){ r-=dr; c-=dc; }
  let text='', coords=[];
  while(r>=0 && c>=0 && r<SIZE && c<SIZE && board[r][c]){ text+=displayChar(board[r][c]); coords.push([r,c]); r+=dr; c+=dc; }
  return { text, coords };
}
function scoreWord(board,premiums,coords,placedSet){
  let sum=0, wordMul=1;
  for(const [r,c] of coords){
    const tile=board[r][c]; const ch=displayChar(tile);
    const base = tile.ch==='ŽOLÍK' ? 0 : (POINTS[ch]||0);
    let letter=base;
    const isNew = placedSet.has(r+','+c);
    if(isNew){
      const mult = premiums[r][c];
      if(mult===DL) letter*=2; else if(mult===TL) letter*=3;
      if(mult===DW) wordMul*=2; else if(mult===TW) wordMul*=3;
    }
    sum+=letter;
  }
  return sum*wordMul;
}
function scoreMove(room, placements){
  const board = room.board, premiums = room.premiums;
  const placedSet = new Set();
  for(const p of placements){ board[p.r][p.c] = { ch: p.ch, points: POINTS[p.ch]||0, blankLetter: p.blankLetter||null }; placedSet.add(p.r+','+p.c); }
  const sameRow = placements.every(p=>p.r===placements[0].r);
  const dr = sameRow?0:1, dc = sameRow?1:0;
  const main = wordAt(board, placements[0].r, placements[0].c, dr, dc);
  let total = 0, words = [];
  if(main.text.length>1){ total += scoreWord(board,premiums,main.coords,placedSet); words.push(main.text); }
  for(const p of placements){
    const cross = wordAt(board,p.r,p.c,dc,dr);
    if(cross.text.length>1){ total += scoreWord(board,premiums,cross.coords,placedSet); words.push(cross.text); }
  }
  if(placements.length===7) total+=50;
  return { total, words };
}

io.on('connection', socket=>{
  socket.on('join', ({roomId, name})=>{
    if(!roomId){ socket.emit('error_msg','Chýba roomId'); return; }
    if(!rooms[roomId]) createRoom(roomId);
    const room = rooms[roomId];
    const taken = Object.values(room.sockets);
    let playerIndex = 0;
    if(taken.includes(0) && !taken.includes(1)) playerIndex = 1;
    else if(taken.includes(0) && taken.includes(1)){ socket.emit('room_full'); return; }
    room.sockets[socket.id] = playerIndex;
    drawToRack(room, playerIndex);
    socket.join(roomId);
    socket.emit('init', { playerIndex, state: sanitizeRoom(room) });
    io.to(roomId).emit('state', sanitizeRoom(room));
    room.history.unshift({ msg: `${name||'Hráč'} sa pripojil (hráč ${playerIndex+1})` });
  });

  socket.on('commit_move', ({ roomId, placements })=>{
    const room = rooms[roomId];
    if(!room){ socket.emit('move_rejected','Miestnosť neexistuje'); return; }
    const player = room.sockets[socket.id];
    if(typeof player === 'undefined'){ socket.emit('move_rejected','Nie si v miestnosti'); return; }
    if(room.turn !== player){ socket.emit('move_rejected','Nie si na ťahu'); return; }

    const rack = room.racks[player];
    const rackCopy = rack.slice();
    const takenTiles = [];
    for(const pl of placements){
      const idx = rackCopy.findIndex(t => (t.ch==='ŽOLÍK'? (pl.ch===t.blankLetter || true) : (t.ch===pl.ch)));
      if(idx>-1 && rackCopy[idx].ch !== 'ŽOLÍK'){
        takenTiles.push(rackCopy.splice(idx,1)[0]);
      } else {
        const idxBlank = rackCopy.findIndex(t => t.ch === 'ŽOLÍK');
        if(idxBlank===-1){ socket.emit('move_rejected','Na stojane nemáš zadané písmená'); return; }
        const blankTile = rackCopy.splice(idxBlank,1)[0];
        blankTile.blankLetter = pl.ch;
        takenTiles.push(blankTile);
      }
    }

    if(!isSingleLineContiguous(room.board, placements)){ socket.emit('move_rejected','Písmená musia byť v jednom riadku/stĺpci bez dier'); return; }
    if(room.firstMove && !placements.some(p=>p.r===7 && p.c===7)){ socket.emit('move_rejected','Prvý ťah musí prejsť stredom'); return; }

    for(const t of takenTiles){ const i = rack.findIndex(x=>x.id===t.id); if(i>-1) rack.splice(i,1); }
    for(const p of placements){
      const tile = takenTiles.find(t => (t.ch===p.ch || (t.ch==='ŽOLÍK' && t.blankLetter===p.ch)));
      let finalTile;
      if(tile){ finalTile = tile; const ind = takenTiles.indexOf(tile); if(ind>-1) takenTiles.splice(ind,1); }
      else finalTile = { id: Math.random().toString(36).slice(2), ch: p.ch, points: POINTS[p.ch]||0, blankLetter: p.blankLetter||null };
      room.board[p.r][p.c] = finalTile;
    }

    const sc = scoreMove(room, placements);
    room.scores[player] += sc.total;
    room.firstMove = false;
    room.history.unshift({ msg: `Hráč ${player+1}: ${sc.words.join(' + ')} = +${sc.total}` });

    drawToRack(room, player);
    room.turn = 1 - room.turn;
    io.to(roomId).emit('state', sanitizeRoom(room));
  });

  socket.on('swap', ({ roomId, letters })=>{
    const room = rooms[roomId];
    if(!room) return;
    const player = room.sockets[socket.id];
    if(typeof player === 'undefined') return;
    const rack = room.racks[player];
    if(room.bag.length === 0){ socket.emit('error_msg','Vrecúško je prázdne'); return; }
    const toSwap=[];
    for(const ch of letters.toUpperCase()){
      const idx = rack.findIndex(t => (t.ch === ch));
      if(idx>-1) toSwap.push(rack.splice(idx,1)[0]);
    }
    if(toSwap.length===0){ socket.emit('error_msg','Neboli nájdené zadané písmená'); return; }
    room.bag.push(...toSwap);
    shuffle(room.bag);
    drawToRack(room, player);
    room.turn = 1 - room.turn;
    room.history.unshift({ msg: `Hráč ${player+1} vymenil ${toSwap.length} písmen` });
    io.to(roomId).emit('state', sanitizeRoom(room));
  });

  socket.on('disconnect', ()=>{
    for(const [roomId, room] of Object.entries(rooms)){
      if(room.sockets[socket.id] !== undefined){
        const pIndex = room.sockets[socket.id];
        delete room.sockets[socket.id];
        room.history.unshift({ msg: `Hráč ${pIndex+1} sa odpojil` });
        io.to(roomId).emit('state', sanitizeRoom(room));
      }
    }
  });
});

server.listen(PORT, ()=> console.log('Server listening on', PORT));
