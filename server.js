const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};
const MAX_PLAYERS = 18; // 마피아 포함 최대 18명 확장

// 라이어 게임 카테고리 및 단어
const WORD_CATEGORIES = {
  '음식': ['사과', '바나나', '피자', '치킨', '삼겹살', '떡볶이', '마라탕', '초밥', '햄버거', '파스타', '짜장면', '돈까스', '아메리카노'],
  '동물': ['강아지', '고양이', '호랑이', '사자', '코끼리', '기린', '판다', '펭귄', '독수리', '돌고래', '햄스터', '토끼'],
  '장소': ['학교', '병원', '공항', '놀이공원', '영화관', '도서관', '해수욕장', '카페', '편의점', '지하철역', '미술관'],
  '직업': ['경찰관', '소방관', '의사', '교사', '요리사', '운동선수', '가수', '배우', '화가', '판사', '비행기조종사']
};

// 초성 게임 문제 데이터
const INITIAL_QUIZ_DATA = [
  { category: 'K-POP/가수', initial: 'ㅂㅌㅅㄴㄷ', answer: '방탄소년단' },
  { category: 'K-POP/가수', initial: 'ㅇㅇㅂ', answer: '아이브' },
  { category: 'K-POP/가수', initial: 'ㄴㅈㅅ', answer: '뉴진스' },
  { category: '음식/간식', initial: 'ㄸㅂㅇ', answer: '떡볶이' },
  { category: '음식/간식', initial: 'ㅁㄹㅌ', answer: '마라탕' },
  { category: '음식/간식', initial: 'ㅎㅂㄱ', answer: '햄버거' },
  { category: '애니/캐릭터', initial: 'ㅍㅋㅊ', answer: '피카츄' },
  { category: '애니/캐릭터', initial: 'ㅃㄹㄹ', answer: '뽀로로' },
  { category: '학교/학업', initial: 'ㄱㅅ', answer: '급식' },
  { category: '학교/학업', initial: 'ㅁㅈ', answer: '매점' }
];

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// 두음법칙 자동 변환 함수 (끝말잇기용)
function getValidNextLetters(lastChar) {
  const letters = [lastChar];
  const code = lastChar.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11172) return letters;

  const initial = Math.floor(code / 588);
  const medial = Math.floor((code % 588) / 28);
  const final = code % 28;

  if (initial === 5) { // 'ㄹ' -> 'ㄴ' 또는 'ㅇ'
    if ([2, 3, 4, 12, 17, 18].includes(medial)) {
      letters.push(String.fromCharCode(0xAC00 + (11 * 588) + (medial * 28) + final));
    } else {
      letters.push(String.fromCharCode(0xAC00 + (2 * 588) + (medial * 28) + final));
    }
  } else if (initial === 2) { // 'ㄴ' -> 'ㅇ'
    if ([2, 3, 4, 12, 17, 18].includes(medial)) {
      letters.push(String.fromCharCode(0xAC00 + (11 * 588) + (medial * 28) + final));
    }
  }
  return letters;
}

io.on('connection', (socket) => {

  // 방 생성
  socket.on('create_room', (nickname) => {
    const roomCode = generateRoomCode();
    const name = nickname.trim() || `플레이어_${socket.id.substring(0, 4)}`;

    rooms[roomCode] = {
      code: roomCode,
      hostId: socket.id,
      gameMode: 'LIAR', // 'LIAR', 'MAFIA', 'WORDCHAIN', 'INITIAL'
      players: [{ id: socket.id, name: name, score: 0, isSpectator: false, isAlive: true, role: 'CITIZEN' }],
      gameState: 'WAITING',
      currentTurnIndex: 0,
      turnTimer: null,
      
      // 라이어 옵션
      selectedCategory: '음식',
      currentWord: '',

      // 마피아 옵션
      mafiaDayTime: 60,
      mafiaCount: 1,
      policeCount: 2,
      doctorCount: 2,

      // 끝말잇기 옵션
      chainTimeLimit: 15, // 턴당 제한시간 (10/15/20/30초)
      chainMinLength: 2,  // 최소 글자수 (2글자/3글자)
      lastWord: '',
      usedWords: [],

      // 초성게임 옵션 (목표점수: 6점~20점)
      targetScore: 6,
      currentQuiz: null,
      quizList: []
    };

    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('room_created', { roomCode: roomCode, isHost: true });
    updateRoomInfo(roomCode);
    io.to(roomCode).emit('system_message', `${name}님이 방을 생성하셨습니다.`);
  });

  // 방 입장
  socket.on('join_room', (data) => {
    const { roomCode, nickname } = data;
    const targetCode = roomCode.trim().toUpperCase();

    if (!rooms[targetCode]) {
      socket.emit('system_message', '존재하지 않는 방 코드입니다.');
      return;
    }

    const room = rooms[targetCode];
    const name = nickname.trim() || `플레이어_${socket.id.substring(0, 4)}`;
    const isSpectator = room.gameState !== 'WAITING' || room.players.length >= MAX_PLAYERS;
    
    room.players.push({ id: socket.id, name: name, score: 0, isSpectator: isSpectator, isAlive: true, role: 'CITIZEN' });

    socket.join(targetCode);
    socket.roomCode = targetCode;

    socket.emit('room_joined', { roomCode: targetCode, isHost: room.hostId === socket.id, isSpectator: isSpectator });
    updateRoomInfo(targetCode);

    if (isSpectator) socket.emit('system_message', '👀 관전 모드로 참여합니다.');
    else io.to(targetCode).emit('system_message', `${name}님이 입장하셨습니다.`);
  });

  // 모드 변경
  socket.on('change_game_mode', (mode) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    if (socket.id !== room.hostId || room.gameState !== 'WAITING') return;

    if (['LIAR', 'MAFIA', 'WORDCHAIN', 'INITIAL'].includes(mode)) {
      room.gameMode = mode;
      io.to(roomCode).emit('game_mode_changed', mode);
      updateRoomInfo(roomCode);
    }
  });

  // 옵션 변경
  socket.on('update_settings', (settings) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];
    if (socket.id !== room.hostId) return;

    const totalPlayers = room.players.filter(p => !p.isSpectator).length;

    // 라이어 옵션
    if (settings.category) room.selectedCategory = settings.category;

    // 마피아 옵션
    if (settings.mafiaDayTime) room.mafiaDayTime = Number(settings.mafiaDayTime);
    if (settings.mafiaCount !== undefined) {
      const minMafia = Math.floor(totalPlayers / 6) || 1;
      const maxPolice = Math.floor(totalPlayers / 3);
      const maxDoctor = Math.floor(totalPlayers / 3);

      if (settings.mafiaCount < minMafia) return socket.emit('system_message', `⚠️ 마피아는 최소 ${minMafia}명 이상이어야 합니다.`);
      if (settings.policeCount > maxPolice) return socket.emit('system_message', `⚠️ 경찰은 최대 ${maxPolice}명까지 설정 가능합니다.`);
      if (settings.doctorCount > maxDoctor) return socket.emit('system_message', `⚠️ 의사는 최대 ${maxDoctor}명까지 설정 가능합니다.`);

      room.mafiaCount = Number(settings.mafiaCount);
      room.policeCount = Number(settings.policeCount);
      room.doctorCount = Number(settings.doctorCount);
    }

    // 끝말잇기 옵션
    if (settings.chainTimeLimit) room.chainTimeLimit = Number(settings.chainTimeLimit);
    if (settings.chainMinLength) room.chainMinLength = Number(settings.chainMinLength);

    // 초성게임 옵션 (6점 ~ 20점 설정 제한)
    if (settings.targetScore !== undefined) {
      let score = Number(settings.targetScore);
      if (score < 6) score = 6;
      if (score > 20) score = 20;
      room.targetScore = score;
    }

    io.to(roomCode).emit('system_message', `⚙️ 방 설정이 변경되었습니다.`);
    updateRoomInfo(roomCode);
  });

  // 게임 시작 분기
  socket.on('start_game_request', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    if (socket.id !== room.hostId || room.gameState !== 'WAITING') return;
    const activePlayers = room.players.filter(p => !p.isSpectator);

    if (room.gameMode === 'LIAR') {
      if (activePlayers.length < 2) return socket.emit('system_message', '라이어 게임은 최소 2명 이상 필요합니다.');
      startLiarGame(roomCode);
    } else if (room.gameMode === 'MAFIA') {
      if (activePlayers.length < 6) return socket.emit('system_message', '마피아 게임은 최소 6명 이상 필요합니다.');
      startMafiaGame(roomCode);
    } else if (room.gameMode === 'WORDCHAIN') {
      if (activePlayers.length < 2) return socket.emit('system_message', '끝말잇기는 최소 2명 이상 필요합니다.');
      startWordChainGame(roomCode);
    } else if (room.gameMode === 'INITIAL') {
      if (activePlayers.length < 2) return socket.emit('system_message', '초성 게임은 최소 2명 이상 필요합니다.');
      startInitialGame(roomCode);
    }
  });

  // 메시지 및 정답 수신 처리
  socket.on('send_word', (inputWord) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const word = inputWord.trim();

    // 1. 초성 게임: 제일 빠른 사람이 정답 처리!
    if (room.gameMode === 'INITIAL' && room.gameState === 'PLAYING') {
      io.to(roomCode).emit('receive_word', { sender: player.name, word: word });

      if (room.currentQuiz && word === room.currentQuiz.answer) {
        player.score = (player.score || 0) + 1;
        io.to(roomCode).emit('system_message', `🎉 <b>[ ${player.name} ]</b>님이 가장 빠르게 정답 <b>[ ${word} ]</b>을(를) 맞췄습니다! (+1점)`);
        updateRoomInfo(roomCode);

        if (player.score >= room.targetScore) {
          finishGame(roomCode, player.name, `🏆 [ ${player.name} ]님이 목표 점수(${room.targetScore}점)에 도달하여 최종 승리하였습니다!`);
        } else {
          nextInitialQuiz(roomCode);
        }
      }
      return;
    }

    // 2. 끝말잇기 게임
    if (room.gameMode === 'WORDCHAIN' && room.gameState === 'PLAYING') {
      const currentPlayer = room.playOrder[room.currentTurnIndex];
      if (socket.id !== currentPlayer.id) return;

      if (word.length < room.chainMinLength) {
        return socket.emit('system_message', `⚠️ 단어는 최소 ${room.chainMinLength}글자 이상이어야 합니다.`);
      }
      if (room.usedWords.includes(word)) {
        return socket.emit('system_message', '⚠️ 이미 사용된 단어입니다.');
      }
      if (room.lastWord) {
        const lastChar = room.lastWord.slice(-1);
        const validLetters = getValidNextLetters(lastChar);
        if (!validLetters.includes(word.charAt(0))) {
          return socket.emit('system_message', `⚠️ [ ${lastChar} ](으)로 시작하는 단어를 입력해야 합니다!`);
        }
      }

      clearTimeout(room.turnTimer);
      room.lastWord = word;
      room.usedWords.push(word);

      io.to(roomCode).emit('receive_word', { sender: player.name, word: word });
      io.to(roomCode).emit('system_message', `👉 다음 시작 글자: <b>[ ${word.slice(-1)} ]</b>`);

      nextWordChainTurn(roomCode);
      return;
    }

    // 일반 채팅
    io.to(roomCode).emit('receive_word', { sender: player.name, word: word });
  });

  socket.on('leave_room', () => { handleLeave(socket); });
  socket.on('disconnect', () => { handleLeave(socket); });
});

// --- [끝말잇기 함수] ---
function startWordChainGame(roomCode) {
  const room = rooms[roomCode];
  const activePlayers = room.players.filter(p => !p.isSpectator);
  
  activePlayers.forEach(p => p.isAlive = true);
  room.playOrder = [...activePlayers].sort(() => 0.5 - Math.random());
  room.gameState = 'PLAYING';
  room.currentTurnIndex = 0;
  room.lastWord = '';
  room.usedWords = [];

  io.to(roomCode).emit('system_message', `🔤 끝말잇기 게임 시작! (시간: ${room.chainTimeLimit}초, 최소: ${room.chainMinLength}글자)`);
  broadcastWordChainTurn(roomCode);
}

function broadcastWordChainTurn(roomCode) {
  const room = rooms[roomCode];
  const alivePlayers = room.playOrder.filter(p => p.isAlive);

  if (alivePlayers.length <= 1) {
    const winner = alivePlayers[0];
    finishGame(roomCode, winner ? winner.name : '없음', `🎉 최후의 1인 [ ${winner ? winner.name : '없음'} ]님이 승리하였습니다!`);
    return;
  }

  while (!room.playOrder[room.currentTurnIndex].isAlive) {
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.playOrder.length;
  }

  const currentPlayer = room.playOrder[room.currentTurnIndex];
  io.to(roomCode).emit('system_message', `🔔 <b>[ ${currentPlayer.name} ]</b>님의 턴입니다.`);

  startTimer(roomCode, room.chainTimeLimit, () => {
    io.to(roomCode).emit('system_message', `⏰ 시간 초과! [ ${currentPlayer.name} ]님이 탈락하셨습니다.`);
    currentPlayer.isAlive = false;
    nextWordChainTurn(roomCode);
  });
}

function nextWordChainTurn(roomCode) {
  const room = rooms[roomCode];
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.playOrder.length;
  broadcastWordChainTurn(roomCode);
}

// --- [초성 스피드 퀴즈 함수] ---
function startInitialGame(roomCode) {
  const room = rooms[roomCode];
  const activePlayers = room.players.filter(p => !p.isSpectator);
  
  activePlayers.forEach(p => p.score = 0);
  room.quizList = [...INITIAL_QUIZ_DATA].sort(() => 0.5 - Math.random());
  room.gameState = 'PLAYING';

  io.to(roomCode).emit('system_message', `⚡ 초성 스피드 퀴즈 시작! 먼저 ${room.targetScore}점을 얻는 사람이 승리합니다!`);
  nextInitialQuiz(roomCode);
}

function nextInitialQuiz(roomCode) {
  const room = rooms[roomCode];
  if (room.quizList.length === 0) {
    room.quizList = [...INITIAL_QUIZ_DATA].sort(() => 0.5 - Math.random());
  }

  room.currentQuiz = room.quizList.pop();
  io.to(roomCode).emit('initial_quiz_show', {
    category: room.currentQuiz.category,
    initial: room.currentQuiz.initial
  });
  io.to(roomCode).emit('system_message', `💡 [ ${room.currentQuiz.category} ] 초성: <b>[ ${room.currentQuiz.initial} ]</b> (가장 빠르게 맞혀보세요!)`);
}

// --- [공통 게임 함수] ---
function startLiarGame(roomCode) {
  const room = rooms[roomCode];
  const activePlayers = room.players.filter(p => !p.isSpectator);
  const words = WORD_CATEGORIES[room.selectedCategory] || WORD_CATEGORIES['음식'];
  room.currentWord = words[Math.floor(Math.random() * words.length)];
  const liarIndex = Math.floor(Math.random() * activePlayers.length);

  activePlayers.forEach((p, idx) => {
    if (idx === liarIndex) {
      io.to(p.id).emit('system_message', `🤫 당신은 [라이어]입니다! (카테고리: ${room.selectedCategory})`);
    } else {
      io.to(p.id).emit('system_message', `🔑 제시어: [ ${room.currentWord} ] (카테고리: ${room.selectedCategory})`);
    }
  });

  room.gameState = 'PLAYING';
  io.to(roomCode).emit('system_message', '🎮 라이어 게임이 시작되었습니다!');
}

function startMafiaGame(roomCode) {
  const room = rooms[roomCode];
  const activePlayers = room.players.filter(p => !p.isSpectator);
  activePlayers.forEach(p => { p.isAlive = true; });

  const shuffled = [...activePlayers].sort(() => 0.5 - Math.random());
  shuffled.forEach((p, idx) => {
    if (idx < room.mafiaCount) p.role = 'MAFIA';
    else if (idx < room.mafiaCount + room.policeCount) p.role = 'POLICE';
    else if (idx < room.mafiaCount + room.doctorCount) p.role = 'DOCTOR';
    else p.role = 'CITIZEN';

    io.to(p.id).emit('system_message', `🎭 당신의 직책: [ ${p.role} ]`);
  });

  room.gameState = 'MAFIA_NIGHT';
  io.to(roomCode).emit('system_message', '🌙 밤이 되었습니다. 마피아 게임 시작!');
}

function finishGame(roomCode, winner, message) {
  const room = rooms[roomCode];
  if (!room) return;

  clearTimeout(room.turnTimer);
  room.gameState = 'WAITING';

  io.to(roomCode).emit('system_message', `🏆 ${message}`);
  updateRoomInfo(roomCode);
}

function updateRoomInfo(roomCode) {
  const room = rooms[roomCode];
  if (room) {
    io.to(roomCode).emit('player_list_update', {
      players: room.players,
      hostId: room.hostId,
      roomCode: roomCode,
      gameMode: room.gameMode
    });
  }
}

function handleLeave(socket) {
  const roomCode = socket.roomCode;
  if (!roomCode || !rooms[roomCode]) return;

  const room = rooms[roomCode];
  socket.leave(roomCode);
  room.players = room.players.filter(p => p.id !== socket.id);

  if (room.players.length === 0) {
    clearTimeout(room.turnTimer);
    delete rooms[roomCode];
  } else {
    if (room.hostId === socket.id) room.hostId = room.players[0].id;
    updateRoomInfo(roomCode);
  }
}

function startTimer(roomCode, seconds, onTimeout) {
  const room = rooms[roomCode];
  if (!room) return;

  clearTimeout(room.turnTimer);
  let timeLeft = seconds;
  io.to(roomCode).emit('timer_tick', timeLeft);

  const interval = setInterval(() => {
    timeLeft--;
    io.to(roomCode).emit('timer_tick', timeLeft);

    if (timeLeft <= 0) {
      clearInterval(interval);
      onTimeout();
    }
  }, 1000);

  room.turnTimer = interval;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
