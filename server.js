const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

const rooms = {};

function generateRoomCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms[code]);
  return code;
}

const LIAR_WORDS = {
  '음식': ['떡볶이', '김치찌개', '돈까스', '짜장면', '마라탕', '삼겹살'],
  '동물': ['호랑이', '사자', '기린', '코끼리', '판다', '강아지']
};

const CHOSEONG_DATA = [
  { choseong: 'ㄱㅇ', word: '고양이' }, { choseong: 'ㅅㄱ', word: '사과' },
  { choseong: 'ㅎㄴ', word: '하늘' }, { choseong: 'ㅋㅍ', word: '커피' }
];

io.on('connection', (socket) => {
  // 1. 방 생성
  socket.on('create_room', ({ username }) => {
    if (!username) return;
    const roomId = generateRoomCode();

    rooms[roomId] = {
      players: [], // { id, username, isAlive, role }
      host: socket.id,
      gameMode: 'mafia', // liar, shiritori, choseong, mafia
      gameStarted: false,
      
      // 라이어 관련
      liarCategory: '음식',
      keyword: '',
      liarId: null,
      liarVotes: {},
      speakingOrder: [],
      currentTurnIndex: 0,
      turnCount: 0,

      // 끝말잇기 관련
      shiritoriTime: 10,
      shiritoriLen: 2,
      currentWord: '',
      shiritoriTurnIndex: 0,
      shiritoriTimer: null,

      // 초성 퀴즈 관련
      targetScore: 5,
      scores: {},
      currentChoseongObj: null,

      // 마피아 관련
      phase: 'WAITING', // DAY_TALK, DAY_VOTE, NIGHT
      nightActions: { mafia: null, doctor: null, police: null },
      dayVotes: {}
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    rooms[roomId].players.push({ id: socket.id, username, isAlive: true, role: null });
    rooms[roomId].scores[socket.id] = 0;

    socket.emit('join_success', { roomId, username });
    broadcastRoomState(roomId);
  });

  // 2. 방 참가
  socket.on('join_room', ({ roomId, username }) => {
    if (!roomId || !username) return;
    const room = rooms[roomId];
    if (!room || room.gameStarted) return;

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    room.players.push({ id: socket.id, username, isAlive: true, role: null });
    room.scores[socket.id] = 0;

    socket.emit('join_success', { roomId, username });
    broadcastRoomState(roomId);
  });

  // 3. 방 나가기
  socket.on('leave_room', () => handleLeave(socket));

  // 4. 게임 시작
  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    // A. 라이어 게임
    if (room.gameMode === 'liar') {
      if (room.players.length < 3) return;
      room.gameStarted = true;
      room.liarVotes = {};
      room.turnCount = 0;
      room.currentTurnIndex = 0;
      room.speakingOrder = [...room.players].sort(() => Math.random() - 0.5);

      const words = LIAR_WORDS[room.liarCategory];
      room.keyword = words[Math.floor(Math.random() * words.length)];
      const liarIndex = Math.floor(Math.random() * room.players.length);
      room.liarId = room.players[liarIndex].id;

      room.players.forEach((p) => {
        if (p.id === room.liarId) {
          io.to(p.id).emit('system_message', `🕵️ 당신은 [라이어]입니다!`);
        } else {
          io.to(p.id).emit('system_message', `🔑 제시어: [${room.keyword}]`);
        }
      });

      io.to(roomId).emit('game_started', { mode: 'liar' });
      io.to(roomId).emit('update_turn', { currentTurnPlayer: room.speakingOrder[0].username });
    } 
    // B. 끝말잇기
    else if (room.gameMode === 'shiritori') {
      if (room.players.length < 2) return;
      room.gameStarted = true;
      room.shiritoriTurnIndex = 0;
      room.currentWord = '사과';
      
      io.to(roomId).emit('game_started', { mode: 'shiritori', currentWord: room.currentWord });
      startShiritoriTimer(roomId);
    }
    // C. 초성 퀴즈
    else if (room.gameMode === 'choseong') {
      if (room.players.length < 2) return;
      room.gameStarted = true;
      room.players.forEach(p => room.scores[p.id] = 0);
      io.to(roomId).emit('game_started', { mode: 'choseong' });
      nextChoseongQuestion(roomId);
    }
    // D. 마피아 게임
    else if (room.gameMode === 'mafia') {
      if (room.players.length < 4) return socket.emit('system_message', '⚠️ 마피아 게임은 최소 4명 이상 필요합니다.');
      room.gameStarted = true;
      
      // 역할 부여 (마피아 1, 의사 1, 경찰 1, 나머지 시민)
      const roles = ['mafia', 'doctor', 'police'];
      while (roles.length < room.players.length) roles.push('citizen');
      roles.sort(() => Math.random() - 0.5);

      room.players.forEach((p, idx) => {
        p.isAlive = true;
        p.role = roles[idx];
        io.to(p.id).emit('system_message', `🎭 당신의 역할은 [${p.role}]입니다.`);
      });

      startMafiaDay(roomId);
    }
  });

  // 5. 채팅 및 턴 발언
  socket.on('send_message', ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;

    const sender = room.players.find(p => p.id === socket.id);
    if (!sender) return;

    // 라이어 게임 턴 제어 (1턴 완료 후 투표)
    if (room.gameStarted && room.gameMode === 'liar') {
      const currentPlayer = room.speakingOrder[room.currentTurnIndex];
      if (socket.id === currentPlayer.id) {
        io.to(roomId).emit('receive_message', { username: sender.username, message });
        room.turnCount++;
        room.currentTurnIndex++;

        if (room.turnCount >= room.players.length) {
          io.to(roomId).emit('system_message', `\n✅ 모든 플레이어가 1턴 발언을 마쳤습니다. 라이어 투표를 시작합니다!`);
          io.to(roomId).emit('start_liar_voting_phase', { players: room.players });
        } else {
          const nextPlayer = room.speakingOrder[room.currentTurnIndex];
          io.to(roomId).emit('update_turn', { currentTurnPlayer: nextPlayer.username });
        }
        return;
      } else {
        return socket.emit('system_message', `⚠️ 지금은 [${currentPlayer.username}]님의 발언 순서입니다.`);
      }
    }

    // 끝말잇기
    if (room.gameStarted && room.gameMode === 'shiritori') {
      const currentPlayer = room.players[room.shiritoriTurnIndex];
      if (socket.id === currentPlayer.id) {
        const lastChar = room.currentWord.slice(-1);
        const firstChar = message.trim().charAt(0);

        if (firstChar === lastChar && message.trim().length === room.shiritoriLen) {
          clearInterval(room.shiritoriTimer);
          room.currentWord = message.trim();
          room.shiritoriTurnIndex = (room.shiritoriTurnIndex + 1) % room.players.length;

          io.to(roomId).emit('shiritori_success', {
            word: room.currentWord,
            nextTurn: room.players[room.shiritoriTurnIndex].username,
            sender: sender.username
          });
          startShiritoriTimer(roomId);
          return;
        }
      }
    }

    // 초성 퀴즈
    if (room.gameStarted && room.gameMode === 'choseong' && room.currentChoseongObj) {
      if (message.trim() === room.currentChoseongObj.word) {
        room.scores[socket.id] = (room.scores[socket.id] || 0) + 1;
        io.to(roomId).emit('system_message', `🎉 [${sender.username}]님 정답! (${room.currentChoseongObj.word})`);

        if (room.scores[socket.id] >= room.targetScore) {
          room.gameStarted = false;
          io.to(roomId).emit('game_over', { winner: sender.username, reason: '목표 점수 달성!' });
        } else {
          nextChoseongQuestion(roomId);
        }
        return;
      }
    }

    // 일반 채팅 및 마피아 대화 (죽은 유저 제한)
    if (room.gameMode === 'mafia' && !sender.isAlive) {
      return socket.emit('system_message', '⚠️ 생존자만 대화할 수 있습니다.');
    }

    io.to(roomId).emit('receive_message', { username: sender.username, message });
  });

  // 6. 라이어 투표
  socket.on('submit_liar_vote', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.gameMode !== 'liar') return;

    room.liarVotes[socket.id] = targetId;

    if (Object.keys(room.liarVotes).length === room.players.length) {
      const voteCounts = {};
      Object.values(room.liarVotes).forEach(tid => { voteCounts[tid] = (voteCounts[tid] || 0) + 1; });

      let maxVotes = 0, votedTargetId = null;
      for (const [tid, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) { maxVotes = count; votedTargetId = tid; }
      }

      const isLiarCaught = votedTargetId === room.liarId;
      room.gameStarted = false;
      io.to(roomId).emit('game_over', {
        winner: isLiarCaught ? '시민팀' : '라이어',
        reason: isLiarCaught ? '라이어를 지목했습니다!' : '라이어 지목에 실패했습니다.'
      });
    }
  });

  // 7. 마피아 낮 투표 및 밤 능력 사용
  socket.on('mafia_vote_day', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'DAY_VOTE') return;

    room.dayVotes[socket.id] = targetId;
    const alivePlayers = room.players.filter(p => p.isAlive);

    if (Object.keys(room.dayVotes).length === alivePlayers.length) {
      const voteCounts = {};
      Object.values(room.dayVotes).forEach(tid => { voteCounts[tid] = (voteCounts[tid] || 0) + 1; });

      let maxVotes = 0, executedId = null;
      for (const [tid, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) { maxVotes = count; executedId = tid; }
      }

      const executedPlayer = room.players.find(p => p.id === executedId);
      if (executedPlayer) {
        executedPlayer.isAlive = false;
        io.to(roomId).emit('system_message', `☠️ 투표로 인해 [${executedPlayer.username}]님이 처형되었습니다.`);
      }

      if (!checkMafiaWinCondition(roomId)) {
        startMafiaNight(roomId);
      }
    }
  });

  socket.on('mafia_night_action', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'NIGHT') return;

    const sender = room.players.find(p => p.id === socket.id);
    if (!sender || !sender.isAlive) return;

    if (sender.role === 'mafia') room.nightActions.mafia = targetId;
    if (sender.role === 'doctor') room.nightActions.doctor = targetId;
    if (sender.role === 'police') {
      const target = room.players.find(p => p.id === targetId);
      socket.emit('system_message', `🔍 [${target.username}]님은 ${target.role === 'mafia' ? '마피아입니다!' : '마피아가 아닙니다.'}`);
      room.nightActions.police = targetId;
    }

    const aliveMafia = room.players.filter(p => p.isAlive && p.role === 'mafia').length;
    const aliveDoctor = room.players.filter(p => p.isAlive && p.role === 'doctor').length;
    const alivePolice = room.players.filter(p => p.isAlive && p.role === 'police').length;

    let requiredActions = 0;
    if (aliveMafia > 0) requiredActions++;
    if (aliveDoctor > 0) requiredActions++;
    if (alivePolice > 0) requiredActions++;

    let currentActions = 0;
    if (room.nightActions.mafia) currentActions++;
    if (room.nightActions.doctor) currentActions++;
    if (room.nightActions.police) currentActions++;

    if (currentActions >= requiredActions) {
      resolveMafiaNight(roomId);
    }
  });

  socket.on('disconnect', () => handleLeave(socket));
});

function handleLeave(socket) {
  const roomId = socket.roomId;
  if (!roomId || !rooms[roomId]) return;

  const room = rooms[roomId];
  room.players = room.players.filter(p => p.id !== socket.id);
  delete room.scores[socket.id];

  if (room.players.length === 0) {
    if (room.shiritoriTimer) clearInterval(room.shiritoriTimer);
    delete rooms[roomId];
  } else {
    if (room.host === socket.id) room.host = room.players[0].id;
    if (room.gameStarted && room.players.length < 2) {
      room.gameStarted = false;
      if (room.shiritoriTimer) clearInterval(room.shiritoriTimer);
      io.to(roomId).emit('system_message', `⚠️ 인원 부족으로 게임이 중단되었습니다.`);
    }
    broadcastRoomState(roomId);
  }
  socket.leave(roomId);
  socket.roomId = null;
}

function broadcastRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('update_room', {
    roomId, players: room.players, host: room.host, gameMode: room.gameMode, gameStarted: room.gameStarted
  });
}

function startShiritoriTimer(roomId) {
  const room = rooms[roomId];
  let timeLeft = room.shiritoriTime;
  io.to(roomId).emit('timer_tick', { timeLeft });
  if (room.shiritoriTimer) clearInterval(room.shiritoriTimer);

  room.shiritoriTimer = setInterval(() => {
    timeLeft--;
    io.to(roomId).emit('timer_tick', { timeLeft });
    if (timeLeft <= 0) {
      clearInterval(room.shiritoriTimer);
      const loser = room.players[room.shiritoriTurnIndex].username;
      room.gameStarted = false;
      io.to(roomId).emit('game_over', { loser, reason: '시간 초과' });
    }
  }, 1000);
}

function nextChoseongQuestion(roomId) {
  const room = rooms[roomId];
  const randIndex = Math.floor(Math.random() * CHOSEONG_DATA.length);
  room.currentChoseongObj = CHOSEONG_DATA[randIndex];
  io.to(roomId).emit('choseong_question', {
    choseong: room.currentChoseongObj.choseong, scores: room.scores, players: room.players
  });
}

function startMafiaDay(roomId) {
  const room = rooms[roomId];
  room.phase = 'DAY_TALK';
  room.dayVotes = {};
  io.to(roomId).emit('system_message', `☀️ 낮이 되었습니다. 자유롭게 토론하세요.`);
  
  setTimeout(() => {
    room.phase = 'DAY_VOTE';
    io.to(roomId).emit('system_message', `🗳️ 토론 종료! 마피아로 의심되는 사람에게 투표하세요.`);
    io.to(roomId).emit('start_mafia_vote', { alivePlayers: room.players.filter(p => p.isAlive) });
  }, 15000);
}

function startMafiaNight(roomId) {
  const room = rooms[roomId];
  room.phase = 'NIGHT';
  room.nightActions = { mafia: null, doctor: null, police: null };
  io.to(roomId).emit('system_message', `🌙 밤이 되었습니다. 각 특수 직업은 능력을 사용하세요.`);
}

function resolveMafiaNight(roomId) {
  const room = rooms[roomId];
  const killedId = room.nightActions.mafia;
  const savedId = room.nightActions.doctor;

  if (killedId && killedId !== savedId) {
    const killedPlayer = room.players.find(p => p.id === killedId);
    if (killedPlayer) {
      killedPlayer.isAlive = false;
      io.to(roomId).emit('system_message', `☠️ 밤 사이에 [${killedPlayer.username}]님이 마피아에게 습격당했습니다.`);
    }
  } else {
    io.to(roomId).emit('system_message', `🛡️ 의사의 치료로 밤 사이에 아무도 희생되지 않았습니다.`);
  }

  if (!checkMafiaWinCondition(roomId)) {
    startMafiaDay(roomId);
  }
}

function checkMafiaWinCondition(roomId) {
  const room = rooms[roomId];
  const alivePlayers = room.players.filter(p => p.isAlive);
  const mafiaCount = alivePlayers.filter(p => p.role === 'mafia').length;
  const citizenCount = alivePlayers.length - mafiaCount;

  if (mafiaCount === 0) {
    room.gameStarted = false;
    io.to(roomId).emit('game_over', { winner: '시민팀', reason: '모든 마피아를 제거했습니다!' });
    return true;
  }
  if (mafiaCount >= citizenCount) {
    room.gameStarted = false;
    io.to(roomId).emit('game_over', { winner: '마피아팀', reason: '마피아 수가 시민 수와 같거나 많아졌습니다!' });
    return true;
  }
  return false;
}

server.listen(3000, () => console.log('서버 실행 중: http://localhost:3000'));
