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
      usedWords: [],
      lastWord: '',
      turnIndex: 0 // 턴 순서 관리 필드 추가
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
      room.turnIndex = 0;
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

  // 가위바위보 비김 처리 및 승자 결정 로직 수정
  socket.on('play_rps', ({ roomId, choice }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.rpsChoices[socket.id] = { username: currentUsername, choice };

    // 모든 플레이어가 가위바위보를 냈을 때
    if (Object.keys(room.rpsChoices).length === room.players.length) {
      const choicesArr = Object.values(room.rpsChoices);
      const uniqueChoices = [...new Set(choicesArr.map(item => item.choice))];

      // 모두 같은 것을 냈거나(3개 다 나오거나), 모두 비긴 경우 재경기 처리
      if (uniqueChoices.length === 3 || uniqueChoices.length === 1) {
        room.rpsChoices = {};
        io.to(roomId).emit('rps_draw', { message: '가위바위보가 비겼습니다! 다시 선택해주세요.' });
        return;
      }

      // 승자 판별 로직 (가위(scissors) > 보(paper) > 바위(rock) > 가위(scissors))
      let winningChoice = '';
      if (uniqueChoices.includes('scissors') && uniqueChoices.includes('paper')) winningChoice = 'scissors';
      else if (uniqueChoices.includes('paper') && uniqueChoices.includes('rock')) winningChoice = 'paper';
      else if (uniqueChoices.includes('rock') && uniqueChoices.includes('scissors')) winningChoice = 'rock';

      const winners = room.players.filter(p => room.rpsChoices[p.id] && room.rpsChoices[p.id].choice === winningChoice);

      if (winners.length === 1) {
        // 단독 승자 발생
        const winner = winners[0];
        room.turnIndex = room.players.findIndex(p => p.id === winner.id);
        
        io.to(roomId).emit('rps_result', { winner: winner.username, nextTurnId: winner.id });
        io.to(roomId).emit('system_message', `가위바위보 승리자: ${winner.username}님! 첫 번째 순서로 시작합니다.`);
      } else {
        // 여러 명이 이긴 경우 그들 중에서 랜덤 한 명 선택
        room.rpsChoices = {};
        io.to(roomId).emit('rps_draw', { message: '승자가 여러 명입니다! 다시 가위바위보를 진행합니다.' });
      }
    }
  });

  // 순서 강제 및 단어 공유/검증 로직 수정
  socket.on('game_input_word', ({ roomId, word }) => {
    const room = rooms[roomId];
    if (!room) return;

    const currentPlayer = room.players[room.turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) {
      return socket.emit('system_message', '[오류] 현재 차례가 아닙니다!');
    }

    const trimmedWord = word.trim();
    const minLen = room.options.shiritoriMinLen || 2;

    // 1. 최소 글자수 검증
    if (trimmedWord.length < minLen) {
      return socket.emit('system_message', `[오류] 단어는 ${minLen}글자 이상이어야 합니다.`);
    }

    // 2. 중복 단어 검증
    if (room.usedWords.includes(trimmedWord)) {
      return socket.emit('system_message', `[오류] 이미 사용된 단어입니다: "${trimmedWord}"`);
    }

    // 3. 끝말잇기 앞글자 일치 검증
    if (room.lastWord.length > 0) {
      const lastChar = room.lastWord.slice(-1);
      const firstChar = trimmedWord.charAt(0);
      if (lastChar !== firstChar) {
        return socket.emit('system_message', `[오류] "${lastChar}"(으)로 시작하는 단어를 입력해야 합니다.`);
      }
    }

    // 검증 통과 후 상태 갱신
    room.usedWords.push(trimmedWord);
    room.lastWord = trimmedWord;

    // 다음 차례로 턴 넘기기
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    const nextPlayer = room.players[room.turnIndex];

    // 모든 참가자에게 단어와 다음 턴 정보 브로드캐스팅 (단어 공유 안되던 문제 해결)
    io.to(roomId).emit('update_game_word', { 
      username: currentUsername, 
      word: trimmedWord, 
      nextTurnId: nextPlayer.id, 
      nextTurnName: nextPlayer.username,
      usedWords: room.usedWords 
    });
    io.to(roomId).emit('system_message', `[진행] ${currentUsername}님 입력: ${trimmedWord} -> 다음 차례: ${nextPlayer.username}님`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
