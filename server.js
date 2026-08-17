const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

// 초성 퀴즈용 데이터 모음
const CHOSEONG_DATA = [
  { choseong: 'ㄱㅇ', word: '고양이' },
  { choseong: 'ㄱㅇ', word: '강아지' },
  { choseong: 'ㄴㅂ', word: '나비' },
  { choseong: 'ㅂㄷ', word: '바다' },
  { choseong: 'ㅅㄱ', word: '사과' },
  { choseong: 'ㅎㄴ', word: '하늘' },
  { choseong: 'ㅋㅍ', word: '커피' },
  { choseong: 'ㅋㅍ', word: '키보드' }
];

io.on('connection', (socket) => {
  // 방 참여
  socket.on('join_room', ({ roomId, username }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        host: socket.id,
        gameMode: 'liar', // liar, mafia, shiritori, choseong
        gameStarted: false,
        // 라이어 설정
        keyword: '',
        liarId: null,
        // 마피아 설정
        mafiaDayTime: 60,
        mafiaCount: 1,
        policeCount: 1,
        doctorCount: 1,
        roles: {},
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

  // 게임 설정 변경 (방장 전용)
  socket.on('update_settings', ({ roomId, settings }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    if (settings.gameMode) room.gameMode = settings.gameMode;
    if (settings.shiritoriTime) room.shiritoriTime = Number(settings.shiritoriTime);
    if (settings.shiritoriLen) room.shiritoriLen = Number(settings.shiritoriLen);
    if (settings.targetScore) room.targetScore = Number(settings.targetScore);
    if (settings.mafiaDayTime) room.mafiaDayTime = Number(settings.mafiaDayTime);

    // 마피아 인원수 설정 검증
    if (settings.mafiaCount !== undefined) {
      const totalPlayers = room.players.length;
      const mCount = Number(settings.mafiaCount);
      const pCount = Number(settings.policeCount);
      const dCount = Number(settings.doctorCount);

      const minMafia = Math.floor(totalPlayers / 6) || 1;
      const maxPolice = Math.floor(totalPlayers / 3) || 1;
      const maxDoctor = Math.floor(totalPlayers / 3) || 1;

      // 1. 0명 제외 (최소 1명 이상)
      if (mCount < 1 || pCount < 1 || dCount < 1) {
        return socket.emit('system_message', '⚠️ 모든 직책(마피아, 경찰, 의사)은 최소 1명 이상이어야 합니다.');
      }

      // 2. 최대/최소 범위 검증
      if (mCount < minMafia) {
        return socket.emit('system_message', `⚠️ 마피아는 최소 ${minMafia}명 이상이어야 합니다.`);
      }
      if (pCount > maxPolice) {
        return socket.emit('system_message', `⚠️ 경찰은 최대 ${maxPolice}명까지 설정 가능합니다.`);
      }
      if (dCount > maxDoctor) {
        return socket.emit('system_message', `⚠️ 의사는 최대 ${maxDoctor}명까지 설정 가능합니다.`);
      }

      // 3. 특수 직책 총합이 전체 인원수를 넘지 않는지 검증
      if (mCount + pCount + dCount >= totalPlayers) {
        return socket.emit('system_message', '⚠️ 특수 직책의 총합은 전체 플레이어 수보다 적어야 합니다 (시민 최소 1명 필요).');
      }

      room.mafiaCount = mCount;
      room.policeCount = pCount;
      room.doctorCount = dCount;
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

    room.gameStarted = true;

    // 모드 1: 끝말잇기
    if (room.gameMode === 'shiritori') {
      room.turnIndex = 0;
      room.currentWord = '사과'; // 시작 단어
      io.to(roomId).emit('game_started', {
        mode: 'shiritori',
        currentWord: room.currentWord,
        currentTurn: room.players[room.turnIndex].username
      });
      startShiritoriTimer(roomId);
    } 
    // 모드 2: 초성 퀴즈
    else if (room.gameMode === 'choseong') {
      nextChoseongQuestion(roomId);
    } 
    // 모드 3: 마피아
    else if (room.gameMode === 'mafia') {
      if (room.players.length < 6) {
        room.gameStarted = false;
        return socket.emit('system_message', '⚠️ 마피아 게임은 최소 6명 이상 필요합니다.');
      }
      io.to(roomId).emit('game_started', { mode: 'mafia' });
    }
    // 모드 4: 라이어
    else {
      io.to(roomId).emit('game_started', { mode: 'liar' });
    }
  });

  // 메시지 및 정답 입력 처리
  socket.on('send_message', ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;

    const sender = room.players.find(p => p.id === socket.id);
    const username = sender ? sender.username : '익명';

    // 1. 끝말잇기 게임 처리
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
          socket.emit('system_message', `⚠️ 규칙에 맞는 ${room.shiritoriLen}자 단어를 입력하세요!`);
        }
      }
    }

    // 2. 초성 퀴즈 정답 처리
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

    // 일반 채팅 메시지 전송
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

// 끝말잇기 타이머
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

// 다음 초성 퀴즈 출제
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
