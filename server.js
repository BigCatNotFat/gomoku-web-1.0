const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const BOARD_SIZE = 15;

const rooms = new Map();

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function createRoom() {
  return {
    board: createEmptyBoard(),
    turn: 'B',
    turnStartedAt: Date.now(),
    winner: null,
    players: {
      B: null,
      W: null,
    },
    sockets: new Set(),
  };
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom());
  }
  return rooms.get(roomId);
}

function assignRole(room, socketId) {
  if (!room.players.B) {
    room.players.B = socketId;
    return 'B';
  }
  if (!room.players.W) {
    room.players.W = socketId;
    return 'W';
  }
  return 'S';
}

function serializeRoom(room) {
  const playerCount = Number(Boolean(room.players.B)) + Number(Boolean(room.players.W));
  const spectatorCount = Math.max(room.sockets.size - playerCount, 0);

  return {
    board: room.board,
    turn: room.turn,
    turnStartedAt: room.turnStartedAt,
    winner: room.winner,
    playerCount,
    spectatorCount,
    seats: {
      player1: Boolean(room.players.B),
      player2: Boolean(room.players.W),
    },
  };
}

function checkWin(board, x, y, color) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  for (const [dx, dy] of directions) {
    let count = 1;

    let i = x + dx;
    let j = y + dy;
    while (i >= 0 && i < BOARD_SIZE && j >= 0 && j < BOARD_SIZE && board[j][i] === color) {
      count += 1;
      i += dx;
      j += dy;
    }

    i = x - dx;
    j = y - dy;
    while (i >= 0 && i < BOARD_SIZE && j >= 0 && j < BOARD_SIZE && board[j][i] === color) {
      count += 1;
      i -= dx;
      j -= dy;
    }

    if (count >= 5) {
      return true;
    }
  }

  return false;
}

app.use(express.static(__dirname));

app.get('/', (_req, res) => {
  res.redirect('/room/lobby');
});

app.get('/room/:roomId', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  const roomIdRaw = socket.handshake.query.roomId;
  const roomId = typeof roomIdRaw === 'string' && roomIdRaw.trim() ? roomIdRaw.trim() : 'lobby';
  const room = getRoom(roomId);

  socket.join(roomId);
  room.sockets.add(socket.id);

  const role = assignRole(room, socket.id);

  socket.data.roomId = roomId;
  socket.data.role = role;

  socket.emit('joined', {
    role,
    roomId,
    boardSize: BOARD_SIZE,
  });

  io.to(roomId).emit('state', serializeRoom(room));

  socket.on('place', ({ x, y }) => {
    const { role: currentRole, roomId: currentRoomId } = socket.data;
    const currentRoom = rooms.get(currentRoomId);
    if (!currentRoom) return;

    if (currentRole !== 'B' && currentRole !== 'W') return;
    if (currentRoom.winner) return;
    if (currentRoom.turn !== currentRole) return;

    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return;
    if (currentRoom.board[y][x] !== null) return;

    currentRoom.board[y][x] = currentRole;

    if (checkWin(currentRoom.board, x, y, currentRole)) {
      currentRoom.winner = currentRole;
    } else {
      currentRoom.turn = currentRole === 'B' ? 'W' : 'B';
      currentRoom.turnStartedAt = Date.now();
    }

    io.to(currentRoomId).emit('state', serializeRoom(currentRoom));
  });

  socket.on('restart', () => {
    const { role: currentRole, roomId: currentRoomId } = socket.data;
    if (currentRole !== 'B' && currentRole !== 'W') return;

    const currentRoom = rooms.get(currentRoomId);
    if (!currentRoom) return;

    currentRoom.board = createEmptyBoard();
    currentRoom.turn = 'B';
    currentRoom.turnStartedAt = Date.now();
    currentRoom.winner = null;

    io.to(currentRoomId).emit('state', serializeRoom(currentRoom));
  });

  socket.on('disconnect', () => {
    const { role: currentRole, roomId: currentRoomId } = socket.data;
    const currentRoom = rooms.get(currentRoomId);
    if (!currentRoom) return;

    currentRoom.sockets.delete(socket.id);

    if (currentRole === 'B' && currentRoom.players.B === socket.id) {
      currentRoom.players.B = null;
    }

    if (currentRole === 'W' && currentRoom.players.W === socket.id) {
      currentRoom.players.W = null;
    }

    if (currentRoom.sockets.size === 0) {
      rooms.delete(currentRoomId);
      return;
    }

    io.to(currentRoomId).emit('state', serializeRoom(currentRoom));
  });
});

server.listen(PORT, () => {
  console.log(`Gomoku server listening on port ${PORT}`);
});
