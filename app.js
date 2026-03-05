const roomText = document.getElementById('room');
const roleText = document.getElementById('role');
const statusText = document.getElementById('status');
const readyStatusText = document.getElementById('ready-status');
const countText = document.getElementById('count');
const timerText = document.getElementById('timer');
const voiceStatusText = document.getElementById('voice-status');
const boardCanvas = document.getElementById('board');
const restartBtn = document.getElementById('restart');
const readyBtn = document.getElementById('ready');
const copyBtn = document.getElementById('copy');
const micBtn = document.getElementById('mic');
const resultModal = document.getElementById('result-modal');
const resultTitle = document.getElementById('result-title');
const resultHint = document.getElementById('result-hint');
const replayBtn = document.getElementById('replay');
const audioContainer = document.getElementById('audio-container');

const ctx = boardCanvas.getContext('2d');

const CELL = 40;
const PADDING = 20;
const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

let boardSize = 15;
let role = 'S';
let roomId = location.pathname.split('/').filter(Boolean)[1] || 'lobby';
let state = {
  board: Array.from({ length: boardSize }, () => Array(boardSize).fill(null)),
  turn: 'B',
  turnStartedAt: Date.now(),
  winner: null,
  phase: 'waiting',
  ready: {
    B: false,
    W: false,
  },
  seats: {
    player1: false,
    player2: false,
  },
  playerCount: 0,
  spectatorCount: 0,
};

let knownPeerIds = new Set();
let localStream = null;
let micEnabled = false;
const peers = new Map();

const isSecureAudioSupported =
  window.isSecureContext && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

const socket = io({
  query: { roomId },
});

socket.on('joined', (payload) => {
  role = payload.role;
  roomId = payload.roomId;
  boardSize = payload.boardSize;
  roomText.textContent = `房间: ${roomId}`;
  renderRole();
  renderReadyButton();
  render();
});

socket.on('participants', ({ peerIds }) => {
  knownPeerIds = new Set((peerIds || []).filter(Boolean));
  if (micEnabled) {
    for (const peerId of knownPeerIds) {
      offerPeer(peerId);
    }
  }
});

socket.on('participant-joined', ({ peerId }) => {
  if (!peerId) return;
  knownPeerIds.add(peerId);

  if (micEnabled) {
    offerPeer(peerId);
  }
});

socket.on('participant-left', ({ peerId }) => {
  if (!peerId) return;
  knownPeerIds.delete(peerId);
  removePeer(peerId);
});

socket.on('rtc-offer', async ({ fromId, sdp }) => {
  if (!fromId || !sdp) return;

  const peer = ensurePeer(fromId);
  if (!peer) return;

  try {
    if (peer.pc.signalingState !== 'stable') {
      await peer.pc.setLocalDescription({ type: 'rollback' });
    }

    await peer.pc.setRemoteDescription(sdp);

    if (localStream) {
      addLocalTracks(peer);
    }

    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);

    socket.emit('rtc-answer', {
      targetId: fromId,
      sdp: peer.pc.localDescription,
    });
  } catch (error) {
    console.error('Handle rtc-offer failed', error);
  }
});

socket.on('rtc-answer', async ({ fromId, sdp }) => {
  if (!fromId || !sdp) return;

  const peer = peers.get(fromId);
  if (!peer) return;

  try {
    await peer.pc.setRemoteDescription(sdp);
  } catch (error) {
    console.error('Handle rtc-answer failed', error);
  }
});

socket.on('rtc-ice-candidate', async ({ fromId, candidate }) => {
  if (!fromId || !candidate) return;

  const peer = peers.get(fromId);
  if (!peer) return;

  try {
    await peer.pc.addIceCandidate(candidate);
  } catch (error) {
    console.error('Handle rtc-ice-candidate failed', error);
  }
});

socket.on('state', (nextState) => {
  state = nextState;
  renderRole();
  renderStatus();
  renderReadyStatus();
  renderCount();
  renderTurnTimer();
  renderResultModal();
  renderReadyButton();
  render();
});

function ensurePeer(peerId) {
  if (!peerId) return null;

  if (peers.has(peerId)) {
    return peers.get(peerId);
  }

  const pc = new RTCPeerConnection(RTC_CONFIG);
  const audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  audioEl.playsInline = true;
  audioEl.dataset.peerId = peerId;
  audioContainer.appendChild(audioEl);

  const peer = { pc, audioEl };
  peers.set(peerId, peer);

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    socket.emit('rtc-ice-candidate', {
      targetId: peerId,
      candidate: event.candidate,
    });
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      peer.audioEl.srcObject = stream;
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      removePeer(peerId);
    }
  };

  if (localStream) {
    addLocalTracks(peer);
  }

  return peer;
}

function addLocalTracks(peer) {
  if (!localStream || !peer) return;

  const senders = peer.pc.getSenders();

  for (const track of localStream.getAudioTracks()) {
    const alreadyAdded = senders.some((sender) => sender.track === track);
    if (!alreadyAdded) {
      peer.pc.addTrack(track, localStream);
    }
  }
}

function removePeer(peerId) {
  const peer = peers.get(peerId);
  if (!peer) return;

  try {
    peer.pc.close();
  } catch {
    // ignore
  }

  if (peer.audioEl?.parentNode) {
    peer.audioEl.parentNode.removeChild(peer.audioEl);
  }

  peers.delete(peerId);
}

async function offerPeer(peerId) {
  if (!peerId) return;

  const peer = ensurePeer(peerId);
  if (!peer) return;

  if (localStream) {
    addLocalTracks(peer);
  }

  try {
    if (peer.pc.signalingState !== 'stable') return;

    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);

    socket.emit('rtc-offer', {
      targetId: peerId,
      sdp: peer.pc.localDescription,
    });
  } catch (error) {
    console.error('Offer peer failed', error);
  }
}

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

  if (state.phase !== 'playing') {
    if (!state.seats?.player1 || !state.seats?.player2) {
      statusText.textContent = '等待两位玩家入座…';
      return;
    }
    statusText.textContent = '等待双方点击准备…';
    return;
  }

  statusText.textContent = state.turn === 'B' ? '当前回合：1号玩家（黑棋）' : '当前回合：2号玩家（白棋）';
}

function renderReadyStatus() {
  if (state.phase === 'playing') {
    readyStatusText.textContent = '';
    return;
  }

  const bReady = state.ready?.B ? '已准备' : '未准备';
  const wReady = state.ready?.W ? '已准备' : '未准备';
  readyStatusText.textContent = `准备状态：1号玩家 ${bReady}｜2号玩家 ${wReady}`;
}

function renderCount() {
  countText.textContent = `玩家人数：${state.playerCount}，观战人数：${state.spectatorCount}`;
}

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = String(Math.floor(total / 60)).padStart(2, '0');
  const sec = String(total % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function renderTurnTimer() {
  if (state.phase !== 'playing') {
    timerText.textContent = '对局未开始（双方准备后自动开局）';
    return;
  }

  const elapsed = Date.now() - (state.turnStartedAt || Date.now());

  if (state.winner) {
    timerText.textContent = `本回合用时：${formatElapsed(elapsed)}（对局已结束）`;
    return;
  }

  const currentPlayer = state.turn === 'B' ? '1号玩家（黑棋）' : '2号玩家（白棋）';
  timerText.textContent = `${currentPlayer} 计时：${formatElapsed(elapsed)}`;
}

function renderResultModal() {
  if (!state.winner) {
    resultModal.classList.remove('show');
    return;
  }

  if (state.winner === 'B') {
    resultTitle.textContent = '1号玩家（黑棋）胜利！';
  } else {
    resultTitle.textContent = '2号玩家（白棋）胜利！';
  }

  if (role === 'B' || role === 'W') {
    resultHint.textContent = '点击“再来一局”后双方重新准备开局。';
    replayBtn.disabled = false;
  } else {
    resultHint.textContent = '等待玩家点击“再来一局”。';
    replayBtn.disabled = true;
  }

  resultModal.classList.add('show');
}

function render() {
  const size = PADDING * 2 + CELL * (boardSize - 1);
  boardCanvas.width = size;
  boardCanvas.height = size;

  boardCanvas.style.cursor = canMove() ? 'crosshair' : 'default';

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
  if (state.phase !== 'playing') return false;
  if (role !== 'B' && role !== 'W') return false;
  if (state.winner) return false;
  return role === state.turn;
}

function renderReadyButton() {
  if (role !== 'B' && role !== 'W') {
    readyBtn.disabled = true;
    readyBtn.textContent = '仅玩家可准备';
    return;
  }

  if (state.phase === 'playing') {
    readyBtn.disabled = true;
    readyBtn.textContent = '对局进行中';
    return;
  }

  readyBtn.disabled = false;

  const myReady = role === 'B' ? state.ready?.B : state.ready?.W;
  readyBtn.textContent = myReady ? '取消准备' : '我已准备';
}

function renderMicButton() {
  if (!isSecureAudioSupported) {
    micBtn.disabled = true;
    micBtn.textContent = '麦克风不可用';
    voiceStatusText.textContent = '语音功能需要 HTTPS（或 localhost）环境';
    return;
  }

  micBtn.disabled = false;
  micBtn.textContent = micEnabled ? '关闭麦克风' : '打开麦克风';
  voiceStatusText.textContent = micEnabled
    ? '语音中：房间内其他人可听到你'
    : '语音关闭：点击“打开麦克风”开始讲话';
}

async function enableMic() {
  if (!isSecureAudioSupported) {
    renderMicButton();
    return;
  }

  try {
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    }

    for (const track of localStream.getAudioTracks()) {
      track.enabled = true;
    }

    micEnabled = true;
    renderMicButton();

    for (const peerId of knownPeerIds) {
      await offerPeer(peerId);
    }
  } catch (error) {
    console.error('Enable mic failed', error);
    voiceStatusText.textContent = '麦克风权限被拒绝或设备不可用';
    micEnabled = false;
    renderMicButton();
  }
}

function disableMic() {
  if (localStream) {
    for (const track of localStream.getAudioTracks()) {
      track.enabled = false;
    }
  }

  micEnabled = false;
  renderMicButton();
}

function cleanupVoice() {
  if (localStream) {
    for (const track of localStream.getTracks()) {
      track.stop();
    }
  }

  for (const peerId of peers.keys()) {
    removePeer(peerId);
  }
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

readyBtn.addEventListener('click', () => {
  if (role === 'B' || role === 'W') {
    socket.emit('toggle-ready');
  }
});

replayBtn.addEventListener('click', () => {
  if (role === 'B' || role === 'W') {
    socket.emit('restart');
  }
});

micBtn.addEventListener('click', async () => {
  if (micEnabled) {
    disableMic();
    return;
  }

  await enableMic();
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

window.addEventListener('beforeunload', cleanupVoice);

setInterval(renderTurnTimer, 1000);

renderRole();
renderStatus();
renderReadyStatus();
renderCount();
renderTurnTimer();
renderResultModal();
renderReadyButton();
renderMicButton();
render();
