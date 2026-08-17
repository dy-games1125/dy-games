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

// 라이어 게임 단어 100개 (카테고리당 25개)
const liarWords = {
  음식: ['피자', '치킨', '햄버거', '떡볶이', '초밥', '짜장면', '삼겹살', '라면', '김밥', '냉면', '족발', '보쌈', '파스타', '스테이크', '카레', '탕수육', '짬뽕', '볶음밥', '순대', '국밥', '만두', '우동', '돈가스', '샌드위치', '타코'],
  동물: ['사자', '코끼리', '원숭이', '기린', '펭귄', '호랑이', '돌고래', '토끼', '악어', '하마', '얼룩말', '캥거루', '다람쥐', '여우', '늑대', '곰', '판다', '치타', '수달', '너구리', '햄스터', '고슴도치', '부엉이', '독수리', '타조'],
  장소: ['학교', '병원', '영화관', '놀이공원', '공항', '도서관', '해수욕장', '경찰서', '소방서', '우체국', '마트', '백화점', '편의점', '식당', '카페', '미용실', '약국', '박물관', '미술관', '놀이터', '동물원', '식물원', '수영장', '헬스장', 'PC방'],
  물건: ['컴퓨터', '스마트폰', '냉장고', '선풍기', '자동차', '시계', '안경', '이어폰', '텔레비전', '에어컨', '세탁기', '청소기', '전자레인지', '다리미', '드라이기', '가위', '풀', '지우개', '연필', '노트북', '마우스', '키보드', '스피커', '텀블러', '우산']
};

// 초성 퀴즈 단어 100개
const choseongList = [
  // 1글자 (1점)
  { choseong: 'ㅂ', answer: '불', length: 1 },
  { choseong: 'ㅁ', answer: '물', length: 1 },
  { choseong: 'ㅋ', answer: '키', length: 1 },
  { choseong: 'ㅎ', answer: '해', length: 1 },
  { choseong: 'ㄷ', answer: '달', length: 1 },
  { choseong: 'ㅂ', answer: '봄', length: 1 },
  { choseong: 'ㅈ', answer: '집', length: 1 },
  { choseong: 'ㅃ', answer: '빵', length: 1 },
  { choseong: 'ㅇ', answer: '옷', length: 1 },
  { choseong: 'ㅋ', answer: '컵', length: 1 },

  // 2글자 (2점)
  { choseong: 'ㅎㄱ', answer: '학교', length: 2 },
  { choseong: 'ㄱㅇ', answer: '게임', length: 2 },
  { choseong: 'ㅁㅎ', answer: '만화', length: 2 },
  { choseong: 'ㅊㅅ', answer: '천사', length: 2 },
  { choseong: 'ㅅㄱ', answer: '사과', length: 2 }, // 3글자로 이동
  { choseong: 'ㅊㄱ', answer: '친구', length: 2 },
  { choseong: 'ㄴㅁ', answer: '나무', length: 2 },
  { choseong: 'ㅂㄷ', answer: '바다', length: 2 },
  { choseong: 'ㅎㄴ', answer: '하늘', length: 2 },
  { choseong: 'ㅈㄷ', answer: '지도', length: 2 },
  { choseong: 'ㅅㅂ', answer: '신발', length: 2 },
  { choseong: 'ㅁㅈ', answer: '모자', length: 2 },
  { choseong: 'ㅇㄱ', answer: '안경', length: 2 },
  { choseong: 'ㄱㅊ', answer: '김치', length: 2 },
  { choseong: 'ㅁㅇ', answer: '마음', length: 2 },
  { choseong: 'ㅂㅋ', answer: '바퀴', length: 2 },
  { choseong: 'ㅅㅈ', answer: '사자', length: 2 },
  { choseong: 'ㅇㄱ', answer: '아기', length: 2 },
  { choseong: 'ㅈㅂ', answer: '지갑', length: 2 },
  { choseong: 'ㅊㅇ', answer: '추억', length: 2 },
  { choseong: 'ㅋㅍ', answer: '커피', length: 2 },
  { choseong: 'ㅌㄲ', answer: '토끼', length: 2 },
  { choseong: 'ㅍㄷ', answer: '포도', length: 2 },
  { choseong: 'ㅎㅂ', answer: '한강', length: 2 },
  { choseong: 'ㄱㄱ', answer: '고기', length: 2 },
  { choseong: 'ㄴㄴ', answer: '누나', length: 2 },
  { choseong: 'ㄷㄹ', answer: '다리', length: 2 },
  { choseong: 'ㄹㅁ', answer: '라면', length: 2 },
  { choseong: 'ㅅㅌ', answer: '사탕', length: 2 },
  { choseong: 'ㅇㅇ', answer: '음악', length: 2 },

  // 3글자 (3점)
  { choseong: 'ㅋㅍㅌ', answer: '컴퓨터', length: 3 },
  { choseong: 'ㅅㅂㅈ', answer: '신발장', length: 3 },
  { choseong: 'ㄷㄹㅁ', answer: '드라마', length: 3 },
  { choseong: 'ㄱㄹㄹ', answer: '고릴라', length: 3 },
  { choseong: 'ㄴㅈㄱ', answer: '냉장고', length: 3 },
  { choseong: 'ㅅㅌㄱ', answer: '세탁기', length: 3 },
  { choseong: 'ㅇㅎㄱ', answer: '영화관', length: 3 },
  { choseong: 'ㅈㅈㄱ', answer: '자전거', length: 3 },
  { choseong: 'ㅋㅁㄹ', answer: '카메라', length: 3 },
  { choseong: 'ㅍㅇㄴ', answer: '피아노', length: 3 },
  { choseong: 'ㅎㅂㄱ', answer: '햄버거', length: 3 },
  { choseong: 'ㄷㅌㄹ', answer: '도토리', length: 3 },
  { choseong: 'ㅁㅎㄱ', answer: '무화과', length: 3 },
  { choseong: 'ㅇㅇㅍ', answer: '이어폰', length: 3 },
  { choseong: 'ㅈㅇㅋ', answer: '종이컵', length: 3 },
  { choseong: 'ㅊㅋㄹ', answer: '초콜릿', length: 3 },
  { choseong: 'ㅌㄴㅅ', answer: '테니스', length: 3 },
  { choseong: 'ㅍㄹㅅ', answer: '파란색', length: 3 },
  { choseong: 'ㅎㄷㄱ', answer: '핫도그', length: 3 },
  { choseong: 'ㅅㅂㅅ', answer: '소방서', length: 3 },
  { choseong: 'ㅁㅋㄹ', answer: '마카롱', length: 3 },
  { choseong: 'ㅅㅍㄱ', answer: '선풍기', length: 3 },
  { choseong: 'ㅈㄷㅊ', answer: '자동차', length: 3 },
  { choseong: 'ㅃㄱㅅ', answer: '빨간색', length: 3 },
  { choseong: 'ㄱㅊㅅ', answer: '경찰서', length: 3 },
  { choseong: 'ㄸㅂㄱ', answer: '떡볶이', length: 3 },
  { choseong: 'ㅅㄱㅅ', answer: '삼겹살', length: 3 },

  // 4글자 (4점)
  { choseong: 'ㄷㅎㅁㄱ', answer: '대한민국', length: 4 },
  { choseong: 'ㄷㅍㄴㅁ', answer: '단풍나무', length: 4 },
  { choseong: 'ㅂㄹㅅㄹ', answer: '바람소리', length: 4 },
  { choseong: 'ㅋㅍㅊㄴ', answer: '카푸치노', length: 4 },
  { choseong: 'ㅌㄹㅂㅈ', answer: '텔레비전', length: 4 },
  { choseong: 'ㅍㄹㅇㄷ', answer: '프라이드', length: 4 },
  { choseong: 'ㅁㅋㄹㄴ', answer: '마카로니', length: 4 },
  { choseong: 'ㅇㅇㅍㄷ', answer: '아이패드', length: 4 },
  { choseong: 'ㅌㅇㅁㅅ', answer: '타임머신', length: 4 },
  { choseong: 'ㄷㅈㅉㄱ', answer: '된장찌개', length: 4 },
  { choseong: 'ㄱㅊㅉㄱ', answer: '김치찌개', length: 4 },
  { choseong: 'ㅇㄹㄱㅇ', answer: '놀이공원', length: 4 },
  { choseong: 'ㅎㅅㅇㅈ', answer: '해수욕장', length: 4 },

  // 5글자 (5점)
  { choseong: 'ㅇㄹㄷㄱㅇ', answer: '울산대공원', length: 5 },
  { choseong: 'ㅈㅈㄹㅇㅈ', answer: '전자레인지', length: 5 },
  { choseong: 'ㅅㅍㅇㄷㅁ', answer: '스파이더맨', length: 5 },
  { choseong: 'ㅇㅇㅅㅋㄹ', answer: '아이스크림', length: 5 },
  { choseong: 'ㅋㄹㅅㅁㅅ', answer: '크리스마스', length: 5 },
  { choseong: 'ㅈㅈㄹㅇㅈ', answer: '전자레인지', length: 5 },
  { choseong: 'ㅇㅈㅇㅂㄱ', answer: '오징어볶음', length: 5 },
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
        liarTime: 25,
        liarCategory: 'all',
        mafiaDayTime: 60,
        shiritoriMinLen: 2,
        shiritoriTime: 15,
        choseongTargetScore: 20
      },
      players: [{ id: socket.id, username, isDead: false, score: 0, role: '' }],
      mafiaData: { phase: 'night', votes: {}, nightActions: { mafia: null, doctor: null, police: null } },
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

    const maxLimit = room.options.maxPlayers || 18;
    if (room.players.length >= maxLimit) {
      return socket.emit('system_message', `방이 꽉 찼습니다! (최대 ${maxLimit}명)`);
    }

    currentRoomId = roomId;
    currentUsername = username;
    room.players.push({ id: socket.id, username, isDead: false, score: 0, role: '' });

    socket.join(roomId);
    socket.emit('join_success', { roomId });
    io.to(roomId).emit('update_room', room);
    io.to(roomId).emit('system_message', `${username}님이 입장했습니다.`);
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    const count = room.players.length;

    if (room.gameMode === 'mafia') {
      if (count < 6 || count > 18) {
        return socket.emit('system_message', '[오류] 마피아 게임은 6명~18명 사이에서만 시작 가능합니다.');
      }

      // 역할 배정 (마피아: 1/6 이하, 경찰/의사: 각각 1/3 이하)
      const mafiaCount = Math.max(1, Math.floor(count / 6));
      const doctorCount = Math.max(1, Math.floor(count / 3));
      const policeCount = Math.max(1, Math.floor(count / 3));

      let roles = [];
      for (let i = 0; i < mafiaCount; i++) roles.push('mafia');
      for (let i = 0; i < doctorCount; i++) roles.push('doctor');
      for (let i = 0; i < policeCount; i++) roles.push('police');
      while (roles.length < count) roles.push('citizen');

      roles.sort(() => Math.random() - 0.5);

      room.players.forEach((p, idx) => {
        p.isDead = false;
        p.role = roles[idx];
        io.to(p.id).emit('assign_role', { role: p.role });
      });

      room.gameStarted = true;
      room.mafiaData = { phase: 'night', votes: {}, nightActions: { mafia: null, doctor: null, police: null } };
      io.to(roomId).emit('update_room', room);
      io.to(roomId).emit('system_message', '🌙 밤이 되었습니다. 마피아, 의사, 경찰은 능력을 사용해 주세요.');
    } else if (room.gameMode === 'choseong') {
      if (count < 2 || count > 8) {
        return socket.emit('system_message', '[오류] 초성 퀴즈는 2명~8명 사이에서만 시작 가능합니다.');
      }
      room.gameStarted = true;
      const prob = choseongList[Math.floor(Math.random() * choseongList.length)];
      room.choseongData.currentProblem = prob;
      io.to(roomId).emit('choseong_new_problem', { choseong: prob.choseong });
      io.to(roomId).emit('update_room', room);
    }
  });

  // 마피아 밤 능력 사용 처리
  socket.on('mafia_night_action', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || room.gameMode !== 'mafia' || room.mafiaData.phase !== 'night') return;

    const me = room.players.find(p => p.id === socket.id);
    if (!me || me.isDead) return;

    // 자신에게 사용 금지 검증 (의사 제외)
    if ((me.role === 'mafia' || me.role === 'police') && targetId === me.id) {
      return socket.emit('system_message', '❌ 자기 자신에게는 능력을 사용할 수 없습니다.');
    }

    if (me.role === 'mafia') room.mafiaData.nightActions.mafia = targetId;
    if (me.role === 'doctor') room.mafiaData.nightActions.doctor = targetId;
    if (me.role === 'police') {
      room.mafiaData.nightActions.police = targetId;
      const targetPlayer = room.players.find(p => p.id === targetId);
      if (targetPlayer && targetPlayer.role === 'mafia') {
        socket.emit('system_message', '🔍 경찰은 조사에 성공했습니다.');
      } else {
        socket.emit('system_message', '🔍 경찰은 조사에 실패했습니다.');
      }
    }

    // 밤 결과 처리
    const actions = room.mafiaData.nightActions;
    if (actions.mafia !== null && actions.doctor !== null) {
      io.to(roomId).emit('system_message', '☀️ 아침이 밝았습니다.');
      if (actions.mafia === actions.doctor) {
        const savedPlayer = room.players.find(p => p.id === actions.doctor);
        io.to(roomId).emit('system_message', `🏥 의사가 ${savedPlayer ? savedPlayer.username : ''}님을 살렸습니다!`);
      } else {
        const killed = room.players.find(p => p.id === actions.mafia);
        if (killed) {
          killed.isDead = true;
          io.to(roomId).emit('system_message', `💀 지난밤 ${killed.username}님이 마피아에게 지목되어 사망하셨습니다.`);
          notifyDeadRoles(room);
        }
      }
      room.mafiaData.phase = 'day';
      room.mafiaData.nightActions = { mafia: null, doctor: null, police: null };
      io.to(roomId).emit('update_room', room);
      checkMafiaWinCondition(roomId);
    }
  });

  // 죽은 사용자들에게 직업 정보 공개
  function notifyDeadRoles(room) {
    const deadPlayers = room.players.filter(p => p.isDead);
    const roleInfo = room.players.map(p => `${p.username}: ${p.role.toUpperCase()}`).join(', ');
    deadPlayers.forEach(dp => {
      io.to(dp.id).emit('system_message', `👻 [관전 정보] 전체 직업 현황: ${roleInfo}`);
    });
  }

  function checkMafiaWinCondition(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const aliveMafia = room.players.filter(p => !p.isDead && p.role === 'mafia').length;
    const aliveCitizens = room.players.filter(p => !p.isDead && p.role !== 'mafia').length;

    if (aliveMafia === 0) {
      finishMafiaGame(room, '시민 승리!');
    } else if (aliveMafia >= aliveCitizens) {
      finishMafiaGame(room, '마피아 승리!');
    }
  }

  function finishMafiaGame(room, resultMsg) {
    room.gameStarted = false;
    // 승자 점수 지급 및 점수 기반 등수 결과 알림
    room.players.forEach(p => {
      if ((resultMsg.includes('시민') && p.role !== 'mafia') || (resultMsg.includes('마피아') && p.role === 'mafia')) {
        p.score += 1;
      }
    });

    const sortedRank = [...room.players].sort((a, b) => a.score - b.score);
    io.to(room.roomId).emit('show_final_ranking', sortedRank);
    io.to(room.roomId).emit('update_room', room);
    io.to(room.roomId).emit('system_message', `🏆 게임 종료: ${resultMsg}`);
  }

  socket.on('send_message', ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    const isDead = player ? player.isDead : false;

    if (isDead) {
      const deadSockets = room.players.filter(p => p.isDead).map(p => p.id);
      deadSockets.forEach(sId => {
        io.to(sId).emit('receive_message', {
          username: `💀(관전) ${currentUsername}`,
          message,
          isDead: true
        });
      });
    } else {
      io.to(roomId).emit('receive_message', { username: currentUsername, message, isDead: false });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
