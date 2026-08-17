const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

// 1. 라이어 게임 카테고리별 단어 데이터베이스
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
  { choseong: 'ㅂㄴㄴ', word: '바나나' }, { choseong: 'ㅍㄷ', word: '포도' }, { choseong: 'ㅅㅂ', word: '수박' }, { choseong: '딸기', word: '딸기' },
  { choseong: 'ㅋㅇ', word: '키위' }, { choseong: 'ㅁㄹ', word: '멜론' }, { choseong: 'ㅇㄹㅈ', word: '오렌지' }, { choseong: '복숭아', word: 'ㅂㅅㅇ' },
  { choseong: 'ㅊㄹ', word: '체리' }, { choseong: 'ㄹㅁ', word: '레몬' }, { choseong: 'ㄱㄹ', word: '귤' }, { choseong: '감자', word: 'ㄱㅈ' },
  { choseong: '고구마', word: 'ㄱㄱㅁ' }, { choseong: '양파', word: 'ㅇㅍ' }, { choseong: '당근', word: 'ㄷㄱ' }, { choseong: '오이', word: 'ㅇㅇ' },
  { choseong: '호박', word: 'ㅎㅂ' }, { choseong: '배추', word: 'ㅂㅊ' }, { choseong: '무', word: 'ㅁ' }, { choseong: '마늘', word: 'ㅁㄴ' },
  { choseong: '버섯', word: 'ㅂㅅ' }, { choseong: '고추', word: 'ㄱㅊ' }, { choseong: 'ㅎㅂㄱ', word: '햄버거' }, { choseong: 'ㅍㅈ', word: '피자' },
  { choseong: 'ㅊㅋ', word: '치킨' }, { choseong: 'ㄹㅁ', word: '라면' }, { choseong: '떡볶이', word: 'ㄸㅂㅇ' }, { choseong: '순대', word: 'ㅅㄷ' },
  { choseong: '튀김', word: 'ㅌㄱ' }, { choseong: '어묵', word: 'ㅇㅁ' }, { choseong: '김밥', word: 'ㄱㅂ' }, { choseong: '돈까스', word: 'ㄷㄲㅅ' },
  { choseong: '초밥', word: 'ㅊㅂ' }, { choseong: '우동', word: 'ㅇㄷ' }, { choseong: '짜장면', word: 'ㅉㅈㅁ' }, { choseong: '짬뽕', word: 'ㅉㅃ' },
  { choseong: '탕수육', word: 'ㅌㅅㅇ' }, { choseong: '삼겹살', word: 'ㅅㄱㅅ' }, { choseong: '갈비', word: 'ㄱㅂ' }, { choseong: '족발', word: 'ㅈㅂ' },
  { choseong: '보쌈', word: 'ㅂㅆ' }, { choseong: '곱창', word: 'ㄱㅊ' }, { choseong: 'ㅎㄹㅇ', word: '호랑이' }, { choseong: 'ㅅㅈ', word: '사자' },
  { choseong: 'ㄱㄹ', word: '기린' }, { choseong: 'ㅋㄲㄹ', word: '코끼리' }, { choseong: 'ㅍㄷ', word: '판다' }, { choseong: 'ㅍㄱ', word: '펭귄' },
  { choseong: 'ㄷㄹㄱ', word: '돌고래' }, { choseong: '토끼', word: 'ㅌㄲ' }, { choseong: '다람쥐', word: 'ㄷㄹㅈ' }, { choseong: '독수리', word: 'ㄷㅅㄹ' },
  { choseong: '올빼미', word: 'ㅇㅃㅁ' }, { choseong: '캥거루', word: 'ㅋㄱㄹ' }, { choseong: '알파카', word: 'ㅇㅍㅋ' }, { choseong: '하마', word: 'ㅎㅁ' },
  { choseong: '악어', word: 'ㅇㅇ' }, { choseong: '사슴', word: 'ㅅㅅ' }, { choseong: '치타', word: 'ㅊㅌ' }, { choseong: '카멜레온', word: 'ㅋㅁㄹㅇ' },
  { choseong: '북극곰', word: 'ㅂㄱㄱ' }, { choseong: '바다표범', word: 'ㅂㄷㅍㅂ' }, { choseong: 'ㅅㅂ관', word: '소방관' }, { choseong: 'ㄱㅊ관', word: '경찰관' },
  { choseong: 'ㅇㅅ', word: '의사' }, { choseong: 'ㄱㅅ', word: '교사' }, { choseong: 'ㅇㄹㅅ', word: '요리사' }, { choseong: 'ㅍㅅ', word: '판사' },
  { choseong: 'ㅎㄱ', word: '화가' }, { choseong: 'ㄱㅅ', word: '가수' }, { choseong: 'ㅇㄷㅅㅅ', word: '운동선수' }, { choseong: 'ㄱㅊㄱ', word: '건축가' },
  { choseong: 'ㄱㅈ', word: '기자' }, { choseong: 'ㅂㅎㅅ', word: '변호사' }, { choseong: 'ㅅㅇㅅ', word: '수의사' }, { choseong: 'ㅁㅅㅅ', word: '마술사' },
  { choseong: 'ㅅㅈㅈㄱ', word: '사진작가' }, { choseong: 'ㅁㅇㅅ', word: '미용사' }, { choseong: 'ㄱㅎㅅ', word: '간호사' }, { choseong: '약사', word: 'ㅇㅅ' },
  { choseong: 'ㄴㅇ', word: '농부' }, { choseong: '어부', word: 'ㅇㅂ' }, { choseong: '놀이공원', word: 'ㄴㅇㄱㅇ' }, { choseong: '영화관', word: 'ㅇㅎㄱ' },
  { choseong: '도서관', word: 'ㄷㅅㄱ' }, { choseong: '해수욕장', word: 'ㅎㅅㅇㅈ' }, { choseong: '미술관', word: 'ㅁㅅㄱ' }, { choseong: '박물관', word: 'ㅂㅁㄱ' }, { choseong: '공항', word: 'ㄱㅎ' }, { choseong: '지하철역', word: 'ㅈㅎㅊㅇ' }, { choseong: '캠핑장', word: 'ㅋㅍㅈ' }, { choseong: '수영장', word: 'ㅅㅇㅈ' }
];

io.on('connection', (socket) => {
  // 방 입장
  socket.on('join_room', ({ roomId, username }) => {
    socket.join(roomId);

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
      return socket.emit('system_message', '⚠️ 방이 가득 찼습니다. (최대 18명)');
    }

    room.players.push({ id: socket.id, username });
    room.scores[socket.id] = 0;

    io.to(roomId).emit('update_room', {
      players: room.players,
      host: room.host,
      gameMode: room.gameMode,
      gameStarted: room.gameStarted
    });
  });

  // 방 설정 변경
  socket.on('update_settings', ({ roomId, settings }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    if (settings.gameMode) room.gameMode = settings.gameMode;
    if (settings.liarCategory) room.liarCategory = settings.liarCategory;
    if (settings.shiritoriTime) room.shiritoriTime = Number(settings.shiritoriTime);
    if (settings.shiritoriLen) room.shiritoriLen = Number(settings.shiritoriLen);
    if (settings.targetScore) room.targetScore = Number(settings.targetScore);

    // 마피아 직책 인원 검증 로직
    if (room.gameMode === 'mafia' && settings.mafiaCount !== undefined) {
      const totalPlayers = room.players.length;
      const mCount = Number(settings.mafiaCount);
      const pCount = Number(settings.policeCount);
      const dCount = Number(settings.doctorCount);

      const minMafia = Math.floor(totalPlayers / 6) || 1;
      const maxPolice = Math.floor(totalPlayers / 3) || 1;
      const maxDoctor = Math.floor(totalPlayers / 3) || 1;

      // 1. 최소 1명 이상 (0명 제외)
      if (mCount < 1 || pCount < 1 || dCount < 1) {
        return socket.emit('system_message', '⚠️ 모든 직책(마피아, 경찰, 의사)은 최소 1명 이상이어야 합니다.');
      }

      // 2. 최대/최소 조건 검증
      if (mCount < minMafia) {
        return socket.emit('system_message', `⚠️ 마피아는 최소 ${minMafia}명 이상이어야 합니다.`);
      }
      if (pCount > maxPolice) {
        return socket.emit('system_message', `⚠️ 경찰은 최대 ${maxPolice}명까지 설정 가능합니다.`);
      }
      if (dCount > maxDoctor) {
        return socket.emit('system_message', `⚠️ 의사는 최대 ${maxDoctor}명까지 설정 가능합니다.`);
      }

      // 3. 시민 1명 이상 보장
      if (mCount + pCount + dCount >= totalPlayers && totalPlayers > 0) {
        return socket.emit('system_message', '⚠️ 특수 직책의 총합은 전체 플레이어 수보다 적어야 합니다 (시민 최소 1명 필요).');
      }

      room.mafiaCount = mCount;
      room.policeCount = pCount;
      room.doctorCount = dCount;
      room.mafiaDayTime = Number(settings.mafiaDayTime) || 60;
    }

    io.to(roomId).emit('update_room', {
      players: room.players,
      host: room.host,
      gameMode: room.gameMode,
      gameStarted: room.gameStarted
    });
  });

  // 게임 시작
  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    // 1. 라이어 게임
    if (room.gameMode === 'liar') {
      if (room.players.length < 2) {
        return socket.emit('system_message', '⚠️ 라이어 게임은 최소 2명 이상 필요합니다.');
      }
      room.gameStarted = true;

      const words = LIAR_WORDS[room.liarCategory] || LIAR_WORDS['음식'];
      room.keyword = words[Math.floor(Math.random() * words.length)];
      const liarIndex = Math.floor(Math.random() * room.players.length);
      room.liarId = room.players[liarIndex].id;

      room.players.forEach((p) => {
        if (p.id === room.liarId) {
          io.to(p.id).emit('system_message', `🕵️ 당신은 [라이어]입니다! 제시어를 모른 채 참여하세요.`);
        } else {
          io.to(p.id).emit('system_message', `🔑 카테고리: [${room.liarCategory}] / 제시어: [${room.keyword}]`);
        }
      });
      io.to(roomId).emit('game_started', { mode: 'liar' });
    }
    // 2. 마피아 게임
    else if (room.gameMode === 'mafia') {
      if (room.players.length < 6) {
        return socket.emit('system_message', '⚠️ 마피아 게임은 최소 6명 이상 필요합니다.');
      }
      room.gameStarted = true;
      io.to(roomId).emit('game_started', { mode: 'mafia' });
    }
    // 3. 끝말잇기
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
    // 4. 초성 퀴즈
    else if (room.gameMode === 'choseong') {
      room.gameStarted = true;
      nextChoseongQuestion(roomId);
    }
  });

  // 메시지 및 정답 입력
  socket.on('send_message', ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;

    const sender = room.players.find(p => p.id === socket.id);
    const username = sender ? sender.username : '익명';

    // 끝말잇기 검증
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

    // 초성 퀴즈 정답 검증
    if (room.gameStarted && room.gameMode === 'choseong' && room.currentChoseongObj) {
      if (message.trim() === room.currentChoseongObj.word) {
        room.scores[socket.id] += 1;
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
    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
      } else {
        if (room.host === socket.id) room.host = room.players[0].id;
        io.to(roomId).emit('update_room', {
          players: room.players,
          host: room.host,
          gameMode: room.gameMode,
          gameStarted: room.gameStarted
        });
      }
    }
  });
});

function startShiritoriTimer(roomId) {
  const room = rooms[roomId];
  let timeLeft = room.shiritoriTime;

  io.to(roomId).emit('timer_tick', { timeLeft });

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

server.listen(3000, () => console.log('서버 실행 완료: http://localhost:3000'));
