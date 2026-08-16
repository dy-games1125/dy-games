const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = [];
let playOrder = [];
let gameState = 'WAITING';
let currentTurnIndex = 0;
let turnTimer = null;
const LIMIT_TIME = 25; // 25초 제한시간

io.on('connection', (socket) => {

  // 1. 유저 입장
  socket.on('join_game', (nickname) => {
    const name = nickname.trim() || `플레이어_${socket.id.substring(0, 4)}`;
    players.push({
      id: socket.id,
      name: name,
      choice: null
    });

    io.emit('player_list_update', players);
    io.emit('system_message', `${name}님이 입장하셨습니다.`);
  });

  // 2. 가위바위보 시작
  socket.on('start_rps', () => {
    if (players.length < 2) {
      socket.emit('system_message', '최소 2명 이상이 모여야 시작할 수 있습니다.');
      return;
    }
    gameState = 'RPS';
    players.forEach(p => p.choice = null);
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

  // 3. 가위바위보 선택 수신
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

  // 4. 단어 입력 수신
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

  // 5. 퇴장 처리
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

// 승자 기준 시계방향 순서 정렬
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

  // 승자부터 입장 순서대로 시계방향 배치
  playOrder = [
    ...players.slice(winnerIndex),
    ...players.slice(0, winnerIndex)
  ];

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

  // 단어 입력 제한시간 25초 시작
  startTimer(LIMIT_TIME, () => {
    io.emit('system_message', `⏰ 시간 초과! ${currentTurnPlayer.name}님의 순서가 지나갔습니다.`);
    nextTurn();
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
