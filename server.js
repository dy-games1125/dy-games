const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// 방별 데이터 저장 객체
const rooms = {};

const WORD_LIST = [
  '사과', '바나나', '피자', '치킨', '삼겹살', '떡볶이', '마라탕', '초밥', '햄버거', '파스타',
  '돈까스', '짜장면', '짬뽕', '탕수육', '족발', '보쌈', '곱창', '냉면', '칼국수', '김밥',
  '호랑이', '사자', '코끼리', '기린', '하마', '악어', '펭귄', '판다', '강아지', '고양이',
  '영화관', '놀이공원', '학교', '병원', '경찰서', '소방서', '도서관', '박물관', '공항',
  '스마트폰', '노트북', '태블릿', '냉장고', '세탁기', '에어컨', '선풍기', '청소기',
  '축구', '농구', '야구', '배구', '테니스', '배드민턴', '탁구', '볼링', '골프', '수영',
  '의사', '경찰관', '소방관', '교사', '요리사', '판사', '변호사', '아이돌', '배우', '유튜버'
];

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {

  // 1. 방 만들기
  socket.on('create_room', (nickname) => {
    const roomCode = generateRoomCode();
    const name = nickname.trim() || `플레이어_${socket.id.substring(0, 4)}`;

    rooms[roomCode] = {
      code: roomCode,
      players: [{ id: socket.id, name: name, choice: null, isLiar: false }],
      playOrder: [],
      gameState: 'WAITING',
      currentTurnIndex: 0,
      turnTimer: null,
      currentWord: ''
    };

    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('room_created', { roomCode: roomCode });
    updateRoomInfo(roomCode);
    io.to(roomCode).emit('system_message', `${name}님이 방을 생성하셨습니다.`);
  });

  // 2. 방 참가를 위한 방 코드 입력
  socket.on('join_room', (data) => {
    const { roomCode, nickname } = data;
    const targetCode = roomCode.trim().toUpperCase();

    if (!rooms[targetCode]) {
      socket.emit('system_message', '존재하지 않는 방 코드입니다.');
      return;
    }

    const room = rooms[targetCode];
    if (room.gameState !== 'WAITING') {
      socket.emit('system_message', '이미 게임이 진행 중인 방입니다.');
      return;
    }

    const name = nickname.trim() || `플레이어_${socket.id.substring(0, 4)}`;
    room.players.push({ id: socket.id, name: name, choice: null, isLiar: false });

    socket.join(targetCode);
    socket.roomCode = targetCode;

    socket.emit('room_joined', { roomCode: targetCode });
    updateRoomInfo(targetCode);
    io.to(targetCode).emit('system_message', `${name}님이 입장하셨습니다.`);
  });

  // 3. 가위바위보 시작
  socket.on('start_rps', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (room.players.length < 2) {
      socket.emit('system_message', '최소 2명 이상이 모여야 시작할 수 있습니다.');
      return;
    }

    room.gameState = 'RPS';
    room.players.forEach(p => { p.choice = null; p.isLiar = false; });

    io.to(roomCode).emit('rps_started', '가위, 바위, 보 중 하나를 선택해 주세요!');

    startTimer(roomCode, 25, () => {
      const rpsOptions = ['가위', '바위', '보'];
      room.players.forEach(p => {
        if (!p.choice) p.choice = rpsOptions[Math.floor(Math.random() * 3)];
      });
      determineClockwiseOrder(roomCode);
    });
  });

  // 4. 가위바위보 선택 수신
  socket.on('submit_rps', (choice) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.choice = choice;
      io.to(roomCode).emit('system_message', `${player.name}님이 선택을 완료했습니다.`);
    }

    if (room.players.every(p => p.choice !== null)) {
      clearTimeout(room.turnTimer);
      determineClockwiseOrder(roomCode);
    }
  });

  // 5. 단어 입력
  socket.on('send_word', (word) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (room.gameState !== 'PLAYING') return;

    const currentTurnPlayer = room.playOrder[room.currentTurnIndex];
    if (socket.id !== currentTurnPlayer.id) {
      socket.emit('system_message', '아직 본인의 순서가 아닙니다!');
      return;
    }

    clearTimeout(room.turnTimer);

    io.to(roomCode).emit('receive_word', {
      sender: currentTurnPlayer.name,
      word: word
    });

    nextTurn(roomCode);
  });

  // 퇴장 처리
  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    const player = room.players.find(p => p.id === socket.id);

    if (player) {
      io.to(roomCode).emit('system_message', `${player.name}님이 퇴장하셨습니다.`);
    }

    room.players = room.players.filter(p => p.id !== socket.id);
    room.playOrder = room.playOrder.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      clearTimeout(room.turnTimer);
      delete rooms[roomCode];
    } else {
      updateRoomInfo(roomCode);
    }
  });
});

function updateRoomInfo(roomCode) {
  const room = rooms[roomCode];
  if (room) {
    io.to(roomCode).emit('player_list_update', {
      players: room.players,
      roomCode: roomCode
    });
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

function determineClockwiseOrder(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const rpsValue = { '가위': 1, '바위': 2, '보': 3 };

  let tempPlayers = [...room.players].sort((a, b) => {
    let scoreA = rpsValue[a.choice] || 0;
    let scoreB = rpsValue[b.choice] || 0;
    if (scoreA === scoreB) return Math.random() - 0.5;
    return scoreB - scoreA;
  });

  const winner = tempPlayers[0];
  const winnerIndex = room.players.findIndex(p => p.id === winner.id);

  room.playOrder = [
    ...room.players.slice(winnerIndex),
    ...room.players.slice(0, winnerIndex)
  ];

  room.currentWord = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
  const liarIndex = Math.floor(Math.random() * room.playOrder.length);

  room.playOrder.forEach((p, idx) => {
    if (idx === liarIndex) {
      p.isLiar = true;
      io.to(p.id).emit('system_message', '🤫 당신은 [라이어]입니다! 정체를 숨기세요.');
    } else {
      p.isLiar = false;
      io.to(p.id).emit('system_message', `🔑 이번 판 제시어는 [ ${room.currentWord} ] 입니다.`);
    }
  });

  room.gameState = 'PLAYING';
  room.currentTurnIndex = 0;

  io.to(roomCode).emit('rps_result', {
    winner: winner,
    order: room.playOrder
  });

  broadcastTurn(roomCode);
}

function nextTurn(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.playOrder.length;
  broadcastTurn(roomCode);
}

function broadcastTurn(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const currentTurnPlayer = room.playOrder[room.currentTurnIndex];
  io.to(roomCode).emit('turn_update', {
    currentPlayer: currentTurnPlayer.name,
    currentPlayerId: currentTurnPlayer.id
  });

  startTimer(roomCode, 25, () => {
    io.to(roomCode).emit('system_message', `⏰ 시간 초과! ${currentTurnPlayer.name}님의 순서가 지나갔습니다.`);
    nextTurn(roomCode);
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
