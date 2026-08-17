const http = require('http');
const express = require('express');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentUsername = null;

  socket.on('create_room', ({ username }) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    currentRoomId = roomId;
    currentUsername = username;

    rooms[roomId] = {
      roomId,
      host: socket.id,
      gameStarted: false,
      gameMode: 'liar',
      options: {
        liarTime: 25,
        liarCategory: 'all',
        mafiaDayTime: 60,
        mafiaCount: 1,
        policeCount: 1,
        doctorCount: 1,
        shiritoriMinLen: 2,
        choseongTargetScore: 15
      },
      players: [{ id: socket.id, username, isDead: false }],
      rpsChoices: {},
      // 끝말잇기용 데이터 관리 필드 추가
      usedWords: [],
      lastWord: ''
    };

    socket.join(roomId);
    socket.emit('join_success', { roomId });
    io.to(roomId).emit('update_room', rooms[roomId]);
    io.to(roomId).emit('system_message', `${username}님이 방을 만들었습니다.`);
  });

  socket.on('join_room', ({ roomId, username }) => {
    const room = rooms[roomId];
    if (!room) {
      return socket.emit('system_message', '존재하지 않는 방 코드입니다.');
    }
    if (room.gameStarted) {
      return socket.emit('system_message', '이미 게임이 시작된 방입니다.');
    }

    currentRoomId = roomId;
    currentUsername = username;
    room.players.push({ id: socket.id, username, isDead: false });

    socket.join(roomId);
    socket.emit('join_success', { roomId });
    io.to(roomId).emit('update_room', room);
    io.to(roomId).emit('system_message', `${username}님이 입장했습니다.`);
  });

  socket.on('leave_room', () => {
    handleLeaveRoom(socket);
  });

  socket.on('disconnect', () => {
    handleLeaveRoom(socket);
  });

  function handleLeaveRoom(sock) {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    room.players = room.players.filter(p => p.id !== sock.id);

    if (room.players.length === 0) {
      delete rooms[currentRoomId];
    } else {
      if (room.host === sock.id) {
        room.host = room.players[0].id;
        io.to(currentRoomId).emit('system_message', `방장이 ${room.players[0].username}님으로 변경되었습니다.`);
      }
      io.to(currentRoomId).emit('update_room', room);
    }
    sock.leave(currentRoomId);
    currentRoomId = null;
    currentUsername = null;
  }

  socket.on('change_game_mode', ({ roomId, gameMode }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id) {
      room.gameMode = gameMode;
      io.to(roomId).emit('update_room', room);
    }
  });

  socket.on('update_options', ({ roomId, options }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id) {
      room.options = { ...room.options, ...options };
      io.to(roomId).emit('update_room', room);
    }
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id) {
      room.gameStarted = true;
      room.rpsChoices = {};
      room.usedWords = [];
      room.lastWord = '';
      io.to(roomId).emit('update_room', room);
      io.to(roomId).emit('start_game_ui', { gameMode: room.gameMode });
      io.to(roomId).emit('system_message', `게임(${room.gameMode.toUpperCase()})이 시작되었습니다!`);
    }
  });

  socket.on('end_game_by_host', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id) {
      room.gameStarted = false;
      const sortedScores = room.players.map((p, index) => ({
        username: p.username,
        score: Math.max(10, 30 - index * 5)
      })).sort((a, b) => b.score - a.score);

      io.to(roomId).emit('show_final_ranking', sortedScores);
      io.to(roomId).emit('update_room', room);
    }
  });

  socket.on('send_message', ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    const isDead = player ? player.isDead : false;
    io.to(roomId).emit('receive_message', { username: currentUsername, message, isDead });
  });

  socket.on('trigger_rps', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id) {
      room.rpsChoices = {};
      io.to(roomId).emit('show_rps_buttons');
      io.to(roomId).emit('system_message', '가위바위보가 시작되었습니다! 버튼을 눌러주세요.');
    }
  });

  socket.on('play_rps', ({ roomId, choice }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.rpsChoices[socket.id] = { username: currentUsername, choice };

    if (Object.keys(room.rpsChoices).length === room.players.length) {
      const playerIds = Object.keys(room.rpsChoices);
      const randomWinnerKey = playerIds[Math.floor(Math.random() * playerIds.length)];
      const winnerName = room.rpsChoices[randomWinnerKey].username;

      io.to(roomId).emit('rps_result', { winner: winnerName });
      io.to(roomId).emit('system_message', `가위바위보 결과! 승리자: ${winnerName}님`);
    }
  });

  // 끝말잇기 단어 입력 검증 로직 (최소 글자수, 중복 단어, 앞글자 일치 확인)
  socket.on('game_input_word', ({ roomId, word }) => {
    const room = rooms[roomId];
    if (!room) return;

    const trimmedWord = word.trim();
    const minLen = room.options.shiritoriMinLen || 2;

    // 1. 최소 글자수 검증
    if (trimmedWord.length < minLen) {
      return socket.emit('system_message', `[오류] 단어는 ${minLen}글자 이상이어야 합니다.`);
    }

    // 2. 이미 사용된 단어인지 중복 검증
    if (room.usedWords.includes(trimmedWord)) {
      return socket.emit('system_message', `[오류] 이미 사용된 단어입니다: "${trimmedWord}"`);
    }

    // 3. 끝말잇기 규칙 검증 (첫 단어가 아닐 경우)
    if (room.lastWord.length > 0) {
      const lastChar = room.lastWord.slice(-1);
      const firstChar = trimmedWord.charAt(0);
      if (lastChar !== firstChar) {
        return socket.emit('system_message', `[오류] "${lastChar}(으)로 시작하는 단어를 입력해야 합니다.`);
      }
    }

    // 검증 통과 시 처리
    room.usedWords.push(trimmedWord);
    room.lastWord = trimmedWord;

    io.to(roomId).emit('update_game_word', { username: currentUsername, word: trimmedWord });
    io.to(roomId).emit('system_message', `[끝말잇기] ${currentUsername}님 입력 성공: ${trimmedWord} (사용된 단어: ${room.usedWords.join(', ')})`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
