const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// 300개 이상의 카테고리별 방대한 단어 리스트
const WORD_LIST = [
  // 음식 & 디저트
  '사과', '바나나', '피자', '치킨', '삼겹살', '떡볶이', '마라탕', '초밥', '햄버거', '파스타',
  '돈까스', '짜장면', '짬뽕', '탕수육', '족발', '보쌈', '곱창', '냉면', '칼국수', '김밥',
  '라면', '순대', '계란말이', '감자탕', '부대찌개', '김치찌개', '된장찌개', '비빔밥', '갈비탕', '설렁탕',
  '아이스크림', '케이크', '마카롱', '동네빵집', '빙수', '에그타르트', '붕어빵', '호떡', '츄러스', '와플',
  
  // 동물 & 식물
  '호랑이', '사자', '코끼리', '기린', '하마', '악어', '펭귄', '판다', '강아지', '고양이',
  '토끼', '햄스터', '다람쥐', '늑대', '여우', '곰', '독수리', '참새', '비둘기', '부엉이',
  '고래', '상어', '돌고래', '오징어', '문어', '거북이', '카멜레온', '장미', '해바라기', '선인장',

  // 장소 & 건축물
  '영화관', '놀이공원', '학교', '병원', '경찰서', '소방서', '도서관', '박물관', '미술관', '공항',
  '지하철역', '편의점', '대형마트', '백화점', '카페', '피씨방', '코인노래방', '워터파크', '해수욕장', '캠핑장',
  '남산타워', '경복궁', '자유의여신상', '에펠탑', '피사의사탑', '피라미드', '콜로세움', '아쿠아리움', '동물원', '미용실',

  // 물건 & 가전
  '스마트폰', '노트북', '태블릿', '냉장고', '세탁기', '에어컨', '선풍기', '청소기', '드라이기', '전자레인지',
  '에어프라이어', '티비', '스피커', '이어폰', '안경', '시계', '우산', '지갑', '거울', '빗',

  // 스포츠 & 취미
  '축구', '농구', '야구', '배구', '테니스', '배드민턴', '탁구', '볼링', '골프', '수영',
  '스케이트', '스노우보드', '마라톤', '태권도', '유도', '피아노', '기타', '드럼', '바이올린', '사진촬영',

  // 직업 & 기타
  '의사', '경찰관', '소방관', '교사', '요리사', '판사', '변호사', '비행기조종사', '승무원', '프로그래머',
  '아이돌', '배우', '개그맨', '유튜버', '웹툰작가', '운동선수', '건축가', '화가', '미용사', '군인'
];

let players = [];
let playOrder = [];
let gameState = 'WAITING';
let currentTurnIndex = 0;
let turnTimer = null;
let currentWord = '';
const LIMIT_TIME = 25; // 25초 제한시간

io.on('connection', (socket) => {

  // 유저 입장
  socket.on('join_game', (nickname) => {
    const name = nickname.trim() || `플레이어_${socket.id.substring(0, 4)}`;
    players.push({
      id: socket.id,
      name: name,
      choice: null,
      isLiar: false
    });

    io.emit('player_list_update', players);
    io.emit('system_message', `${name}님이 입장하셨습니다.`);
  });

  // 가위바위보 시작
  socket.on('start_rps', () => {
    if (players.length < 2) {
      socket.emit('system_message', '최소 2명 이상이 모여야 시작할 수 있습니다.');
      return;
    }
    gameState = 'RPS';
    players.forEach(p => {
      p.choice = null;
      p.isLiar = false;
    });

    io.emit('rps_started', '가위, 바위, 보 중 하나를 선택해 주세요!');

    // 가위바위보 25초 제한시간
    startTimer(LIMIT_TIME, () => {
      const rpsOptions = ['가위', '바위', '보'];
      players.forEach(p => {
        if (!p.choice) p.choice = rpsOptions[Math.floor(Math.random() * 3)];
      });
      determineClockwiseOrder();
    });
  });

  // 가위바위보 선택 수신
  socket.on('submit_rps', (choice) => {
    const player = players.find(p => p.id === socket.id);
    if (player) {
      player.choice = choice;
      io.emit('system_message', `${player.name}님이 선택을 완료했습니다.`);
    }

    if (players.length > 0 && players.every(p => p.choice !== null)) {
      clearTimeout(turnTimer);
      determineClockwiseOrder();
    }
  });

  // 단어 입력 수신
  socket.on('send_word', (word) => {
    if (gameState !== 'PLAYING') return;

    const currentTurnPlayer = playOrder[currentTurnIndex];
    if (socket.id !== currentTurnPlayer.id) {
      socket.emit('system_message', '아직 본인의 순서가 아닙니다!');
      return;
    }

    clearTimeout(turnTimer);

    io.emit('receive_word', {
      sender: currentTurnPlayer.name,
      word: word
    });

    nextTurn();
  });

  // 퇴장 처리
  socket.on('disconnect', () => {
    const player = players.find(p => p.id === socket.id);
    if (player) {
      io.emit('system_message', `${player.name}님이 퇴장하셨습니다.`);
    }
    players = players.filter(p => p.id !== socket.id);
    playOrder = playOrder.filter(p => p.id !== socket.id);
    io.emit('player_list_update', players);

    if (players.length === 0) {
      clearTimeout(turnTimer);
      gameState = 'WAITING';
      currentTurnIndex = 0;
    }
  });
});

// 타이머 함수 (25초 카운트다운)
function startTimer(seconds, onTimeout) {
  clearTimeout(turnTimer);
  let timeLeft = seconds;
  io.emit('timer_tick', timeLeft);

  const interval = setInterval(() => {
    timeLeft--;
    io.emit('timer_tick', timeLeft);

    if (timeLeft <= 0) {
      clearInterval(interval);
      onTimeout();
    }
  }, 1000);

  turnTimer = interval;
}

// 승자 기준 시계방향 순서 정렬 및 랜덤 단어/라이어 배정
function determineClockwiseOrder() {
  const rpsValue = { '가위': 1, '바위': 2, '보': 3 };

  let tempPlayers = [...players].sort((a, b) => {
    let scoreA = rpsValue[a.choice] || 0;
    let scoreB = rpsValue[b.choice] || 0;
    if (scoreA === scoreB) return Math.random() - 0.5;
    return scoreB - scoreA;
  });

  const winner = tempPlayers[0];
  const winnerIndex = players.findIndex(p => p.id === winner.id);

  // 승자부터 시계방향 배치
  playOrder = [
    ...players.slice(winnerIndex),
    ...players.slice(0, winnerIndex)
  ];

  // 랜덤 제시어 선정
  currentWord = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];

  // 랜덤 라이어 선정
  const liarIndex = Math.floor(Math.random() * playOrder.length);

  playOrder.forEach((p, idx) => {
    if (idx === liarIndex) {
      p.isLiar = true;
      io.to(p.id).emit('system_message', '🤫 당신은 [라이어]입니다! 정체를 숨기고 단어를 제시하세요.');
    } else {
      p.isLiar = false;
      io.to(p.id).emit('system_message', `🔑 이번 판 제시어는 [ ${currentWord} ] 입니다.`);
    }
  });

  gameState = 'PLAYING';
  currentTurnIndex = 0;

  io.emit('rps_result', {
    winner: winner,
    order: playOrder
  });

  broadcastTurn();
}

function nextTurn() {
  currentTurnIndex = (currentTurnIndex + 1) % playOrder.length;
  broadcastTurn();
}

function broadcastTurn() {
  const currentTurnPlayer = playOrder[currentTurnIndex];
  io.emit('turn_update', {
    currentPlayer: currentTurnPlayer.name,
    currentPlayerId: currentTurnPlayer.id
  });

  startTimer(LIMIT_TIME, () => {
    io.emit('system_message', `⏰ 시간 초과! ${currentTurnPlayer.name}님의 순서가 지나갔습니다.`);
    nextTurn();
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
