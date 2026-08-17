const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

const rooms = {};

// 1. 라이어 게임 카테고리별 단어장
const LIAR_WORDS = {
  '음식': ['떡볶이', '김치찌개', '돈까스', '짜장면', '마라탕', '삼겹살', '초밥', '치킨', '피자', '햄버거', '파스타', '족발', '부대찌개', '비빔밥', '칼국수', '계란말이', '감자탕', '샤브샤브', '순대국', '떡갈비', '우동', '라멘'],
  '동물': ['호랑이', '사자', '기린', '코끼리', '판다', '펭귄', '돌고래', '강아지', '고양이', '토끼', '다람쥐', '독수리', '올빼미', '캥거루', '알파카', '하마', '악어', '사슴', '치타', '카멜레온', '북극곰', '바다표범'],
  '직업': ['소방관', '경찰관', '의사', '교사', '요리사', '비행기조종사', '판사', '화가', '가수', '운동선수', '프로그래머', '건축가', '기자', '변호사', '수의사', '우주비행사', '마술사', '사진작가', '미용사', '과학자', '외교관'],
  '장소': ['놀이공원', '영화관', '도서관', '해수욕장', '미술관', '박물관', '공항', '지하철역', '캠핑장', '수영장', '동물원', '식물원', '백화점', '미용실', '편의점', '식당', '카페', '학교', '병원', '헬스장'],
  '전자제품': ['스마트폰', '노트북', '태블릿', '스마트워치', '무선이어폰', '냉장고', '세탁기', '청소기', '에어컨', 'TV', '전자레인지', '에어프라이어', '식기세척기', '헤어드라이어', '게임기', '카메라', '빔프로젝터', '공기청정기']
};

// 2. 초성 퀴즈 데이터베이스 (100개)
const CHOSEONG_DATA = [
  { choseong: 'ㄱㅇ', word: '고양이' }, { choseong: 'ㄱㅇ', word: '강아지' }, { choseong: 'ㄴㅂ', word: '나비' }, { choseong: 'ㅂㄷ', word: '바다' },
  { choseong: 'ㅅㄱ', word: '사과' }, { choseong: 'ㅎㄴ', word: '하늘' }, { choseong: 'ㅋㅍ', word: '커피' }, { choseong: 'ㅋㅍ', word: '키보드' },
  { choseong: 'ㅂㄴㄴ', word: '바나나' }, { choseong: 'ㅍㄷ', word: '포도' }, { choseong: 'ㅅㅂ', word: '수박' }, { choseong: 'ㄸㄱ', word: '딸기' },
  { choseong: 'ㅋㅇ', word: '키위' }, { choseong: 'ㅁㄹ', word: '멜론' }, { choseong: 'ㅇㄹㅈ', word: '오렌지' }, { choseong: 'ㅂㅅㅇ', word: '복숭아' },
  { choseong: 'ㅊㄹ', word: '체리' }, { choseong: 'ㄹㅁ', word: '레몬' }, { choseong: 'ㄱㄹ', word: '귤' }, { choseong: 'ㄱㅈ', word: '감자' },
  { choseong: 'ㄱㄱㅁ', word: '고구마' }, { choseong: 'ㅇㅍ', word: '양파' }, { choseong: 'ㄷㄱ', word: '당근' }, { choseong: 'ㅇㅇ', word: '오이' },
  { choseong: 'ㅎㅂ', word: '호박' }, { choseong: 'ㅂㅊ', word: '배추' }, { choseong: 'ㅁ', word: '무' }, { choseong: 'ㅁㄴ', word: '마늘' },
  { choseong: 'ㅂㅅ', word: '버섯' }, { choseong: 'ㄱㅊ', word: '고추' }, { choseong: 'ㅎㅂㄱ', word: '햄버거' }, { choseong: 'ㅍㅈ', word: '피자' },
  { choseong: 'ㅊㅋ', word: '치킨' }, { choseong: 'ㄹㅁ', word: '라면' }, { choseong: 'ㄸㅂㅇ', word: '떡볶이' }, { choseong: 'ㅅㄷ', word: '순대' },
  { choseong: 'ㅌㄱ', word: '튀김' }, { choseong: 'ㅇㅁ', word: '어묵' }, { choseong: 'ㄱㅂ', word: '김밥' }, { choseong: 'ㄷㄲㅅ', word: '돈까스' },
  { choseong: 'ㅊㅂ', word: '초밥' }, { choseong: 'ㅇㄷ', word: '우동' }, { choseong: 'ㅉㅈㅁ', word: '짜장면' }, { choseong: 'ㅉㅃ', word: '짬뽕' },
  { choseong: 'ㅌㅅㅇ', word: '탕수육' }, { choseong: 'ㅅㄱㅅ', word: '삼겹살' }, { choseong: 'ㄱㅂ', word: '갈비' }, { choseong: 'ㅈㅂ', word: '족발' },
  { choseong: 'ㅂㅆ', word: '보쌈' }, { choseong: 'ㄱㅊ', word: '곱창' }, { choseong: 'ㅎㄹㅇ', word: '호랑이' }, { choseong: 'ㅅㅈ', word: '사자' },
  { choseong: 'ㄱㄹ', word: '기린' }, { choseong: 'ㅋㄲㄹ', word: '코끼리' }, { choseong: 'ㅍㄷ', word: '판다' }, { choseong: 'ㅍㄱ', word: '펭귄' },
  { choseong: 'ㄷㄹㄱ', word: '돌고래' }, { choseong: 'ㅌㄲ', word: '토끼' }, { choseong: 'ㄷㄹㅈ', word: '다람쥐' }, { choseong: 'ㄷㅅㄹ', word: '독수리' },
  { choseong: 'ㅇㅃㅁ', word: '올빼미' }, { choseong: 'ㅋㄱㄹ', word: '캥거루' }, { choseong: 'ㅇㅍㅋ', word: '알파카' }, { choseong: 'ㅎㅁ', word: '하마' },
  { choseong: 'ㅇㅇ', word: '악어' }, { choseong: 'ㅅㅅ', word: '사슴' }, { choseong: 'ㅊㅌ', word: '치타' }, { choseong: 'ㅋㅁㄹㅇ', word: '카멜레온' },
  { choseong: 'ㅂㄱㄱ', word: '북극곰' }, { choseong: 'ㅂㄷㅍㅂ', word: '바다표범' }, { choseong: 'ㅅㅂㄱ', word: '소방관' }, { choseong: 'ㄱㅊㄱ', word: '경찰관' },
  { choseong: 'ㅇㅅ', word: '의사' }, { choseong: 'ㄱㅅ', word: '교사' }, { choseong: 'ㅇㄹㅅ', word: '요리사' }, { choseong: 'ㅍㅅ', word: '판사' },
  { choseong: 'ㅎㄱ', word: '화가' }, { choseong: 'ㄱㅅ', word: '가수' }, { choseong: 'ㅇㄷㅅㅅ', word: '운동선수' }, { choseong: 'ㄱㅊㄱ', word: '건축가' },
  { choseong: 'ㄱㅈ', word: '기자' }, { choseong: 'ㅂㅎㅅ', word: '변호사' }, { choseong: 'ㅅㅇㅅ', word: '수의사' }, { choseong: 'ㅁㅅㅅ', word: '마술사' },
  { choseong: 'ㅅㅈㅈㄱ', word: '사진작가' }, { choseong: 'ㅁㅇㅅ', word: '미용사' }, { choseong: 'ㄱㅎㅅ', word: '간호사' }, { choseong: 'ㅇㅅ', word: '약사' },
  { choseong: 'ㄴㅂ', word: '농부' }, { choseong: 'ㅇㅂ', word: '어부' }, { choseong: 'ㄴㅇㄱㅇ', word: '놀이공원' }, { choseong: 'ㅇㅎㄱ', word: '영화관' },
  { choseong: 'ㄷㅅㄱ', word: '도서관' }, { choseong: 'ㅎㅅㅇㅈ', word: '해수욕장' }, { choseong: 'ㅁㅅㄱ', word: '미술관' }, { choseong: 'ㅂㅁㄱ', word: '박물관' },
  { choseong: 'ㄱㅎ', word: '공항' }, { choseong: 'ㅈㅎㅊㅇ', word: '지하철역' }, { choseong: 'ㅋㅍㅈ', word: '캠핑장' }, { choseong: 'ㅅㅇㅈ', word: '수영장' }
];

io.on('connection', (socket) => {
  // 1. 방 입장 (닉네임 + 방코드)
  socket.on('join_room', ({ roomId, username }) => {
    if (!roomId || !username) return;

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        host: socket.id,
        gameMode: 'liar',
        gameStarted: false,
        // 라이어 게임 설정
        liarCategory: '음식',
        keyword: '',
        liarId: null,
        rpsChoices: {}, // 가위바위보 결과 저장
        // 마피아 게임 설정
        mafiaDayTime: 60,
        mafiaCount: 1,
        policeCount: 1,
        doctorCount: 1,
        // 끝말잇기 설정
        shiritoriTime: 10,
        shiritoriLen: 2,
        currentWord: '',
        turnIndex: 0,
        shiritoriTimer: null,
        // 초성 퀴즈 설정
        targetScore: 6,
        scores: {},
        currentChoseongObj: null
      };
    }

    const room = rooms[roomId];

    if (room.players.length >= 18) {
      socket.emit('system_message', '⚠️ 방이 가득 찼습니다. (최대 18명)');
      socket.leave(roomId);
      return;
    }

    room.players.push({ id: socket.id, username });
    room.scores[socket.id] = 0;

    socket.emit('join_success', { roomId, username });

    broadcastRoomState(roomId);
    io.to(roomId).emit('system_message', `👋 [${username}]님이 입장하셨습니다.`);
  });

  // 2. 방 설정 업데이트
  socket.on('update_settings', ({ roomId, settings }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    if (settings.gameMode) room.gameMode = settings.gameMode;
    if (settings.liarCategory) room.liarCategory = settings.liarCategory;
    if (settings.shiritoriTime) room.shiritoriTime = Number(settings.shiritoriTime);
    if (settings.shiritoriLen) room.shiritoriLen = Number(settings.shiritoriLen);
    if (settings.targetScore) room.targetScore = Number(settings.targetScore);

    if (room.gameMode === 'mafia' && settings.mafiaCount !== undefined) {
      const totalPlayers = room.players.length;
      const mCount = Number(settings.mafiaCount);
      const pCount = Number(settings.policeCount);
      const dCount = Number(settings.doctorCount);

      const minMafia = Math.floor(totalPlayers / 6) || 1;
      const maxPolice = Math.floor(totalPlayers / 3) || 1;
      const maxDoctor = Math.floor(totalPlayers / 3) || 1;

      if (mCount < 1 || pCount < 1 || dCount < 1) {
        return socket.emit('system_message', '⚠️ 마피아/경찰/의사는 각각 최소 1명 이상이어야 합니다.');
      }
      if (mCount < minMafia) return socket.emit('system_message', `⚠️ 마피아는 최소 ${minMafia}명 이상이어야 합니다.`);
      if (pCount > maxPolice) return socket.emit('system_message', `⚠️ 경찰은 최대 ${maxPolice}명까지 가능합니다.`);
      if (dCount > maxDoctor) return socket.emit('system_message', `⚠️ 의사는 최대 ${maxDoctor}명까지 가능합니다.`);
      if (mCount + pCount + dCount >= totalPlayers && totalPlayers > 0) {
        return socket.emit('system_message', '⚠️ 특수 직책의 합은 총원보다 적어야 합니다 (시민 1명 이상 필요).');
      }

      room.mafiaCount = mCount;
      room.policeCount = pCount;
      room.doctorCount = dCount;
      room.mafiaDayTime = Number(settings.mafiaDayTime) || 60;
    }

    broadcastRoomState(roomId);
  });

  // 3. 게임 시작
  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    if (room.gameMode === 'liar') {
      if (room.players.length < 2) return socket.emit('system_message', '⚠️ 라이어 게임은 최소 2명 이상 필요합니다.');
      
      room.gameStarted = true;
      const words = LIAR_WORDS[room.liarCategory] || LIAR_WORDS['음식'];
      room.keyword = words[Math.floor(Math.random() * words.length)];
      const liarIndex = Math.floor(Math.random() * room.players.length);
      room.liarId = room.players[liarIndex].id;

      room.players.forEach((p) => {
        if (p.id === room.liarId) {
          io.to(p.id).emit('system_message', `🕵️ 당신은 [라이어]입니다! 제시어를 모른 채 발언하세요.`);
        } else {
          io.to(p.id).emit('system_message', `🔑 카테고리: [${room.liarCategory}] / 제시어: [${room.keyword}]`);
        }
      });

      io.to(roomId).emit('game_started', { mode: 'liar' });
      io.to(roomId).emit('start_rps'); // 가위바위보 순서 정하기 시작!
    } 
    else if (room.gameMode === 'mafia') {
      if (room.players.length < 6) return socket.emit('system_message', '⚠️ 마피아 게임은 최소 6명 이상 필요합니다.');
      room.gameStarted = true;
      io.to(roomId).emit('game_started', { mode: 'mafia' });
    }
    else if (room.gameMode === 'shiritori') {
      room.gameStarted = true;
      room.turnIndex = 0;
      room.currentWord = '사과';
      io.to(roomId).emit('game_started', {
        mode: 'shiritori',
        currentWord: room.currentWord,
        currentTurn: room.players[room.turnIndex].username
      });
      startShiritoriTimer(roomId);
    }
    else if (room.gameMode === 'choseong') {
      room.gameStarted = true;
      room.players.forEach(p => room.scores[p.id] = 0);
      io.to(roomId).emit('game_started', { mode: 'choseong' });
      nextChoseongQuestion(roomId);
    }
  });

  // 4. 가위바위보(RPS) 제출 및 순서 정하기
  socket.on('submit_rps', ({ roomId, choice }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.rpsChoices[socket.id] = { username: socket.username, choice };

    // 모두 제출 완료 시 순서 계산
    if (Object.keys(room.rpsChoices).length === room.players.length) {
      const results = Object.values(room.rpsChoices);
      
      // 순서 무작위 셔플 후 발언 순서 배정
      const shuffled = [...room.players].sort(() => Math.random() - 0.5);
      const orderNames = shuffled.map(p => p.username).join(' ➡️ ');

      io.to(roomId).emit('rps_result', {
        results,
        orderText: `🎲 가위바위보 완료! 발언 순서: ${orderNames}`
      });

      room.rpsChoices = {}; // 초기화
    }
  });

  // 5. 채팅 및 정답
  socket.on('send_message', ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;

    const sender = room.players.find(p => p.id === socket.id);
    const username = sender ? sender.username : '익명';

    if (room.gameStarted && room.gameMode === 'shiritori') {
      const currentPlayer = room.players[room.turnIndex];
      if (socket.id === currentPlayer.id) {
        const lastChar = room.currentWord.slice(-1);
        const firstChar = message.trim().charAt(0);

        if (firstChar === lastChar && message.trim().length === room.shiritoriLen) {
          clearInterval(room.shiritoriTimer);
          room.currentWord = message.trim();
          room.turnIndex = (room.turnIndex + 1) % room.players.length;

          io.to(roomId).emit('shiritori_success', {
            word: room.currentWord,
            nextTurn: room.players[room.turnIndex].username,
            sender: username
          });
          startShiritoriTimer(roomId);
          return;
        } else {
          return socket.emit('system_message', `⚠️ 규칙에 맞는 ${room.shiritoriLen}자 단어를 입력하세요!`);
        }
      }
    }

    if (room.gameStarted && room.gameMode === 'choseong' && room.currentChoseongObj) {
      if (message.trim() === room.currentChoseongObj.word) {
        room.scores[socket.id] = (room.scores[socket.id] || 0) + 1;
        io.to(roomId).emit('system_message', `🎉 [${username}]님 정답! (${room.currentChoseongObj.word})`);

        if (room.scores[socket.id] >= room.targetScore) {
          room.gameStarted = false;
          io.to(roomId).emit('game_over', { winner: username });
        } else {
          nextChoseongQuestion(roomId);
        }
        return;
      }
    }

    io.to(roomId).emit('receive_message', { username, message });
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p.id !== socket.id);
      delete room.scores[socket.id];
      delete room.rpsChoices[socket.id];

      if (room.players.length === 0) {
        if (room.shiritoriTimer) clearInterval(room.shiritoriTimer);
        delete rooms[roomId];
      } else {
        if (room.host === socket.id) room.host = room.players[0].id;
        broadcastRoomState(roomId);
        io.to(roomId).emit('system_message', `🚪 [${socket.username}]님이 퇴장하셨습니다.`);
      }
    }
  });
});

function broadcastRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('update_room', {
    roomId,
    players: room.players,
    host: room.host,
    gameMode: room.gameMode,
    gameStarted: room.gameStarted,
    liarCategory: room.liarCategory,
    mafiaDayTime: room.mafiaDayTime,
    mafiaCount: room.mafiaCount,
    policeCount: room.policeCount,
    doctorCount: room.doctorCount,
    shiritoriTime: room.shiritoriTime,
    shiritoriLen: room.shiritoriLen,
    targetScore: room.targetScore
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
      const loser = room.players[room.turnIndex].username;
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
    choseong: room.currentChoseongObj.choseong,
    scores: room.scores,
    players: room.players
  });
}

server.listen(3000, () => console.log('서버 실행: http://localhost:3000'));
