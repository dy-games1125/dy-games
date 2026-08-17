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
  '음식': ['떡볶이', '김치찌개', '돈까스', '짜장면', '마라탕', '삼겹살', '초밥', '치킨', '피자', '햄버거', '파스타', '족발', '부대찌개', '비빔밥', '칼국수', '계란말이', '감자탕', '샤브샤브', '순대국', '떡갈비', '우동', '라멘'],
  '동물': ['호랑이', '사자', '기린', '코끼리', '판다', '펭귄', '돌고래', '강아지', '고양이', '토끼', '다람쥐', '독수리', '올빼미', '캥거루', '알파카', '하마', '악어', '사슴', '치타', '카멜레온', '북극곰', '바다표범'],
  '직업': ['소방관', '경찰관', '의사', '교사', '요리사', '비행기조종사', '판사', '화가', '가수', '운동선수', '프로그래머', '건축가', '기자', '변호사', '수의사', '우주비행사', '마술사', '사진작가', '미용사', '과학자', '외교관'],
  '장소': ['놀이공원', '영화관', '도서관', '해수욕장', '미술관', '박물관', '공항', '지하철역', '캠핑장', '수영장', '동물원', '식물원', '백화점', '미용실', '편의점', '식당', '카페', '학교', '병원', '헬스장'],
  '전자제품': ['스마트폰', '노트북', '태블릿', '스마트워치', '무선이어폰', '냉장고', '세탁기', '청소기', '에어컨', 'TV', '전자레인지', '에어프라이어', '식기세척기', '헤어드라이어', '게임기', '카메라', '빔프로젝트', '공기청정기']
};

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
  socket.on('create_room', ({ username }) => {
    if (!username) return;
    const roomId = generateRoomCode();

    rooms[roomId] = {
      players: [],
      host: socket.id,
      gameMode: 'liar',
      gameStarted: false,
      liarCategory: '음식',
      keyword: '',
      liarId: null,
      rpsChoices: {},
      liarVotes: {},
      speakingOrder: [],
      liarState: 'LOBBY',
      mafiaDayTime: 60,
      mafiaCount: 1,
      policeCount: 1,
      doctorCount: 1,
      shiritoriTime: 10,
      shiritoriLen: 2,
      currentWord: '',
      turnIndex: 0,
      shiritoriTimer: null,
      targetScore: 6,
      scores: {},
      currentChoseongObj: null
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    rooms[roomId].players.push({ id: socket.id, username });
    rooms[roomId].scores[socket.id] = 0;

    socket.emit('join_success', { roomId, username });
    broadcastRoomState(roomId);
    io.to(roomId).emit('system_message', `🏠 방이 생성되었습니다. 방 코드: [${roomId}]`);
  });

  socket.on('join_room', ({ roomId, username }) => {
    if (!roomId || !username) return;
    if (!rooms[roomId]) return socket.emit('system_message', '⚠️ 존재하지 않는 방 코드입니다.');

    const room = rooms[roomId];
    if (room.players.length >= 18) return socket.emit('system_message', '⚠️ 방이 가득 찼습니다.');

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    room.players.push({ id: socket.id, username });
    room.scores[socket.id] = 0;

    socket.emit('join_success', { roomId, username });
    broadcastRoomState(roomId);
    io.to(roomId).emit('system_message', `👋 [${username}]님이 입장하셨습니다.`);
  });

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
        return socket.emit('system_message', '⚠️ 특수 직책의 합은 총원보다 적어야 합니다.');
      }

      room.mafiaCount = mCount;
      room.policeCount = pCount;
      room.doctorCount = dCount;
      room.mafiaDayTime = Number(settings.mafiaDayTime) || 60;
    }

    broadcastRoomState(roomId);
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    if (room.gameMode === 'liar') {
      if (room.players.length < 2) return socket.emit('system_message', '⚠️ 라이어 게임은 최소 2명 이상 필요합니다.');
      
      room.gameStarted = true;
      room.rpsChoices = {};
      room.liarVotes = {};
      room.liarState = 'RPS';

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
      io.to(roomId).emit('start_rps');
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

  socket.on('submit_rps', ({ roomId, choice }) => {
    const room = rooms[roomId];
    if (!room || room.liarState !== 'RPS') return;

    room.rpsChoices[socket.id] = choice;

    if (Object.keys(room.rpsChoices).length === room.players.length) {
      const choices = Object.values(room.rpsChoices);
      const uniqueChoices = new Set(choices);

      if (uniqueChoices.size === 1 || uniqueChoices.size === 3) {
        room.rpsChoices = {};
        io.to(roomId).emit('system_message', `🤝 가위바위보가 비겼습니다! 다시 제출해 주세요.`);
        io.to(roomId).emit('start_rps');
      } else {
        let sortedPlayers = [...room.players].sort((a, b) => {
          let cA = room.rpsChoices[a.id];
          let cB = room.rpsChoices[b.id];
          if (cA === cB) return Math.random() - 0.5;
          if ((cA === '바위' && cB === '가위') || (cA === '가위' && cB === '보') || (cA === '보' && cB === '바위')) return -1;
          return 1;
        });

        room.speakingOrder = sortedPlayers;
        room.liarState = 'SPEAKING';

        io.to(roomId).emit('rps_result', { orderList: sortedPlayers });
        io.to(roomId).emit('start_liar_voting_phase', { players: room.players });
      }
    } else {
      const currentCount = Object.keys(room.rpsChoices).length;
      io.to(roomId).emit('system_message', `✌️ 가위바위보 진행 중... (${currentCount}/${room.players.length}명 제출)`);
    }
  });

  socket.on('submit_liar_vote', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.gameMode !== 'liar') return;

    room.liarVotes[socket.id] = targetId;

    if (Object.keys(room.liarVotes).length === room.players.length) {
      const voteCounts = {};
      Object.values(room.liarVotes).forEach(tid => {
        voteCounts[tid] = (voteCounts[tid] || 0) + 1;
      });

      let maxVotes = 0;
      let votedTargetId = null;
      for (const [tid, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
          maxVotes = count;
          votedTargetId = tid;
        }
      }

      const votedPlayer = room.players.find(p => p.id === votedTargetId);
      io.to(roomId).emit('system_message', `🗳️ 투표 완료! 최다 득표자: [${votedPlayer ? votedPlayer.username : '없음'}] (${maxVotes}표)`);

      if (votedTargetId === room.liarId) {
        room.liarState = 'LIAR_GUESS';
        io.to(roomId).emit('system_message', `🎯 라이어를 찾았습니다! [${votedPlayer.username}]님은 라이어입니다.`);
        io.to(room.liarId).emit('prompt_liar_guess');
        io.to(roomId).emit('system_message', `🕵️ 라이어가 제시어를 입력 중입니다...`);
      } else {
        io.to(roomId).emit('system_message', `❌ [${votedPlayer.username}]님은 라이어가 아닙니다 (시민)!`);
        io.to(roomId).emit('rps_result', { orderList: room.speakingOrder });
        room.liarVotes = {};
        io.to(roomId).emit('start_liar_voting_phase', { players: room.players });
      }
    }
  });

  socket.on('submit_liar_guess', ({ roomId, guessWord }) => {
    const room = rooms[roomId];
    if (!room || room.liarState !== 'LIAR_GUESS' || socket.id !== room.liarId) return;

    room.gameStarted = false;
    room.liarState = 'LOBBY';

    if (guessWord.trim() === room.keyword) {
      io.to(roomId).emit('game_over', { 
        winner: `라이어 [${socket.username}]`, 
        reason: `제시어 [${room.keyword}] 정답을 맞추어 라이어 역전 승리!` 
      });
    } else {
      io.to(roomId).emit('game_over', { 
        winner: `시민팀`, 
        reason: `라이어가 제시어를 맞추지 못했습니다! (정답: ${room.keyword} / 입력: ${guessWord})` 
      });
    }
  });

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
          io.to(roomId).emit('game_over', { winner: username, reason: `목표 점수 ${room.targetScore}점 달성!` });
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
      io.to(roomId).emit('game_over', { loser, reason: '끝말잇기 시간 초과' });
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

server.listen(3000, () => console.log('서버 실행 중: http://localhost:3000'));
