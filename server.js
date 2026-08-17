const http = require('http');
const express = require('express');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

// 초성 퀴즈 단어 목록 (말이 되는 단어로 구성)
const choseongList = [
  // 1글자
  { choseong: 'ㅂ', answer: '불', length: 1 }, { choseong: 'ㅁ', answer: '물', length: 1 },
  { choseong: 'ㅋ', answer: '키', length: 1 }, { choseong: 'ㅎ', answer: '해', length: 1 },
  { choseong: 'ㄷ', answer: '달', length: 1 }, { choseong: 'ㅂ', answer: '봄', length: 1 },
  { choseong: 'ㅈ', answer: '집', length: 1 }, { choseong: 'ㅃ', answer: '빵', length: 1 },
  // 2글자
  { choseong: 'ㅎㄱ', answer: '학교', length: 2 }, { choseong: 'ㄱㅇ', answer: '게임', length: 2 },
  { choseong: 'ㅁㅎ', answer: '만화', length: 2 }, { choseong: 'ㅊㅅ', answer: '천사', length: 2 },
  { choseong: 'ㅅㄱ', answer: '사과', length: 2 }, { choseong: 'ㅊㄱ', answer: '친구', length: 2 },
  { choseong: 'ㄴㅁ', answer: '나무', length: 2 }, { choseong: 'ㅂㄷ', answer: '바다', length: 2 },
  { choseong: 'ㅎㄴ', answer: '하늘', length: 2 }, { choseong: 'ㅈㄷ', answer: '지도', length: 2 },
  { choseong: 'ㅅㅂ', answer: '신발', length: 2 }, { choseong: 'ㅁㅈ', answer: '모자', length: 2 },
  { choseong: 'ㅇㄱ', answer: '안경', length: 2 }, { choseong: 'ㄱㅊ', answer: '김치', length: 2 },
  // 3글자
  { choseong: 'ㅂㄴㄴ', answer: '바나나', length: 3 }, { choseong: 'ㅋㅁㅍㅌ', answer: '컴퓨터', length: 3 },
  { choseong: 'ㅅㅎㅈ', answer: '신발장', length: 3 }, { choseong: 'ㄷㄹㅁ', answer: '드라마', length: 3 },
  { choseong: 'ㄱㄹㄹ', answer: '고릴라', length: 3 }, { choseong: 'ㄴㅈㄱ', answer: '냉장고', length: 3 },
  { choseong: 'ㅅㅌㄱ', answer: '세탁기', length: 3 }, { choseong: 'ㅇㅎㄱ', answer: '영화관', length: 3 },
  { choseong: 'ㅈㄷㄱ', answer: '자전거', length: 3 }, { choseong: 'ㅋㅁㄹ', answer: '카메라', length: 3 },
  { choseong: 'ㅍㅇㄴ', answer: '피아노', length: 3 }, { choseong: 'ㅎㅂㄱ', answer: '햄버거', length: 3 },
  // 4글자
  { choseong: 'ㄷㅎㅁㄱ', answer: '대한민국', length: 4 }, { choseong: 'ㄷㅍㄴㅁ', answer: '단풍나무', length: 4 },
  { choseong: 'ㅂㄹㅅㄹ', answer: '바람소리', length: 4 }, { choseong: 'ㅋㅍㅊㄴ', answer: '카푸치노', length: 4 },
  { choseong: 'ㅌㄹㅂㅈ', answer: '텔레비전', length: 4 }, { choseong: 'ㅍㄹㅇㄷ', answer: '프라이드', length: 4 },
  { choseong: 'ㅁㅋㄹㄴ', answer: '마카로니', length: 4 }, { choseong: 'ㅇㅇㅍㄷ', answer: '아이패드', length: 4 },
  { choseong: 'ㅌㅇㅁㅅ', answer: '타임머신', length: 4 }, { choseong: 'ㅇㄹㄱㅇ', answer: '놀이공원', length: 4 },
  // 5글자
  { choseong: 'ㅇㄹㄷㄱㅇ', answer: '울산대공원', length: 5 }, { choseong: 'ㅅㅍㅇㄷㅁ', answer: '스파이더맨', length: 5 },
  { choseong: 'ㅋㄹㅅㅁㅅ', answer: '크리스마스', length: 5 }, { choseong: 'ㅈㅈㄹㅇㅈ', answer: '전자레인지', length: 5 }
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
      gameMode: 'mafia',
      options: {
        maxPlayers: 18,
        mafiaCount: 1,
        doctorCount: 1,
        policeCount: 1,
        mafiaDayTime: 60,
        choseongTargetScore: 20
      },
      players: [{ id: socket.id, username, isDead: false, score: 0, role: '' }],
      mafiaData: { phase: 'night', nightActions: { mafia: null, doctor: null, police: null } },
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

    if (room.players.length >= 18) {
      return socket.emit('system_message', '방이 꽉 찼습니다! (최대 18명)');
    }

    currentRoomId = roomId;
    currentUsername = username;
    room.players.push({ id: socket.id, username, isDead: false, score: 0, role: '' });

    socket.join(roomId);
    socket.emit('join_success', { roomId });
    io.to(roomId).emit('update_room', room);
    io.to(roomId).emit('system_message', `${username}님이 입장했습니다.`);
  });

  socket.on('change_game_mode', ({ roomId, gameMode }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;
    room.gameMode = gameMode;
    io.to(roomId).emit('update_room', room);
  });

  socket.on('update_options', ({ roomId, options }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;
    room.options = { ...room.options, ...options };
    io.to(roomId).emit('update_room', room);
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    const count = room.players.length;

    if (room.gameMode === 'mafia') {
      if (count < 6 || count > 18) {
        return socket.emit('system_message', '❌ 마피아 게임은 인원이 6명~18명일 때만 시작할 수 있습니다.');
      }

      const mCount = parseInt(room.options.mafiaCount) || 1;
      const dCount = parseInt(room.options.doctorCount) || 1;
      const pCount = parseInt(room.options.policeCount) || 1;

      // 비율 제약 조건 검증: 마피아 <= 1/6, 의사/경찰 <= 1/3
      const maxMafia = Math.floor(count / 6);
      const maxDoctor = Math.floor(count / 3);
      const maxPolice = Math.floor(count / 3);

      if (mCount > maxMafia) {
        return socket.emit('system_message', `❌ 마피아는 전체 인원(${count}명)의 1/6 이하인 최대 ${maxMafia}명까지만 설정 가능합니다.`);
      }
      if (dCount > maxDoctor) {
        return socket.emit('system_message', `❌ 의사는 전체 인원(${count}명)의 1/3 이하인 최대 ${maxDoctor}명까지만 설정 가능합니다.`);
      }
      if (pCount > maxPolice) {
        return socket.emit('system_message', `❌ 경찰은 전체 인원(${count}명)의 1/3 이하인 최대 ${maxPolice}명까지만 설정 가능합니다.`);
      }

      let roles = [];
      for (let i = 0; i < mCount; i++) roles.push('mafia');
      for (let i = 0; i < dCount; i++) roles.push('doctor');
      for (let i = 0; i < pCount; i++) roles.push('police');
      while (roles.length < count) roles.push('citizen');

      roles.sort(() => Math.random() - 0.5);

      room.players.forEach((p, idx) => {
        p.isDead = false;
        p.role = roles[idx];
        io.to(p.id).emit('assign_role', { role: p.role });
      });

      room.gameStarted = true;
      room.mafiaData = { phase: 'night', nightActions: { mafia: null, doctor: null, police: null } };
      
      io.to(roomId).emit('start_game_ui', { gameMode: 'mafia' });
      io.to(roomId).emit('update_room', room);
      io.to(roomId).emit('system_message', '🌙 밤이 되었습니다. 특수 직업은 능력을 사용해 주세요.');
    } else if (room.gameMode === 'choseong') {
      room.gameStarted = true;
      const prob = choseongList[Math.floor(Math.random() * choseongList.length)];
      room.choseongData.currentProblem = prob;
      io.to(roomId).emit('start_game_ui', { gameMode: 'choseong' });
      io.to(roomId).emit('choseong_new_problem', { choseong: prob.choseong });
      io.to(roomId).emit('update_room', room);
    }
  });

  socket.on('mafia_night_action', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || room.gameMode !== 'mafia') return;

    const me = room.players.find(p => p.id === socket.id);
    if (!me || me.isDead) return;

    if ((me.role === 'mafia' || me.role === 'police') && targetId === me.id) {
      return socket.emit('system_message', '❌ 자기 자신을 지정할 수 없습니다.');
    }

    if (me.role === 'mafia') room.mafiaData.nightActions.mafia = targetId;
    if (me.role === 'doctor') room.mafiaData.nightActions.doctor = targetId;
    if (me.role === 'police') {
      const targetPlayer = room.players.find(p => p.id === targetId);
      const isMafia = targetPlayer && targetPlayer.role === 'mafia';
      socket.emit('system_message', isMafia ? '🔍 지목한 대상은 [마피아]입니다!' : '🔍 지목한 대상은 마피아가 아닙니다.');
      room.mafiaData.nightActions.police = targetId;
    }

    const actions = room.mafiaData.nightActions;
    if (actions.mafia !== null && actions.doctor !== null) {
      io.to(roomId).emit('system_message', '☀️ 아침이 밝았습니다.');
      if (actions.mafia === actions.doctor) {
        const savedPlayer = room.players.find(p => p.id === actions.doctor);
        io.to(roomId).emit('system_message', `🏥 의사가 ${savedPlayer ? savedPlayer.username : ''}님을 살려냈습니다.`);
      } else {
        const killed = room.players.find(p => p.id === actions.mafia);
        if (killed) {
          killed.isDead = true;
          io.to(roomId).emit('system_message', `💀 ${killed.username}님이 마피아에 의해 사망했습니다.`);
          
          // 관전 전용 직업 정보 출력
          const deadPlayers = room.players.filter(p => p.isDead);
          const roleInfo = room.players.map(p => `${p.username}: ${p.role}`).join(', ');
          deadPlayers.forEach(dp => {
            io.to(dp.id).emit('system_message', `👻 [관전 정보] 전체 직업: ${roleInfo}`);
          });
        }
      }
      room.mafiaData.nightActions = { mafia: null, doctor: null, police: null };
      io.to(roomId).emit('update_room', room);
    }
  });

  socket.on('submit_choseong_answer', ({ roomId, answer }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || room.gameMode !== 'choseong') return;

    const prob = room.choseongData.currentProblem;
    if (prob && answer === prob.answer) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.score += prob.length;
        io.to(roomId).emit('system_message', `🎉 ${player.username}님이 정답 [${prob.answer}]를 맞춰 ${prob.length}점을 획득했습니다!`);
        
        if (player.score >= room.options.choseongTargetScore) {
          room.gameStarted = false;
          const sortedRank = [...room.players].sort((a, b) => a.score - b.score);
          io.to(roomId).emit('show_final_ranking', sortedRank);
          io.to(roomId).emit('update_room', room);
        } else {
          const nextProb = choseongList[Math.floor(Math.random() * choseongList.length)];
          room.choseongData.currentProblem = nextProb;
          io.to(roomId).emit('choseong_new_problem', { choseong: nextProb.choseong });
          io.to(roomId).emit('update_room', room);
        }
      }
    } else {
      socket.emit('system_message', '❌ 오답입니다!');
    }
  });

  socket.on('end_game_by_host', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;
    room.gameStarted = false;
    const sortedRank = [...room.players].sort((a, b) => a.score - b.score);
    io.to(roomId).emit('show_final_ranking', sortedRank);
    io.to(roomId).emit('update_room', room);
  });

  socket.on('send_message', ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    const isDead = player ? player.isDead : false;

    if (isDead) {
      const deadSockets = room.players.filter(p => p.isDead).map(p => p.id);
      deadSockets.forEach(sId => {
        io.to(sId).emit('receive_message', { username: `💀(관전) ${currentUsername}`, message });
      });
    } else {
      io.to(roomId).emit('receive_message', { username: currentUsername, message });
    }
  });

  socket.on('disconnect', () => {
    if (currentRoomId && rooms[currentRoomId]) {
      const room = rooms[currentRoomId];
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[currentRoomId];
      } else {
        if (room.host === socket.id) room.host = room.players[0].id;
        io.to(currentRoomId).emit('update_room', room);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
