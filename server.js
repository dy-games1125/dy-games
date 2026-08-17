const http = require('http');
const express = require('express');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
const turnTimers = {};

// 라이어 게임 단어 100종류 (카테고리당 25개씩 총 100개)
const liarWords = {
  음식: [
    '피자', '치킨', '햄버거', '떡볶이', '초밥', '짜장면', '삼겹살', '라면', '김밥', '냉면',
    '족발', '보쌈', '파스타', '스테이크', '카레', '탕수육', '짬뽕', '볶음밥', '순대', '국밥',
    '만두', '우동', '돈가스', '샌드위치', '타코'
  ],
  동물: [
    '사자', '코끼리', '원숭이', '기린', '펭귄', '호랑이', '돌고래', '토끼', '악어', '하마',
    '얼룩말', '캥거루', '다람쥐', '여우', '늑대', '곰', '판다', '치타', '수달', '너구리',
    '햄스터', '고슴도치', '부엉이', '독수리', '타조'
  ],
  장소: [
    '학교', '병원', '영화관', '놀이공원', '공항', '도서관', '해수욕장', '경찰서', '소방서', '우체국',
    '마트', '백화점', '편의점', '식당', '카페', '미용실', '약국', '박물관', '미술관', '놀이터',
    '동물원', '식물원', '수영장', '헬스장', 'PC방'
  ],
  물건: [
    '컴퓨터', '스마트폰', '냉장고', '선풍기', '자동차', '시계', '안경', '이어폰', '텔레비전', '에어컨',
    '세탁기', '청소기', '전자레인지', '다리미', '드라이기', '가위', '풀', '지우개', '연필', '노트북',
    '마우스', '키보드', '스피커', '텀블러', '우산'
  ]
};

// 초성 퀴즈 문제 100종류 (난이도 및 길이에 따른 차등 점수 부여를 위해 length 속성 포함)
const choseongList = [
  // 2글자 (기본 점수: 3점)
  { choseong: 'ㅎㄱ', answer: '학교', length: 2 },
  { choseong: 'ㄱㅇ', answer: '게임', length: 2 },
  { choseong: 'ㅁㅎ', answer: '만화', length: 2 },
  { choseong: 'ㅊㅅ', answer: '천사', length: 2 },
  { choseong: 'ㅅㄱ', answer: '사과', length: 2 },
  { choseong: 'ㅂㄴ', answer: '바나', length: 2 },
  { choseong: 'ㅊㄱ', answer: '친구', length: 2 },
  { choseong: 'ㄴㄱ', answer: '나무', length: 2 },
  { choseong: 'ㅂㄷ', answer: '바다', length: 2 },
  { choseong: 'ㅎ늘', answer: '하늘', length: 2 },
  { choseong: 'ㅈㄷ', answer: '지도', length: 2 },
  { choseong: 'ㅁㅊ', answer: '모차', length: 2 },
  { choseong: 'ㅅㅂ', answer: '신발', length: 2 },
  { choseong: 'ㅁㅅ', answer: '모자', length: 2 },
  { choseong: 'ㅇㅈ', answer: '안경', length: 2 },
  { choseong: 'ㄱㅊ', answer: '김치', length: 2 },
  { choseong: 'ㅁㅇ', answer: '마음', length: 2 },
  { choseong: 'ㅂㅋ', answer: '바퀴', length: 2 },
  { choseong: 'ㅅㅈ', answer: '사자', length: 2 },
  { choseong: 'ㅇㄱ', answer: '아기', length: 2 },
  { choseong: 'ㅈㅂ', answer: '지갑', length: 2 },
  { choseong: 'ㅊㅁ', answer: '추억', length: 2 },
  { choseong: 'ㅋㅍ', answer: '커피', length: 2 },
  { choseong: 'ㅌㄲ', answer: '토끼', length: 2 },
  { choseong: 'ㅍㄷ', answer: '포도', length: 2 },

  // 3글자 (중간 점수: 5점)
  { choseong: 'ㅋㅍㅌ', answer: '컴퓨터', length: 3 },
  { choseong: 'ㅅㅎㅈ', answer: '신발장', length: 3 },
  { choseong: 'ㄷㄹㅁ', answer: '드라마', length: 3 },
  { choseong: 'ㄱㄹㅂ', answer: '고릴라', length: 3 },
  { choseong: 'ㄴㄱㅂ', answer: '냉장고', length: 3 },
  { choseong: 'ㅅㄴㄱ', answer: '세탁기', length: 3 },
  { choseong: 'ㅇㅎㄱ', answer: '영화관', length: 3 },
  { choseong: 'ㅈㄷㄱ', answer: '자전거', length: 3 },
  { choseong: 'ㅊㅅㄱ', answer: '책상머', length: 3 },
  { choseong: 'ㅋㄹㅁ', answer: '카메라', length: 3 },
  { choseong: 'ㅍㄹㅅ', answer: '피아노', length: 3 },
  { choseong: 'ㅎㅁㅂ', answer: '햄버거', length: 3 },
  { choseong: 'ㄱㄴㅅ', answer: '기니피', length: 3 },
  { choseong: 'ㄷㅌㅁ', answer: '도토미', length: 3 },
  { choseong: 'ㅁㅎㄱ', answer: '무화과', length: 3 },
  { choseong: 'ㅂㅅㅋ', answer: '바스켓', length: 3 },
  { choseong: 'ㅅㅌㄹ', answer: '스토리', length: 3 },
  { choseong: 'ㅇㅇㅈ', answer: '이어폰', length: 3 },
  { choseong: 'ㅈㅇㄱ', answer: '종이컵', length: 3 },
  { choseong: 'ㅊㄹㅅ', answer: '초콜릿', length: 3 },
  { choseong: 'ㅋㅌㅂ', answer: '카테고', length: 3 },
  { choseong: 'ㅌㅍㄱ', answer: '테니스', length: 3 },
  { choseong: 'ㅍㄹㄷ', answer: '파란색', length: 3 },
  { choseong: 'ㅎㄷㄱ', answer: '핫도그', length: 3 },
  { choseong: 'ㄱㅂㄱ', answer: '갈비구', length: 3 },

  // 4글자 (높은 점수: 7점)
  { choseong: 'ㄷㅎㅁㄱ', answer: '대한민국', length: 4 },
  { choseong: 'ㅅㄱㅂㄴ', answer: '사과바나', length: 4 },
  { choseong: 'ㄴㄹㅇㄷ', answer: '노래방이', length: 4 },
  { choseong: 'ㄷㅅㄴㅁ', answer: '단풍나무', length: 4 },
  { choseong: 'ㅁㄱㄹㅇ', answer: '미국러시', length: 4 },
  { choseong: 'ㅂㄹㅅㅌ', answer: '바람소리', length: 4 },
  { choseong: 'ㅅㅈㄱㅁ', answer: '사장님께', length: 4 },
  { choseong: 'ㅇㄹㅁㄷ', answer: '올림피아', length: 4 },
  { choseong: 'ㅈㄷㄱㅅ', answer: '자동계산', length: 4 },
  { choseong: 'ㅊㄱㅇㅅ', answer: '친구와삼', length: 4 },
  { choseong: 'ㅋㅍㅅㅌ', answer: '카푸치노', length: 4 },
  { choseong: 'ㅌㄹㅂㅈ',.answer: '텔레비전', length: 4 },
  { choseong: 'ㅍㄹㅇㄷ', answer: '프라이드', length: 4 },
  { choseong: 'ㅎㄱㅁㅌ', answer: '한국마트', length: 4 },
  { choseong: 'ㄱㅊㅊㄱ', answer: '가치체계', length: 4 },
  { choseong: 'ㄴㅁㅂㄷ', answer: '나무바다', length: 4 },
  { choseong: 'ㄷㄹㅂㅅ', answer: '다람쥐상', length: 4 },
  { choseong: 'ㅁㄹㅋㄹ', answer: '마카로니', length: 4 },
  { choseong: 'ㅂㅂㅂㅋ', answer: '바비큐파', length: 4 },
  { choseong: 'ㅅㅅㅎㄱ', answer: '새로운학', length: 4 },
  { choseong: 'ㅇㅇㅌㅂ', answer: '아이패드', length: 4 },
  { choseong: 'ㅈㅈㄹㅂ', answer: '전자레인', length: 4 },
  { choseong: 'ㅊㅊㅂㄹ', answer: '축축한바', length: 4 },
  { choseong: 'ㅋㅁㄴㅌ', answer: '커뮤니티', length: 4 },
  { choseong: 'ㅌㅇㅁㅋ', answer: '타이머신', length: 4 },

  // 5글자 이상 (최고 점수: 10점)
  { choseong: 'ㅇㄹㄷㅅㅋ', answer: '울산대공원', length: 5 },
  { choseong: 'ㅂㄹㅁㅇㄷ', answer: '바람이불어', length: 5 },
  { choseong: 'ㅅㄷㅅㅋㅇ', answer: '스파이더맨', length: 5 },
  { choseong: 'ㅊㄱㅂㅅㄷ', answer: '친구와식사', length: 5 },
  { choseong: 'ㅋㅁㄴㅋㅇ', answer: '커뮤니케이션', length: 6 },
  { choseong: 'ㄷㅎㅁㄱㅁ', answer: '대한민국만세', length: 6 },
  { choseong: 'ㅅㄱㅁㅎㄱ', answer: '세계문화유산', length: 6 },
  { choseong: 'ㅈㄷㅊㅈㅂ', answer: '자동차정비소', length: 6 },
  { choseong: 'ㅇㄹㅂㄹㅅ', answer: '올라브리세', length: 5 },
  { choseong: 'ㄱㅁㅊㄱㅇ', answer: '가장친한친구', length: 6 },
  { choseong: 'ㄴㄹㅂㅈㅋ', answer: '노래방지키미', length: 6 },
  { choseong: 'ㄷㄱㄹㅁㄴ', answer: '돌고래만나러', length: 6 },
  { choseong: 'ㅁㅎㅎㄴㅈ', answer: '무한한능력자', length: 6 },
  { choseong: 'ㅂㅅㅎㄱㅈ', answer: '부산해운대구', length: 6 },
  { choseong: 'ㅅㅅㅎㄷㅁ', answer: '새로운해도지', length: 6 },
  { choseong: 'ㅇㅈㅁㄷㄱ', answer: '인터넷무료게', length: 6 },
  { choseong: 'ㅈㅈㅅㄷㄱ', answer: '전자식도어락', length: 6 },
  { choseong: 'ㅊㄱㅇㅅㅅ', answer: '친구의생일선', length: 6 },
  { choseong: 'ㅋㅍㅅㅇㅅ', answer: '커피숍에서여', length: 6 },
  { choseong: 'ㅌㄱㅅㅇㅈ', answer: '특급소방안전', length: 6 },
  { choseong: 'ㅍㄹㅅㅌㅎ', answer: '파란색토마토', length: 6 },
  { choseong: 'ㅎㄱㅈㄷㄱ', answer: '한국지도로드', length: 6 },
  { choseong: 'ㄱㅈㅇㅅㄱ', answer: '가장맛있는구', length: 6 },
  { choseong: 'ㄴㅁㄱㄹㅅ', answer: '나무그릇세트', length: 6 },
  { choseong: 'ㄷㄹㅁㅌㅅ', answer: '드라마토토사', length: 6 }
];

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
        shiritoriMinLen: 2,
        shiritoriTime: 15,
        choseongTargetScore: 20
      },
      players: [{ id: socket.id, username, isDead: false, score: 0 }],
      rpsChoices: {},
      usedWords: [],
      lastWord: '',
      turnIndex: 0,
      liarData: { secretWord: '', liarId: null },
      choseongData: { currentIndex: 0, currentProblem: null }
    };

    socket.join(roomId);
    socket.emit('join_success', { roomId });
    io.to(roomId).emit('update_room', rooms[roomId]);
    io.to(roomId).emit('system_message', `${username}님이 방을 만들었습니다.`);
  });

  socket.on('join_room', ({ roomId, username }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('system_message', '존재하지 않는 방 코드입니다.');
    if (room.gameStarted) return socket.emit('system_message', '이미 게임이 시작된 방입니다.');

    currentRoomId = roomId;
    currentUsername = username;
    room.players.push({ id: socket.id, username, isDead: false, score: 0 });

    socket.join(roomId);
    socket.emit('join_success', { roomId });
    io.to(roomId).emit('update_room', room);
    io.to(roomId).emit('system_message', `${username}님이 입장했습니다.`);
  });

  socket.on('leave_room', () => { handleLeaveRoom(socket); });
  socket.on('disconnect', () => { handleLeaveRoom(socket); });

  function clearRoomTimer(roomId) {
    if (turnTimers[roomId]) {
      clearTimeout(turnTimers[roomId]);
      delete turnTimers[roomId];
    }
  }

  function handleLeaveRoom(sock) {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    room.players = room.players.filter(p => p.id !== sock.id);

    if (room.players.length === 0) {
      clearRoomTimer(currentRoomId);
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
      clearRoomTimer(roomId);

      if (room.gameMode === 'liar') {
        let cat = room.options.liarCategory;
        let categories = Object.keys(liarWords);
        if (cat === 'all') {
          cat = categories[Math.floor(Math.random() * categories.length)];
        }
        const words = liarWords[cat] || liarWords['음식'];
        const secretWord = words[Math.floor(Math.random() * words.length)];
        const randomPlayer = room.players[Math.floor(Math.random() * room.players.length)];
        room.liarData = { secretWord, liarId: randomPlayer.id, category: cat };

        room.players.forEach(p => {
          const isLiar = p.id === randomPlayer.id;
          io.to(p.id).emit('liar_role_assign', {
            isLiar,
            category: cat,
            word: isLiar ? '?? (당신은 라이어입니다!)' : secretWord
          });
        });
      } else if (room.gameMode === 'choseong') {
        const prob = choseongList[Math.floor(Math.random() * choseongList.length)];
        room.choseongData.currentProblem = prob;
        io.to(roomId).emit('choseong_new_problem', { choseong: prob.choseong });
      } else if (room.gameMode === 'shiritori') {
        room.lastWord = '';
      }

      io.to(roomId).emit('update_room', room);
      io.to(roomId).emit('start_game_ui', { gameMode: room.gameMode, initialWord: room.lastWord });
      io.to(roomId).emit('system_message', `게임(${room.gameMode.toUpperCase()})이 시작되었습니다!`);
    }
  });

  // 초성 퀴즈: 길이에 따른 차등 점수 지급 로직 적용
  socket.on('submit_choseong_answer', ({ roomId, answer }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || room.gameMode !== 'choseong') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.isDead) return;

    const currentProb = room.choseongData.currentProblem;
    if (currentProb && answer.trim() === currentProb.answer) {
      // 길이에 따른 차등 점수 계산 (2글자: 3점, 3글자: 5점, 4글자: 7점, 5글자 이상: 10점)
      let earnedScore = 3;
      if (currentProb.length === 3) earnedScore = 5;
      else if (currentProb.length === 4) earnedScore = 7;
      else if (currentProb.length >= 5) earnedScore = 10;

      player.score += earnedScore;
      io.to(roomId).emit('system_message', `🎉 [정답] ${currentUsername}님이 정답("${currentProb.answer}")을 맞췄습니다! (+${earnedScore}점)`);

      const targetScore = room.options.choseongTargetScore || 20;
      if (player.score >= targetScore) {
        room.gameStarted = false;
        const sortedScores = room.players.map(p => ({ username: p.username, score: p.score })).sort((a, b) => b.score - a.score);
        io.to(roomId).emit('show_final_ranking', sortedScores);
        io.to(roomId).emit('update_room', room);
        io.to(roomId).emit('system_message', `🏆 ${player.username}님이 목표 점수에 도달하여 승리했습니다!`);
        return;
      }

      const nextProb = choseongList[Math.floor(Math.random() * choseongList.length)];
      room.choseongData.currentProblem = nextProb;
      io.to(roomId).emit('choseong_new_problem', { choseong: nextProb.choseong });
    } else {
      socket.emit('system_message', `❌ [오류] 틀렸습니다: "${answer}"`);
    }
  });

  socket.on('end_game_by_host', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id) {
      room.gameStarted = false;
      clearRoomTimer(roomId);
      const sortedScores = room.players.map((p) => ({
        username: p.username,
        score: p.score || 10
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

    if (Object.keys(room.rpsChoices).length === room.players.filter(p => !p.isDead).length) {
      const choicesArr = Object.values(room.rpsChoices);
      const uniqueChoices = [...new Set(choicesArr.map(item => item.choice))];

      if (uniqueChoices.length === 3 || uniqueChoices.length === 1) {
        room.rpsChoices = {};
        io.to(roomId).emit('rps_draw', { message: '가위바위보가 비겼습니다! 다시 선택해주세요.' });
        return;
      }

      let winningChoice = '';
      if (uniqueChoices.includes('scissors') && uniqueChoices.includes('paper')) winningChoice = 'scissors';
      else if (uniqueChoices.includes('paper') && uniqueChoices.includes('rock')) winningChoice = 'paper';
      else if (uniqueChoices.includes('rock') && uniqueChoices.includes('scissors')) winningChoice = 'rock';

      const winners = room.players.filter(p => !p.isDead && room.rpsChoices[p.id] && room.rpsChoices[p.id].choice === winningChoice);

      if (winners.length === 1) {
        const winner = winners[0];
        room.turnIndex = room.players.findIndex(p => p.id === winner.id);
        
        io.to(roomId).emit('rps_result', { winner: winner.username, nextTurnId: winner.id });
        io.to(roomId).emit('system_message', `가위바위보 승리자: ${winner.username}님! 첫 번째 순서로 시작합니다.`);

        if (room.gameMode === 'shiritori') {
          startShiritoriTurnTimer(roomId);
        }
      } else {
        room.rpsChoices = {};
        io.to(roomId).emit('rps_draw', { message: '승자가 여러 명입니다! 다시 가위바위보를 진행합니다.' });
      }
    }
  });

  function nextAliveTurn(room) {
    let count = 0;
    do {
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      count++;
      if (count > room.players.length) break;
    } while (room.players[room.turnIndex].isDead);
  }

  function startShiritoriTurnTimer(roomId) {
    clearRoomTimer(roomId);
    const room = rooms[roomId];
    if (!room || !room.gameStarted) return;

    const timeLimit = (room.options.shiritoriTime || 15) * 1000;
    const currentTurnPlayer = room.players[room.turnIndex];

    turnTimers[roomId] = setTimeout(() => {
      currentTurnPlayer.isDead = true;
      io.to(roomId).emit('system_message', `⏰ [시간초과] ${currentTurnPlayer.username}님이 제한시간 내에 단어를 입력하지 못해 탈락했습니다!`);

      const alivePlayers = room.players.filter(p => !p.isDead);
      if (alivePlayers.length <= 1) {
        room.gameStarted = false;
        clearRoomTimer(roomId);
        const winnerName = alivePlayers.length === 1 ? alivePlayers[0].username : '없음';
        io.to(roomId).emit('system_message', `🎉 게임 종료! 승리자: ${winnerName}`);
        
        const sortedScores = room.players.map((p) => ({
          username: p.username,
          score: p.isDead ? 10 : 30
        })).sort((a, b) => b.score - a.score);

        io.to(roomId).emit('show_final_ranking', sortedScores);
        io.to(roomId).emit('update_room', room);
        return;
      }

      nextAliveTurn(room);
      const nextPlayer = room.players[room.turnIndex];

      io.to(roomId).emit('timeout_next_turn', {
        nextTurnId: nextPlayer.id,
        nextTurnName: nextPlayer.username,
        players: room.players
      });

      startShiritoriTurnTimer(roomId);
    }, timeLimit);
  }

  socket.on('surrender_shiritori', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted) return;

    const currentPlayer = room.players[room.turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) return;

    clearRoomTimer(roomId);
    currentPlayer.isDead = true;
    io.to(roomId).emit('system_message', `🏳️ [기권] ${currentPlayer.username}님이 기권하였습니다.`);

    const alivePlayers = room.players.filter(p => !p.isDead);
    if (alivePlayers.length <= 1) {
      room.gameStarted = false;
      const winnerName = alivePlayers.length === 1 ? alivePlayers[0].username : '없음';
      io.to(roomId).emit('system_message', `🎉 게임 종료! 승리자: ${winnerName}`);
      
      const sortedScores = room.players.map((p) => ({
        username: p.username,
        score: p.isDead ? 10 : 30
      })).sort((a, b) => b.score - a.score);

      io.to(roomId).emit('show_final_ranking', sortedScores);
      io.to(roomId).emit('update_room', room);
      return;
    }

    nextAliveTurn(room);
    const nextPlayer = room.players[room.turnIndex];

    io.to(roomId).emit('timeout_next_turn', {
      nextTurnId: nextPlayer.id,
      nextTurnName: nextPlayer.username,
      players: room.players
    });

    startShiritoriTurnTimer(roomId);
  });

  function getValidAllowedChars(lastChar) {
    let chars = [lastChar];
    if (lastChar === '녀' || lastChar === '뇨' || lastChar === '뉴' || lastChar === '니') chars.push('여', '요', '유', '이');
    if (lastChar === '랴' || lastChar === '려' || lastChar === '례' || lastChar === '료' || lastChar === '류' || lastChar === '리') chars.push('야', '여', '예', '요', '유', '이');
    if (lastChar === '라' || lastChar === '래' || lastChar === '로' || lastChar === '록' || lastChar === '뢰' || lastChar === '루' || lastChar === '륭' || lastChar === '륵') {
      chars.push(lastChar.replace('ㄹ', 'ㄴ'));
    }
    return chars;
  }

  socket.on('game_input_word', ({ roomId, word }) => {
    const room = rooms[roomId];
    if (!room) return;

    const currentPlayer = room.players[room.turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) {
      return socket.emit('system_message', '[오류] 현재 차례가 아닙니다!');
    }

    const trimmedWord = word.trim();
    const minLen = room.options.shiritoriMinLen || 2;

    if (trimmedWord.length < minLen) {
      return socket.emit('system_message', `[오류] 단어는 ${minLen}글자 이상이어야 합니다.`);
    }

    if (room.usedWords.includes(trimmedWord)) {
      return socket.emit('system_message', `[오류] 이미 사용된 단어입니다: "${trimmedWord}"`);
    }

    if (room.lastWord.length > 0) {
      const lastChar = room.lastWord.slice(-1);
      const firstChar = trimmedWord.charAt(0);
      const allowedFirstChars = getValidAllowedChars(lastChar);

      if (!allowedFirstChars.includes(firstChar)) {
        return socket.emit('system_message', `[오류] "${lastChar}"(두음법칙 포함: ${allowedFirstChars.join(', ')})(으)로 시작하는 단어를 입력해야 합니다.`);
      }
    }

    clearRoomTimer(roomId);

    room.usedWords.push(trimmedWord);
    room.lastWord = trimmedWord;

    nextAliveTurn(room);
    const nextPlayer = room.players[room.turnIndex];

    io.to(roomId).emit('update_game_word', { 
      username: currentUsername, 
      word: trimmedWord, 
      nextTurnId: nextPlayer.id, 
      nextTurnName: nextPlayer.username,
      usedWords: room.usedWords 
    });
    io.to(roomId).emit('system_message', `[진행] ${currentUsername}님 입력: ${trimmedWord} -> 다음 차례: ${nextPlayer.username}님`);

    if (room.gameMode === 'shiritori') {
      startShiritoriTurnTimer(roomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
