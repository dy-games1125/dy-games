const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

// 카테고리별 대용량 제시어 리스트 (150개 이상)
const WORD_LIST = [
  // 음식 & 음료 & 디저트
  '사과', '바나나', '피자', '치킨', '삼겹살', '떡볶이', '마라탕', '초밥', '햄버거', '파스타',
  '돈까스', '짜장면', '짬뽕', '탕수육', '족발', '보쌈', '곱창', '냉면', '칼국수', '김밥',
  '라면', '순대', '계란말이', '감자탕', '부대찌개', '김치찌개', '된장찌개', '비빔밥', '갈비탕', '설렁탕',
  '아이스크림', '케이크', '마카롱', '빙수', '에그타르트', '붕어빵', '호떡', '츄러스', '와플', '소금빵',
  '아메리카노', '버블티', '스무디', '콜라', '사이다', '식혜', '생수', '우유', '요거트', '계란후라이',

  // 동물 & 식물 & 자연
  '호랑이', '사자', '코끼리', '기린', '하마', '악어', '펭귄', '판다', '강아지', '고양이',
  '토끼', '햄스터', '다람쥐', '늑대', '여우', '곰', '독수리', '참새', '비둘기', '부엉이',
  '고래', '상어', '돌고래', '오징어', '문어', '거북이', '카멜레온', '장미', '해바라기', '선인장',
  '단풍나무', '대나무', '벚꽃', '무궁화', '민들레', '태풍', '무지개', '번개', '오로라', '화산',

  // 장소 & 건축물
  '영화관', '놀이공원', '학교', '병원', '경찰서', '소방서', '도서관', '박물관', '미술관', '공항',
  '지하철역', '편의점', '대형마트', '백화점', '카페', '피씨방', '코인노래방', '워터파크', '해수욕장', '캠핑장',
  '남산타워', '경복궁', '자유의여신상', '에펠탑', '피사의사탑', '피라미드', '콜로세움', '아쿠아리움', '동물원', '미용실',
  '주유소', '은행', '약국', '우체국', '방송국', '법원', '기차역', '호텔', '글램핑장', '수목원',

  // 사물 & 가전 & 패션
  '스마트폰', '노트북', '태블릿', '냉장고', '세탁기', '에어컨', '선풍기', '청소기', '드라이기', '전자레인지',
  '에어프라이어', '티비', '스피커', '이어폰', '안경', '시계', '우산', '지갑', '거울', '빗',
  '청바지', '패딩', '운동화', '모자', '마스크', '수건', '치약', '칫솔', '베개', '이불',

  // 스포츠 & 취미 & 예술
  '축구', '농구', '야구', '배구', '테니스', '배드민턴', '탁구', '볼링', '골프', '수영',
  '스케이트', '스노우보드', '마라톤', '태권도', '유도', '피아노', '기타', '드럼', '바이올린', '사진촬영',
  '독서', '영화감상', '요리', '등산', '낚시', '캠핑', '보드게임', '마술', '발레', '비보잉',

  // 직업 & 인물
  '의사', '경찰관', '소방관', '교사', '요리사', '판사', '변호사', '비행기조종사', '승무원', '프로그래머',
  '아이돌', '배우', '개그맨', '유튜버', '웹툰작가', '운동선수', '건축가', '화가', '미용사', '군인',
  '과학자', '탐정', '우주비행사', '마술사', '지휘자', '외교관', '경호원', '기자', '성우', '농부',

  // 교통수단
  '버스', '지하철', '택시', '자전거', '킥보드', '오토바이', '비행기', '헬리콥터', '열차', 'KTX',
  '잠수함', '크루즈', '우주선', '트럭', '경찰차', '구급차', '소방차', '케이블카', '인력거', '열기구'
];

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {

  // 방 만들기
  socket.on('create_room', (nickname) => {
    const roomCode = generateRoomCode();
    const name = nickname.trim() || `플레이어_${socket.id.substring(0, 4)}`;

    rooms[roomCode] = {
      code: roomCode,
      players: [{ id: socket.id, name: name, choice: null, isLiar: false, votes: 0 }],
      playOrder: [],
      gameState: 'WAITING',
      currentTurnIndex: 0,
      turnTimer: null,
      currentWord: '',
      votedCount: 0,
      suspectLiarId: null
    };

    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('room_created', { roomCode: roomCode });
    updateRoomInfo(roomCode);
    io.to(roomCode).emit('system_message', `${name}님이 방을 생성하셨습니다.`);
  });

  // 방 참가를 위한 방 코드 입력
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
    room.players.push({ id: socket.id, name: name, choice: null, isLiar: false, votes: 0 });

    socket.join(targetCode);
    socket.roomCode = targetCode;

    socket.emit('room_joined', { roomCode: targetCode });
    updateRoomInfo(targetCode);
    io.to(targetCode).emit('system_message', `${name}님이 입장하셨습니다.`);
  });

  // 가위바위보 시작
  socket.on('start_rps', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (room.players.length < 2) {
      socket.emit('system_message', '최소 2명 이상이 모여야 시작할 수 있습니다.');
      return;
    }

    room.gameState = 'RPS';
    room.players.forEach(p => { p.choice = null; p.isLiar = false; p.votes = 0; });

    io.to(roomCode).emit('rps_started', '가위, 바위, 보 중 하나를 선택해 주세요!');

    startTimer(roomCode, 25, () => {
      const rpsOptions = ['가위', '바위', '보'];
      room.players.forEach(p => {
        if (!p.choice) p.choice = rpsOptions[Math.floor(Math.random() * 3)];
      });
      determineClockwiseOrder(roomCode);
    });
  });

  // 가위바위보 선택
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

  // 단어 입력
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

  // 투표 하기
  socket.on('submit_vote', (targetId) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (room.gameState !== 'VOTING') return;

    const targetPlayer = room.players.find(p => p.id === targetId);
    if (targetPlayer) {
      targetPlayer.votes = (targetPlayer.votes || 0) + 1;
    }

    room.votedCount++;

    if (room.votedCount >= room.players.length) {
      clearTimeout(room.turnTimer);
      processVoteResult(roomCode);
    }
  });

  // 라이어 정답 제출
  socket.on('submit_answer', (answer) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (room.gameState !== 'GUESSING') return;

    const suspect = room.players.find(p => p.id === room.suspectLiarId);
    if (socket.id !== suspect.id) return;

    clearTimeout(room.turnTimer);

    if (answer.trim() === room.currentWord) {
      io.to(roomCode).emit('game_over', {
        winner: 'LIAR',
        message: `🎉 라이어 [ ${suspect.name} ]님이 정답 [ ${room.currentWord} ]을(를) 맞췄습니다! (라이어 승리)`
      });
    } else {
      io.to(roomCode).emit('game_over', {
        winner: 'CITIZEN',
        message: `❌ 오답입니다! 정답은 [ ${room.currentWord} ]였습니다. (시민 승리)`
      });
    }
    resetGame(roomCode);
  });

  // 방 나가기
  socket.on('leave_room', () => {
    handleLeave(socket);
  });

  // 퇴장 처리
  socket.on('disconnect', () => {
    handleLeave(socket);
  });
});

function handleLeave(socket) {
  const roomCode = socket.roomCode;
  if (!roomCode || !rooms[roomCode]) return;

  const room = rooms[roomCode];
  const player = room.players.find(p => p.id === socket.id);

  if (player) {
    io.to(roomCode).emit('system_message', `${player.name}님이 퇴장하셨습니다.`);
  }

  socket.leave(roomCode);
  socket.roomCode = null;

  room.players = room.players.filter(p => p.id !== socket.id);
  room.playOrder = room.playOrder.filter(p => p.id !== socket.id);

  if (room.players.length === 0) {
    clearTimeout(room.turnTimer);
    delete rooms[roomCode];
  } else {
    updateRoomInfo(roomCode);
    if (room.players.length < 2 && room.gameState !== 'WAITING') {
      clearTimeout(room.turnTimer);
      io.to(roomCode).emit('system_message', '인원이 부족하여 게임을 대기 상태로 전환합니다.');
      resetGame(roomCode);
    }
  }
}

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

  room.currentTurnIndex++;

  if (room.currentTurnIndex >= room.playOrder.length) {
    startVotePhase(roomCode);
  } else {
    broadcastTurn(roomCode);
  }
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

function startVotePhase(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  room.gameState = 'VOTING';
  room.votedCount = 0;
  room.players.forEach(p => p.votes = 0);

  io.to(roomCode).emit('start_voting', {
    players: room.players.map(p => ({ id: p.id, name: p.name }))
  });

  startTimer(roomCode, 25, () => {
    processVoteResult(roomCode);
  });
}

function processVoteResult(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  let mostVotedPlayer = room.players[0];
  room.players.forEach(p => {
    if (p.votes > mostVotedPlayer.votes) {
      mostVotedPlayer = p;
    }
  });

  io.to(roomCode).emit('system_message', `🗳️ 지목 결과: [ ${mostVotedPlayer.name} ]님이 지목되었습니다!`);

  if (mostVotedPlayer.isLiar) {
    room.gameState = 'GUESSING';
    room.suspectLiarId = mostVotedPlayer.id;

    io.to(roomCode).emit('liar_caught', {
      liarId: mostVotedPlayer.id,
      liarName: mostVotedPlayer.name
    });

    startTimer(roomCode, 25, () => {
      io.to(roomCode).emit('game_over', {
        winner: 'CITIZEN',
        message: `⏰ 시간 초과! 라이어가 제시어를 맞히지 못했습니다. (시민 승리)`
      });
      resetGame(roomCode);
    });
  } else {
    io.to(roomCode).emit('system_message', `❌ [ ${mostVotedPlayer.name} ]님은 라이어가 아닙니다! 다시 게임을 진행합니다.`);
    room.currentTurnIndex = 0;
    room.gameState = 'PLAYING';
    broadcastTurn(roomCode);
  }
}

function resetGame(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  clearTimeout(room.turnTimer);
  room.gameState = 'WAITING';
  room.currentTurnIndex = 0;
  room.votedCount = 0;
  room.suspectLiarId = null;
  io.to(roomCode).emit('reset_to_waiting');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
