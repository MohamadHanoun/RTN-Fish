(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const socket = io({ reconnectionAttempts: 10 });
  const state = { room: null, name: localStorage.getItem('samaka-name') || '', screen: 'home', sound: localStorage.getItem('samaka-muted') !== 'yes', wasMyTurn: false, lastFeedSeq: -1 };
  let toastTimeout = null, feedbackTimeout = null, actx = null, previewTimer = null, previewSeq = 0;
  const arabicNumber = n => Number(n || 0).toLocaleString('ar-EG');
  function beep(kind = 'pass') {
    if (!state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = actx.createOscillator(); const gain = actx.createGain();
      osc.connect(gain); gain.connect(actx.destination);
      osc.type = kind === 'pop' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(kind === 'pop' ? 180 : kind === 'win' ? 520 : 560, actx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(kind === 'pop' ? 80 : 820, actx.currentTime + .16);
      gain.gain.setValueAtTime(.0001, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.045, actx.currentTime + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + .19);
      osc.start();osc.stop(actx.currentTime + .2);
    } catch (_e) { /* browser may block autoplay */ }
  }
  function toast(message) {
    const element = $('toast');
    element.textContent = message;
    element.classList.add('shown');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => element.classList.remove('shown'), 3700);
  }
  function feedback(message, type = '') {
    const element = $('answerFeedback');
    element.textContent = message;
    element.className = `answer-feedback ${type}`;
    clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => { element.textContent = ' '; element.className = 'answer-feedback'; }, 4600);
  }
  function node(tag, cls, content) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function switchScreen(screen) {
    if (state.screen !== screen) {
      state.screen = screen;
      document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === screen));
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
  function getName() {
    const name = $('username').value.trim().slice(0, 18);
    if (!name) { toast('اكتب اسمك أولًا'); $('username').focus(); return null; }
    localStorage.setItem('samaka-name', name);
    state.name = name;
    return name;
  }
  function request(event, data, cb) {
    if (!socket.connected) return toast('الاتصال مقطوع. جرّب من جديد بعد الاتصال');
    socket.timeout(6000).emit(event, data, (err, response) => {
      if (err) return toast('لم يصل رد من السيرفر، حاول مرة ثانية');
      if (!response?.ok) return toast(response?.error || 'حصل خطأ');
      if (cb) cb(response);
    });
  }
  function getHomeSettings() {
    return { maxPlayers: Number($('maxPlayers').value), hearts: Number($('heartsSetting').value),
      fuseMinSec: Number($('minTimeSetting').value), fuseMaxSec: Number($('maxTimeSetting').value),
      mode: $('modeSetting').value };
  }
  function getHostSettings() {
    return { maxPlayers: Number($('hostMaxPlayers').value), hearts: Number($('hostHearts').value),
      fuseMinSec: Number($('hostMinTime').value), fuseMaxSec: Number($('hostMaxTime').value),
      mode: $('hostMode').value };
  }
  function checkSettings(settings) {
    if (settings.fuseMinSec > settings.fuseMaxSec) { toast('أقل وقت ما لازم يكون أكبر من أطول وقت'); return false; }
    return true;
  }
  function saveHostSettings() {
    const settings = getHostSettings();
    if (!checkSettings(settings)) return;
    request('updateSettings', settings, () => toast('تم حفظ الإعدادات لكل اللاعبين'));
  }
  function createRoom() {
    const name = getName(); if (!name) return;
    const settings = getHomeSettings();
    if (!checkSettings(settings)) return;
    request('createRoom', { name, ...settings }, ({code}) => {
      history.replaceState(null, '', `/?room=${code}`);
      toast('تم إنشاء الغرفة! شارك رمز الدعوة مع أصحابك');
    });
  }
  function joinRoom() {
    const name = getName(); if (!name) return;
    const code = $('roomCodeInput').value.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) return toast('رمز الغرفة لازم يكون أربع أحرف إنجليزية');
    request('joinRoom', { code, name }, ({code}) => {
      history.replaceState(null, '', `/?room=${code}`);
      toast('دخلت الغرفة!');
    });
  }
  function leaveRoom() {
    request('leaveRoom', {}, () => {
      state.room = null; state.wasMyTurn = false;
      history.replaceState(null, '', '/');
      switchScreen('home');
    });
  }
  async function copyInvite() {
    if (!state.room) return;
    const link = `${location.origin}/?room=${state.room.code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('تم نسخ الرابط! ابعته لأصحابك');
    } catch (_e) {
      window.prompt('انسخ رابط الدعوة:', link);
    }
  }
  function updateLobby(room) {
    $('lobbyCode').textContent = room.code;
    $('lobbyCount').textContent = `${arabicNumber(room.players.length)} / ${arabicNumber(room.maxPlayers)}`;
    $('lobbyPlayerList').replaceChildren();
    room.players.forEach((p,i) => {
      const tile = node('div','player-tile');
      tile.append(node('span','avatar',p.name[0] || '؟'));
      const info = node('div');info.append(node('strong','',p.name));
      info.append(node('small','',p.id === room.hostId ? 'صاحب الغرفة' : `لاعب ${arabicNumber(i + 1)}`));
      tile.append(info);$('lobbyPlayerList').append(tile);
    });
    for(let i=room.players.length;i<room.maxPlayers;i++) {
      const tile = node('div','player-tile empty');tile.append(node('span','avatar','+'));
      const info=node('div');info.append(node('strong','',`مقعد ${arabicNumber(i+1)}`));info.append(node('small','','فارغ'));
      tile.append(info);$('lobbyPlayerList').append(tile);
    }
    const isHost = room.hostId === socket.id;
    $('hostSettingsPanel').hidden = !isHost;
    if (isHost) {
      const fields = { hostMaxPlayers:'maxPlayers', hostHearts:'hearts', hostMinTime:'fuseMinSec',
        hostMaxTime:'fuseMaxSec', hostMode:'mode' };
      for (const [id,key] of Object.entries(fields)) $(id).value = String(room.settings[key]);
    }
    const mode = room.settings.mode === 'gaming' ? 'Gaming فقط'
      : room.settings.mode === 'mostlyGaming' ? 'Gaming أغلب الوقت' : 'كل الأسئلة';
    $('lobbySettingsSummary').textContent = `الإعدادات: ${room.settings.hearts} قلوب · من ${room.settings.fuseMinSec} إلى ${room.settings.fuseMaxSec} ثانية · ${mode}`;
    $('startBtn').hidden = !isHost;
    $('startBtn').disabled = room.players.length < 2;
    $('waitingText').textContent = isHost
      ? (room.players.length < 2 ? 'لازم يدخل لاعب ثاني على الأقل' : 'كل اللاعبين جاهزين؟ ابدأ اللعبة!')
      : 'بانتظار صاحب الغرفة ليبدأ اللعبة…';
  }
  function updateGame(room) {
    const mine = room.currentPlayerId === socket.id;
    const holder = room.players.find(p => p.id === room.currentPlayerId);
    $('roundLabel').textContent = `الجولة ${arabicNumber(room.round)}`;
    $('gameHeadline').textContent = mine ? 'السمكة عندك!' : 'خليك جاهز!';
    $('gameQuestion').textContent = room.question || '---';
    $('holderChip').textContent = mine ? 'دورك الآن: جاوب ومرّر بسرعة' : `الدور عند ${holder?.name || 'لاعب آخر'}`;
    $('holderChip').classList.toggle('mine',mine);
    $('answerInput').disabled = !mine;
    $('answerBtn').disabled = !mine;
    $('timerCaption').textContent = mine ? 'أسرع! ما حدا بيعرف متى تنفجر' : 'المؤقت مخفي… لا تتأخر لما يجي دورك';
    $('gameCount').textContent = `${arabicNumber(room.players.filter(p => p.hearts > 0).length)} ناجين`;
    $('gamePlayerList').replaceChildren();
    room.players.forEach(p => {
      const el = node('div',`game-player ${p.id === room.currentPlayerId ? 'is-active' : ''} ${p.hearts <= 0 ? 'is-dead' : ''}`);
      el.append(node('span','avatar',p.name[0] || '؟'));
      const info=node('div','player-meta');
      const title=node('strong','',p.name);
      if(p.id===socket.id) title.append(node('span','you-chip',' (أنت)'));
      info.append(title);
      info.append(node('div','hearts',('♥ '.repeat(p.hearts)||'خرج من اللعبة').trim()));
      const stats=node('div','player-stats',`${arabicNumber(p.score)} نقطة · ${arabicNumber(p.correct)} إجابة`);
      info.append(stats);
      if (p.timeBonus) info.append(node('div','time-bank',`+${p.timeBonus} ثواني لما تبدأ جولة`));
      const bar=node('div','chargebar');const fill=node('span');fill.style.width=`${Math.max(0,Math.min(100,p.charge))}%`;bar.append(fill);info.append(bar);
      el.append(info); $('gamePlayerList').append(el);
    });
    $('usedCount').textContent = arabicNumber(room.usedAnswers.length);
    $('usedList').replaceChildren();
    if (!room.usedAnswers.length) $('usedList').append(node('span','muted','لسه ما في إجابات'));
    else room.usedAnswers.forEach(a => {
      const data=typeof a === 'string' ? {display:a,rarity:'common'} : a;
      $('usedList').append(node('span',`used-word ${data.rarity}`,data.display));
    });
    $('game').querySelector('.game-card').classList.toggle('danger',mine);
    if (mine && !state.wasMyTurn) {
      beep('pass');
      setTimeout(() => { if (state.room?.currentPlayerId === socket.id) $('answerInput').focus(); }, 150);
    }
    if (!mine && state.wasMyTurn) { $('answerInput').value = ''; clearPreview(); }
    if (state.room?.round !== state.lastPreviewRound) { clearPreview(); state.lastPreviewRound = state.room?.round; }
    state.wasMyTurn = mine;
  }
  function updateEnded(room) {
    const winner = room.players.find(p => p.id === room.winnerId);
    $('winnerName').textContent = winner ? `${winner.name} فاز!` : 'انتهت اللعبة';
    $('winnerSubtitle').textContent = winner ? 'آخر لاعب حافظ على قلوبه… بطل الجولة!' : 'كل اللاعبين خرجوا من المنافسة';
    const scores = [...room.players].sort((a,b) => b.hearts - a.hearts || b.score - a.score);
    $('finalScores').replaceChildren();
    scores.forEach((p,i) => {
      const row=node('div','final-entry');
      row.append(node('span','',`${arabicNumber(i+1)}.`));
      row.append(node('strong','',p.name));
      row.append(node('span','',`${arabicNumber(p.score)} نقطة · ${arabicNumber(p.correct)} إجابة · ${arabicNumber(p.hearts)} قلوب`));
      $('finalScores').append(row);
    });
    $('rematchBtn').hidden = room.hostId !== socket.id;
    if (state.screen !== 'ended') beep('win');
  }
  function onState(room) {
    state.room = room;
    const screen = room.status === 'playing' ? 'game' : room.status === 'ended' ? 'ended' : 'lobby';
    switchScreen(screen);
    if (screen === 'lobby') updateLobby(room);
    if (screen === 'game') updateGame(room);
    if (screen === 'ended') updateEnded(room);
  }
  function onFeed(event) {
    if (!event || event.seq === state.lastFeedSeq) return;
    state.lastFeedSeq = event.seq;
    $('activityText').textContent = event.text;
    if(event.type==='pop') {
      beep('pop');
      const gameCard=$('game').querySelector('.game-card');
      gameCard.classList.add('boom');setTimeout(()=>gameCard.classList.remove('boom'),800);
      toast(event.text);
    }
    if(event.type==='win') toast(event.text);
  }
  function clearPreview() {
    clearTimeout(previewTimer); previewSeq++;
    const el = $('answerSuggestion');
    el.textContent = ''; el.className = 'answer-suggestion';
  }
  function previewAnswer() {
    const typed = $('answerInput').value.trim();
    clearPreview();
    if (typed.length < 2 || !socket.connected || state.room?.currentPlayerId !== socket.id) return;
    const reqSeq = previewSeq;
    const round = state.room.round;
    previewTimer = setTimeout(() => {
      socket.timeout(2500).emit('previewAnswer', { answer: typed }, (err, res) => {
        if (err || !res?.ok || reqSeq !== previewSeq
          || state.room?.round !== round || state.room?.currentPlayerId !== socket.id
          || $('answerInput').value.trim() !== typed) return;
        const suggestion = res.suggestion;
        const el = $('answerSuggestion');
        el.classList.toggle('used', Boolean(suggestion?.used));
        if (!suggestion) { el.textContent = ''; return; }
        if (suggestion.used) el.textContent = `مستخدم من قبل: ${suggestion.display} — جرّب جواب تاني`;
        else if (suggestion.kind === 'typo') el.textContent = `تخميني: ${suggestion.display} · ${suggestion.rarityLabel} (+${suggestion.points}) ✓`;
        else if (suggestion.kind === 'partial') el.textContent = `كمّلنا الكلمة: ${suggestion.display} · ${suggestion.rarityLabel} (+${suggestion.points}) ✓`;
        else if (suggestion.kind === 'synonym') el.textContent = `مرادف مقبول: ${suggestion.display} · ${suggestion.rarityLabel} (+${suggestion.points}) ✓`;
        else el.textContent = `جواب معروف: ${suggestion.display} · ${suggestion.rarityLabel} (+${suggestion.points}) ✓`;
        el.classList.add('rarity-preview',suggestion.rarity);
      });
    }, 150);
  }
  function onAnswerSubmit(event) {
    event.preventDefault();
    const answer = $('answerInput').value.trim();
    if (!answer) return feedback('اكتب إجابتك أولًا', 'error');
    request('submitAnswer', {answer}, ({answer:value, points, heartsGained, gainedTime, rarityLabel, correction}) => {
      $('answerInput').value = '';
      clearPreview();
      feedback(`${correction === 'exact' ? 'ممتاز!' : 'خمّنا جوابك!'} ${value} — ${rarityLabel} (+${points} نقطة)${heartsGained ? ` +${heartsGained} قلب!` : ''}${gainedTime ? ` +${gainedTime} ثواني للمستقبل!` : ''}`, 'success');
    });
  }
  socket.on('connect', () => {
    $('statusIndicator').classList.add('online');
    $('statusIndicator').querySelector('span').textContent = 'متصل';
    // Socket IDs change on reconnect. An existing room cannot be resumed in this version.
    if (state.room) { toast('رجع الاتصال. أدخل رمز الغرفة من جديد');state.room=null;state.wasMyTurn=false;switchScreen('home'); }
  });
  socket.on('disconnect', () => {
    $('statusIndicator').classList.remove('online');
    $('statusIndicator').querySelector('span').textContent='غير متصل';
  });
  socket.on('state',onState);
  socket.on('feed',onFeed);
  $('username').value=state.name;
  const deepLinkCode = new URLSearchParams(location.search).get('room')?.trim().toUpperCase();
  if(deepLinkCode && /^[A-Z]{4}$/.test(deepLinkCode)) {
    $('roomCodeInput').value=deepLinkCode;
    if(state.name) toast('اكتب اسمك أو انضم مباشرة للغرفة');
  }
  $('roomCodeInput').addEventListener('input',()=>{$('roomCodeInput').value=$('roomCodeInput').value.replace(/[^a-z]/gi,'').toUpperCase().slice(0,4)});
  $('createBtn').addEventListener('click',createRoom);
  $('joinBtn').addEventListener('click',joinRoom);
  $('roomCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom()});
  $('copyBtn').addEventListener('click',copyInvite);
  $('startBtn').addEventListener('click',()=>request('startGame',{}));
  $('saveSettingsBtn').addEventListener('click', saveHostSettings);
  $('rematchBtn').addEventListener('click',()=>request('startGame',{}));
  $('answerForm').addEventListener('submit',onAnswerSubmit);
  $('answerInput').addEventListener('input',previewAnswer);
  document.querySelectorAll('.leave-btn').forEach(btn=>btn.addEventListener('click',leaveRoom));
  $('soundBtn').addEventListener('click',()=>{
    state.sound=!state.sound;
    localStorage.setItem('samaka-muted',state.sound?'no':'yes');
    $('soundBtn').classList.toggle('off',!state.sound);
    $('soundBtn').textContent=state.sound?'♫':'♩';
  });
  $('soundBtn').classList.toggle('off',!state.sound);
})();
