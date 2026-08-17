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

// 100개 초성 퀴즈 데이터
const CHOSEONG_DATA = [
  { choseong: 'ㄸㅂㅇ', word: '떡볶이' }, { choseong: 'ㄱㅊㅉㄱ', word: '김치찌개' }, { choseong: 'ㄷㄲㅅ', word: '돈까스' },
  { choseong: 'ㅉㅈㅁ', word: '짜장면' }, { choseong: 'ㅁㄹㅌ', word: '마라탕' }, { choseong: 'ㅅㄱㅅ', word: '삼겹살' },
  { choseong: 'ㅊㅂ', word: '초밥' }, { choseong: 'ㅊㅋ', word: '치킨' }, { choseong: 'ㅍㅈ', word: '피자' },
  { choseong: 'ㅎㅂㄱ', word: '햄버거' }, { choseong: 'ㅍㅅㅌ', word: '파스타' }, { choseong: 'ㅈㅂ', word: '족발' },
  { choseong: 'ㅂㅆ', word: '보쌈' }, { choseong: 'ㅅㄷㄱ', word: '순대국' }, { choseong: 'ㄴㅁ', word: '냉면' },
  { choseong: 'ㅋㄱㅅ', word: '칼국수' }, { choseong: 'ㅅㅂㅅㅂ', word: '샤브샤브' }, { choseong: 'ㄱㄹㅁㅇ', word: '계란말이' },
  { choseong: 'ㄱㅂ', word: '김밥' }, { choseong: 'ㄹㅁ', word: '라면' }, { choseong: 'ㅇㅇㅅㅋㄹ', word: '아이스크림' },
  { choseong: 'ㅊㅋㄹ', word: '초콜릿' }, { choseong: 'ㅍㅋ', word: '팝콘' }, { choseong: 'ㅂㄴㄴ', word: '바나나' }, { choseong: 'ㅅㄱ', word: '사과' },
  { choseong: 'ㅎㄹㅇ', word: '호랑이' }, { choseong: 'ㅅㅈ', word: '사자' }, { choseong: 'ㄱㄹ', word: '기린' },
  { choseong: 'ㅋㄲㄹ', word: '코끼리' }, { choseong: 'ㅍㄷ', word: '판다' }, { choseong: 'ㅍㄱ', word: '펭귄' },
  { choseong: 'ㄷㄹㄱ', word: '돌고래' }, { choseong: 'ㄱㅇㅇ', word: '고양이' }, { choseong: 'ㄱㅇㅈ', word: '강아지' },
  { choseong: 'ㅌㄲ', word: '토끼' }, { choseong: 'ㄷㄹㅈ', word: '다람쥐' }, { choseong: 'ㄴㄷ', word: '늑대' },
  { choseong: 'ㅇㅇ', word: '여우' }, { choseong: 'ㅅㄷ', word: '수달' }, { choseong: 'ㅎㅁ', word: '하마' },
  { choseong: 'ㅇㄱ', word: '악어' }, { choseong: 'ㄷㅅㄹ', word: '독수리' }, { choseong: 'ㅂㅇㅇ', word: '부엉이' },
  { choseong: 'ㅋㅁㄹㅇ', word: '카멜레온' }, { choseong: 'ㅂㄱㄱ', word: '북극곰' }, { choseong: 'ㅇㄹㅈ', word: '얼룩말' },
  { choseong: 'ㅋㅇㄹ', word: '코알라' }, { choseong: 'ㅋㄱㄹ', word: '캥거루' }, { choseong: 'ㅊㅅㅁ', word: '청람쥐' }, { choseong: 'ㄹㅋ', word: '라쿤' },
  { choseong: 'ㄴㅇㄱㅇ', word: '놀이공원' }, { choseong: 'ㅇㅎㄱ', word: '영화관' }, { choseong: 'ㄷㅅㄱ', word: '도서관' },
  { choseong: 'ㅎㅅㅇㅈ', word: '해수욕장' }, { choseong: 'ㅁㅅㄱ', word: '미술관' }, { choseong: 'ㅂㅁㄱ', word: '박물관' },
  { choseong: 'ㄱㅎ', word: '공항' }, { choseong: 'ㅈㅎㅊㅇ', word: '지하철역' }, { choseong: 'ㅍㅇㅈ', word: '편의점' },
  { choseong: 'ㅋㅍ', word: '카페' }, { choseong: 'ㅇㅌㅍㅋ', word: '워터파크' }, { choseong: 'ㅋㅍㅈ', word: '캠핑장' },
  { choseong: 'ㄴㄹㅂ', word: '노래방' }, { choseong: 'ㅍㅅㅂ', word: '피시방' }, { choseong: 'ㅁㅇㅅ', word: '미용실' },
  { choseong: 'ㅂㅎㅈ', word: '백화점' }, { choseong: 'ㄷㅁㅇ', word: '동물원' }, { choseong: 'ㅅㅁㅇ', word: '식물원' },
  { choseong: 'ㅎㅅㅈ', word: '헬스장' }, { choseong: 'ㅎㄱ', word: '학교' }, { choseong: 'ㅂㅇ', word: '병원' },
  { choseong: 'ㅇㄱ', word: '약국' }, { choseong: 'ㅇㅊㅇ', word: '유치원' }, { choseong: 'ㄱㅊㅅ', word: '경찰서' }, { choseong: 'ㅅㅂㅅ', word: '소방서' },
  { choseong: 'ㅅㅁㅌㅍ', word: '스마트폰' }, { choseong: 'ㄴㅌㅂ', word: '노트북' }, { choseong: 'ㅁㅅㅇㅇㅍ', word: '무선이어폰' },
  { choseong: 'ㅇㄱ', word: '안경' }, { choseong: 'ㅈㄱ', word: '지갑' }, { choseong: 'ㅅㄱ', word: '시계' },
  { choseong: 'ㅇㅅ', word: '우산' }, { choseong: 'ㅌㅂㄹ', word: '텀블러' }, { choseong: 'ㅂㅈㅂㅌㄹ', word: '보조배터리' },
  { choseong: 'ㅅㅍㄱ', word: '선풍기' }, { choseong: 'ㄷㄹㅇㄱ', word: '드라이기' }, { choseong: 'ㅊㅅ', word: '칫솔' },
  { choseong: 'ㄱㅇ', word: '거울' }, { choseong: 'ㅁㅇㅅ', word: '마우스' }, { choseong: 'ㅋㅂㄷ', word: '키보드' },
  { choseong: 'ㄱㅂ', word: '가방' }, { choseong: 'ㅁㅈ', word: '모자' }, { choseong: 'ㅇㄷㅎ', word: '운동화' },
  { choseong: 'ㅎㄷㅅ', word: '헤드셋' }, { choseong: 'ㅋㅁㄹ', word: '카메라' }, { choseong: 'ㅈㄱ', word: '자전거' },
  { choseong: 'ㅈㄱ', word: '전구' }, { choseong: 'ㅎㄴ', word: '하늘' }, { choseong: 'ㅊㄱㅂ', word: '책가방' }, { choseong: 'ㅊㄱㄱ', word: '축구공' }
];

// 100개 라이어 단어 데이터
const LIAR_WORDS = {
  '음식': [
    '떡볶이', '김치찌개', '돈까스', '짜장면', '마라탕', '삼겹살', '초밥', '치킨', '피자', '햄버거',
    '파스타', '족발', '보쌈', '순대국', '냉면', '칼국수', '샤브샤브', '계란말이', '김밥', '라면',
    '아이스크림', '초콜릿', '팝콘', '바나나', '사과', '만두', '비빔밥', '갈비탕', '감자탕', '떡국'
  ],
  '동물': [
    '호랑이', '사자', '기린', '코끼리', '판다', '펭귄', '돌고래', '강아지', '고양이', '토끼',
    '다람쥐', '늑대', '여우', '수달', '하마', '악어', '독수리', '부엉이', '카멜레온', '북극곰',
    '얼룩말', '코알라', '캥거루', '청람쥐', '라쿤', '고슴도치', '사슴', '순록', '낙타', '물개'
  ],
  '장소': [
    '놀이공원', '영화관', '도서관', '해수욕장', '미술관', '박물관', '공항', '지하철역', '편의점', '카페',
    '워터파크', '캠핑장', '노래방', '피시방', '미용실', '백화점', '동물원', '식물원', '헬스장', '학교',
    '병원', '약국', '유치원', '경찰서', '소방서', '은행', '우체국', '경기장', '스키장', '온천'
  ],
  '물건': [
    '스마트폰', '노트북', '무선이어폰', '안경', '지갑', '시계', '우산', '텀블러', '보조배터리', '선풍기',
    '드라이기', '칫솔', '거울', '마우스', '키보드', '가방', '모자', '운동화', '헤드셋', '카메라',
    '자전거', '전구', '책가방', '축구공', '농구공', '야구공', '리모컨', '냉장고', '세탁기', '청소기',
    '소파', '침대', '식탁', '선글라스', '마스크', '손소독제', '충전기', '가위', '풀', '필통'
  ]
};

io.on('connection', (socket) => {
  // 1. 방 생성
  socket.on('create_room', ({ username }) => {
    if (!username) return;
    const roomId = generateRoomCode();

    rooms[roomId] = {
      players: [],
      host: socket.id,
      gameMode: 'mafia',
      gameStarted: false,
      
      liarCategory: '음식',
      keyword: '',
      liarId: null,
      liarVotes: {},
      speakingOrder: [],
      currentTurnIndex: 0,
      turnCount: 0,

      shiritoriTime: 10,
      shiritoriLen: 2,
      currentWord: '',
      shiritoriTurnIndex: 0,
      shiritoriTimer: null,

      targetScore: 5,
      scores: {},
      currentChoseongObj: null,

      dayTime: 60,
      phase: 'WAITING',
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

  // 3. 모드 변경
  socket.on('change_game_mode', ({ roomId, gameMode }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id && !room.gameStarted) {
      room.gameMode = gameMode;
      broadcastRoomState(roomId);
    }
  });

  // 4. 방 나가기
  socket.on('leave_room', () => handleLeave(socket));

  // 5. 게임 시작
  socket.on('start_game', ({ roomId, options }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    if (room.gameMode === 'mafia') {
      if (room.players.length < 6) {
        return socket.emit('system_message', '⚠️ 마피아 게임은 최소 6명 이상 필요합니다.');
      }

      const mafiaCnt = options?.mafiaCount || 2;
      const policeCnt = options?.policeCount || 1;
      const doctorCnt = options?.doctorCount || 1;

      if (mafiaCnt + policeCnt + doctorCnt >= room.players.length) {
        return socket.emit('system_message', '⚠️ 특수 직업 수의 합이 전체 인원보다 적어야 합니다.');
      }

      room.gameStarted = true;
      room.dayTime = options?.dayTime || 60;

      const roles = [];
      for (let i = 0; i < mafiaCnt; i++) roles.push('mafia');
      for (let i = 0; i < policeCnt; i++) roles.push('police');
      for (let i = 0; i < doctorCnt; i++) roles.push('doctor');
      while (roles.length < room.players.length) roles.push('citizen');
      roles.sort(() => Math.random() - 0.5);

      room.players.forEach((p, idx) => {
        p.isAlive = true;
        p.role = roles[idx];
        io.to(p.id).emit('system_message', `🎭 당신의 역할은 [${p.role}]입니다.`);
      });

      startMafiaDay(roomId);
    } else if (room.gameMode === 'liar') {
      if (room.players.length < 3) {
        return socket.emit('system_message', '⚠️ 라이어 게임은 최소 3명 이상 필요합니다.');
      }
      room.gameStarted = true;
      room.liarVotes = {};
      room.turnCount = 0;
      room.currentTurnIndex = 0;
      room.speakingOrder = [...room.players].sort(() => Math.random() - 0.5);

      const categories = Object.keys(LIAR_WORDS);
      room.liarCategory = categories[Math.floor(Math.random() * categories.length)];
      const words = LIAR_WORDS[room.liarCategory];
      room.keyword = words[Math.floor(Math.random() * words.length)];
      const liarIndex = Math.floor(Math.random() * room.players.length);
      room.liarId = room.players[liarIndex].id;

      room.players.forEach((p) => {
        if (p.id === room.liarId) {
          io.to(p.id).emit('system_message', `🕵️ 당신은 [라이어]입니다! 카테고리: [${room.liarCategory}]`);
        } else {
          io.to(p.id).emit('system_message', `🔑 카테고리: [${room.liarCategory}] / 제시어: [${room.keyword}]`);
        }
      });

      io.to(roomId).emit('game_started', { mode: 'liar' });
      io.to(roomId).emit('update_turn', { currentTurnPlayer: room.speakingOrder[0].username });
    } else if (room.gameMode === 'shiritori') {
      if (room.players.length < 2) {
        return socket.emit('system_message', '⚠️ 끝말잇기는 최소 2명 이상 필요합니다.');
      }
      room.gameStarted = true;
      room.shiritoriTurnIndex = 0;
      room.currentWord = '사과';
      
      io.to(roomId).emit('game_started', { mode: 'shiritori', currentWord: room.currentWord });
      startShiritoriTimer(roomId);
    } else if (room.gameMode === 'choseong') {
      if (room.players.length < 2) {
        return socket.emit('system_message', '⚠️ 초성 퀴즈는 최소 2명 이상 필요합니다.');
      }
      room.gameStarted = true;
      room.players.forEach(p => room.scores[p.id] = 0);
      io.to(roomId).emit('game_started', { mode: 'choseong' });
      nextChoseongQuestion(roomId);
    }
  });

  // 메시지 및 라운드 처리
  socket.on('send_message', ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;

    const sender = room.players.find(p => p.id === socket.id);
    if (!sender) return;

    if (room.gameStarted && room.gameMode === 'liar') {
      const currentPlayer = room.speakingOrder[room.currentTurnIndex];
      if (socket.id === currentPlayer.id) {
        io.to(roomId).emit('receive_message', { username: sender.username, message });
        room.turnCount++;
        room.currentTurnIndex++;

        if (room.turnCount >= room.players.length) {
          io.to(roomId).emit('system_message', `\n✅ 발언 순서가 끝났습니다. 라이어 투표를 진행하세요!`);
          io.to(roomId).emit('start_liar_voting_phase', { players: room.players });
        } else {
          const nextPlayer = room.speakingOrder[room.currentTurnIndex];
          io.to(roomId).emit('update_turn', { currentTurnPlayer: nextPlayer.username });
        }
        return;
      } else {
        return socket.emit('system_message', `⚠️ 지금은 [${currentPlayer.username}]님의 순서입니다.`);
      }
    }

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

    if (room.gameMode === 'mafia' && !sender.isAlive) {
      return socket.emit('system_message', '⚠️ 생존자만 메시지를 입력할 수 있습니다.');
    }

    io.to(roomId).emit('receive_message', { username: sender.username, message });
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
    
    if (room.gameStarted) {
      let minPlayers = 2;
      if (room.gameMode === 'liar') minPlayers = 3;
      if (room.gameMode === 'mafia') minPlayers = 6;

      if (room.players.length < minPlayers) {
        room.gameStarted = false;
        if (room.shiritoriTimer) clearInterval(room.shiritoriTimer);
        io.to(roomId).emit('system_message', `⚠️ 인원이 부족하여 게임이 중단되었습니다.`);
      }
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
  io.to(roomId).emit('system_message', `☀️ 낮이 되었습니다. (${room.dayTime}초 동안 자유 토론)`);
  
  setTimeout(() => {
    room.phase = 'DAY_VOTE';
    io.to(roomId).emit('system_message', `🗳️ 토론 종료! 마피아로 의심되는 유저에게 투표하세요.`);
  }, room.dayTime * 1000);
}

server.listen(3000, () => console.log('서버 작동 중: http://localhost:3000'));
