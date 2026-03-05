const roomText = document.getElementById('room');
const roleText = document.getElementById('role');
const statusText = document.getElementById('status');
const countText = document.getElementById('count');
const boardCanvas = document.getElementById('board');
const restartBtn = document.getElementById('restart');
const copyBtn = document.getElementById('copy');

const ctx = boardCanvas.getContext('2d');

const CELL = 40;
const PADDING = 20;

let boardSize = 15;
let role = 'S';
let roomId = location.pathname.split('/').filter(Boolean)[1] || 'lobby';
let state = {
  board: Array.from({ length: boardSize }, () => Array(boardSize).fill(null)),
  turn: 'B',
  winner: null,
  playerCount: 0,
  spectatorCount: 0,
};

const socket = io({
  query: { roomId },
});

socket.on('joined', (payload) => {
  role = payload.role;
  roomId = payload.roomId;
  boardSize = payload.boardSize;
  roomText.textContent = `房间: ${roomId}`;
  renderRole();
  render();
});

socket.on('state', (nextState) => {
  state = nextState;
  renderRole();
  renderStatus();
  renderCount();
  render();
});

function renderRole() {
  if (role === 'B') {
    roleText.textContent = '你的身份：1号玩家（黑棋）';
  } else if (role === 'W') {
    roleText.textContent = '你的身份：2号玩家（白棋）';
  } else {
    roleText.textContent = '你的身份：观战';
  }
}

function renderStatus() {
  if (state.winner === 'B') {
    statusText.textContent = '胜者：1号玩家（黑棋）';
    return;
  }
  if (state.winner === 'W') {
    statusText.textContent = '胜者：2号玩家（白棋）';
    return;
  }
  statusText.textContent = state.turn === 'B' ? '当前回合：1号玩家（黑棋）' : '当前回合：2号玩家（白棋）';
}

function renderCount() {
  countText.textContent = `玩家人数：${state.playerCount}，观战人数：${state.spectatorCount}`;
}

function render() {
  const size = PADDING * 2 + CELL * (boardSize - 1);
  boardCanvas.width = size;
  boardCanvas.height = size;

  ctx.clearRect(0, 0, size, size);

  for (let i = 0; i < boardSize; i += 1) {
    const offset = PADDING + i * CELL;

    ctx.beginPath();
    ctx.moveTo(PADDING, offset);
    ctx.lineTo(size - PADDING, offset);
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offset, PADDING);
    ctx.lineTo(offset, size - PADDING);
    ctx.strokeStyle = '#475569';
    ctx.stroke();
  }

  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const value = state.board?.[y]?.[x];
      if (!value) continue;

      const cx = PADDING + x * CELL;
      const cy = PADDING + y * CELL;

      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fillStyle = value === 'B' ? '#0f172a' : '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.stroke();
    }
  }
}

function canMove() {
  if (role !== 'B' && role !== 'W') return false;
  if (state.winner) return false;
  return role === state.turn;
}

boardCanvas.addEventListener('click', (event) => {
  if (!canMove()) return;

  const rect = boardCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const gridX = Math.round((x - PADDING) / CELL);
  const gridY = Math.round((y - PADDING) / CELL);

  if (gridX < 0 || gridX >= boardSize || gridY < 0 || gridY >= boardSize) return;

  socket.emit('place', { x: gridX, y: gridY });
});

restartBtn.addEventListener('click', () => {
  if (role === 'B' || role === 'W') {
    socket.emit('restart');
  }
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    copyBtn.textContent = '已复制';
    setTimeout(() => {
      copyBtn.textContent = '复制房间链接';
    }, 1000);
  } catch {
    copyBtn.textContent = '复制失败';
    setTimeout(() => {
      copyBtn.textContent = '复制房间链接';
    }, 1000);
  }
});

renderRole();
renderStatus();
renderCount();
render();
