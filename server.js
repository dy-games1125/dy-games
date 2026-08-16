const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Render 환경변수 포트 지원
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const rooms = {};
const WORD_LIST = ['사과', '바나나', '피자', '비행기', '호랑이', '축구', '자전거', '피아노', '스마트폰', '영화관'];

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  socket.on('createRoom', (nickname) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      code: roomCode,
      hostId: socket.id,
      players: {},
      state: 'LOBBY',
      liarId: null,
      word: ''
    };

    rooms[roomCode].players[socket.id] = {
      id: socket.id,
      nickname: nickname || '플레이어 1'
    };

    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('roomCreated', { roomCode, playerId: socket.id });
    io.to(roomCode).emit('updateRoom', rooms[roomCode]);
  });

  socket.on('joinRoom', ({ nickname, roomCode }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];

    if (!room) {
      socket.emit('errorMsg', '존재하지 않는 방 코드입니다.');
      return;
    }

    const playerKeys = Object.keys(room.players);
    if (playerKeys.length >= 8) {
      socket.emit('errorMsg', '방이 가득 찼습니다. (최대 8명)');
      return;
    }

    room.players[socket.id] = {
      id: socket.id,
      nickname: nickname || `플레이어 ${playerKeys.length + 1}`
    };

    socket.join(code);
    socket.roomCode = code;

    socket.emit('roomJoined', { roomCode: code, playerId: socket.id });
    io.to(code).emit('updateRoom', room);
  });

  socket.on('startGame', () => {
    const code = socket.roomCode;
    const room = rooms[code];

    if (!room || room.hostId !== socket.id) return;
    const playerIds = Object.keys(room.players);

    if (playerIds.length < 3) {
      socket.emit('errorMsg', '최소 3명 이상이어야 시작할 수 있습니다.');
      return;
    }

    room.state = 'PLAYING';
    room.liarId = playerIds[Math.floor(Math.random() * playerIds.length)];
    room.word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];

    playerIds.forEach((id) => {
      const isLiar = id === room.liarId;
      io.to(id).emit('gameStarted', {
        isLiar,
        word: isLiar ? '라이어' : room.word
      });
    });

    io.to(code).emit('updateRoom', room);
  });

  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (code && rooms[code]) {
      delete rooms[code].players[socket.id];
      if (rooms[code].hostId === socket.id) {
        const remaining = Object.keys(rooms[code].players);
        if (remaining.length > 0) rooms[code].hostId = remaining[0];
      }
      if (Object.keys(rooms[code].players).length === 0) {
        delete rooms[code];
      } else {
        io.to(code).emit('updateRoom', rooms[code]);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`서버 실행 중: 포트 ${PORT}`);
});