(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const socket = io({ reconnectionAttempts: 10 });
  const state = { room: null, name: localStorage.getItem('samaka-name') || '', screen: 'home', sound: localStorage.getItem('samaka-muted') !== 'yes', wasMyTurn: false, lastFeedSeq: -1, clockSkew: 0 };
  let toastTimeout = null, feedbackTimeout = null, actx = null, previewTimer = null, previewSeq = 0;
  const roomFromLink = new URLSearchParams(location.search).get('room')?.trim().toUpperCase();
  let pendingInviteCode = /^[A-Z]{4}$/.test(roomFromLink || '') ? roomFromLink : null;
  let inviteJoining = false, inviteAutoAttempted = false;
  // Always show Western digits (0–9), even if the browser uses an Arabic locale.
  const numberFormatter = new Intl.NumberFormat('en-US-u-nu-latn');
  const formatNumber = n => numberFormatter.format(Number(n || 0));
  function beep(kind = 'pass') {
    if (!state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = actx.createOscillator(); const gain = actx.createGain();
      osc.connect(gain); gain.connect(actx.destination);
      osc.type = kind === 'pop' || kind === 'wrong' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(kind === 'pop' ? 180 : kind === 'wrong' ? 270 : kind === 'win' ? 520 : 560, actx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(kind === 'pop' || kind === 'wrong' ? 95 : 820, actx.currentTime + .16);
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
  function animalAvatar(player, extraClass = '') {
    const type = player.avatar || 'fox';
    const el = node('span',`animal-avatar ${extraClass}`);
    const art = window.SamakaAnimals;
    if (art) {
      el.innerHTML = art.svg(type); // Only hardcoded, trusted SVG templates are used.
      el.style.setProperty('--animal-glow',art.animals[type]?.glow || '#64e7c1');
      el.setAttribute('aria-label',art.animals[type]?.label || 'حيوان');
    } else el.textContent = '🐾';
    return el;
  }
  function renderArena(room) {
    const arena = $('arenaPlayers');
    // Keep seat nodes between broadcasts so avatars don't flicker on every answer.
    const existing = new Map(Array.from(arena.children,el=>[el.dataset.playerId,el]));
    const count = room.players.length;
    room.players.forEach((p,i) => {
      // Players sit at equally spaced, stable places around the central fish.
      const angle = -Math.PI/2 + (2*Math.PI*i/count);
      // Keep bottom seats and their last-word bubbles above the answer dock.
      const vertical = Math.sin(angle);
      const x = 50 + 37*Math.cos(angle), y = 50 + (vertical > 0 ? 28 : 37)*vertical;
      const current = p.id === room.currentPlayerId;
      let seat = existing.get(p.id);
      if(!seat) {
        seat = node('div','arena-seat');
        seat.dataset.playerId = p.id;
        seat.append(animalAvatar(p,'arena-avatar'));
        seat.append(node('span','arena-player-name'));
        seat.append(node('span','arena-player-hearts'));
        seat.append(node('span','arena-last-word'));
        seat.append(node('span','arena-turn-star','✦'));
        seat.append(node('span','arena-turn-label','عنده الدور'));
      }
      existing.delete(p.id);
      seat.className = `arena-seat ${current?'on-turn':''} ${p.hearts<=0?'eliminated':''} ${p.id===socket.id?'my-seat':''}`;
      seat.style.left = `${x}%`;
      seat.style.top = `${y}%`;
      seat.style.setProperty('--seat-delay',`${i*70}ms`);
      seat.title = `${p.name} · ${formatNumber(p.hearts)} قلوب · ${formatNumber(p.score)} نقطة`;
      seat.querySelector('.arena-player-name').textContent = p.name;
      seat.querySelector('.arena-player-hearts').textContent = p.hearts>0 ? `♥ ${formatNumber(p.hearts)}` : 'خرج';
      const last = seat.querySelector('.arena-last-word');
      last.textContent = p.lastAnswer ? `💬 ${p.lastAnswer}` : '';
      last.dir = 'auto';
      last.hidden = !p.lastAnswer;
      seat.querySelector('.arena-turn-star').hidden = !current;
      seat.querySelector('.arena-turn-label').hidden = !current;
      arena.append(seat);
    });
    const turnIndex=room.players.findIndex(p=>p.id===room.currentPlayerId);
    $('arena').style.setProperty('--turn-rotation',`${turnIndex<0 ? 0 : 360*turnIndex/count}deg`);
    $('arena').classList.toggle('has-turn',turnIndex>=0);
    for (const stale of existing.values()) stale.remove();
  }
  function switchScreen(screen) {
    if (state.screen !== screen) {
      state.screen = screen;
      document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === screen));
      document.body.classList.toggle('in-game',screen === 'game');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
  function saveName(input) {
    const name = input.value.trim().slice(0, 18);
    if (!name) { toast('اكتب اسمك أولًا'); input.focus(); return null; }
    localStorage.setItem('samaka-name', name);
    state.name = name;
    return name;
  }
  function getName() { return saveName($('username')); }
  function request(event, data, cb, onError) {
    const fail = message => (onError || toast)(message);
    if (!socket.connected) return fail('الاتصال مقطوع. جرّب من جديد بعد الاتصال');
    socket.timeout(6000).emit(event, data, (err, response) => {
      if (err) return fail('لم يصل رد من السيرفر، حاول مرة ثانية');
      if (!response?.ok) return fail(response?.error || 'حصل خطأ');
      if (cb) cb(response);
    });
  }
  function getHomeSettings() {
    return { hearts: Number($('heartsSetting').value),
      fuseMinSec: Number($('minTimeSetting').value), fuseMaxSec: Number($('maxTimeSetting').value),
      mode: $('modeSetting').value };
  }
  function getHostSettings() {
    return { hearts: Number($('hostHearts').value),
      fuseMinSec: Number($('hostMinTime').value), fuseMaxSec: Number($('hostMaxTime').value),
      mode: $('hostMode').value };
  }
  function checkSettings(settings) {
    if (settings.fuseMinSec > settings.fuseMaxSec) { toast('أقل وقت ما لازم يكون أكبر من أطول وقت'); return false; }
    return true;
  }
  function saveHostSettings() {
    if (!state.room || state.room.hostId !== socket.id) return toast('فقط الهوست يقدر يعدّل الإعدادات');
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
  function enterInviteRoom(automatic = false) {
    if (!pendingInviteCode || inviteJoining) return;
    const name = automatic ? state.name : saveName($('inviteName'));
    if (!name) return;
    if (!socket.connected) return showInviteError('عم نتصل بالسيرفر، حاول بعد لحظة');
    inviteJoining = true;
    $('inviteJoinBtn').disabled = true;
    $('inviteError').textContent = '';
    $('inviteStatus').textContent = 'عم ندخّلك على الغرفة…';
    socket.timeout(6000).emit('joinRoom',{code:pendingInviteCode,name},(err,response)=>{
      inviteJoining = false;
      $('inviteJoinBtn').disabled = false;
      if(err || !response?.ok) {
        showInviteError(response?.error || 'تعذّر الانضمام للغرفة، جرّب مرة ثانية');
        $('inviteName').value = name;
        $('inviteName').focus();
        return;
      }
      pendingInviteCode = null;
      history.replaceState(null,'',`/?room=${response.code}`);
    });
  }
  function showInviteError(message) {
    $('inviteStatus').textContent = 'اكتب اسمك للانضمام إلى الغرفة';
    $('inviteError').textContent = message;
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
    $('lobbyCount').textContent = `${formatNumber(room.players.length)} لاعبين`;
    $('lobbyPlayerList').replaceChildren();
    room.players.forEach((p,i) => {
      const tile = node('div','player-tile');
      tile.append(animalAvatar(p,'lobby-avatar'));
      const info = node('div');info.append(node('strong','',p.name));
      const animalName = window.SamakaAnimals?.animals[p.avatar]?.label || 'حيوان';
      info.append(node('small','',`${p.id === room.hostId ? 'صاحب الغرفة' : `لاعب ${formatNumber(i + 1)}`} · ${animalName}`));
      tile.append(info);$('lobbyPlayerList').append(tile);
    });
    const isHost = room.hostId === socket.id;
    $('hostSettingsPanel').hidden = !isHost;
    $('hostSettingsPanel').inert = !isHost;
    $('hostSettingsPanel').setAttribute('aria-hidden',String(!isHost));
    $('saveSettingsBtn').disabled = !isHost;
    if (isHost) {
      const fields = { hostHearts:'hearts', hostMinTime:'fuseMinSec',
        hostMaxTime:'fuseMaxSec', hostMode:'mode' };
      for (const [id,key] of Object.entries(fields)) $(id).value = String(room.settings[key]);
    }
    const mode = room.settings.mode === 'gaming' ? 'Gaming فقط'
      : room.settings.mode === 'mostlyGaming' ? 'Gaming أغلب الوقت' : 'كل الأسئلة';
    $('lobbySettingsSummary').textContent = `الإعدادات: ${formatNumber(room.settings.hearts)} قلوب · من ${formatNumber(room.settings.fuseMinSec)} إلى ${formatNumber(room.settings.fuseMaxSec)} ثانية · ${mode}`;
    $('startBtn').hidden = !isHost;
    $('startBtn').disabled = !isHost || room.players.length < 2;
    $('waitingText').textContent = isHost
      ? (room.players.length < 2 ? 'لازم يدخل لاعب ثاني على الأقل' : 'كل اللاعبين جاهزين؟ ابدأ اللعبة!')
      : 'بانتظار صاحب الغرفة ليبدأ اللعبة…';
  }
  function updateGame(room) {
    const mine = room.currentPlayerId === socket.id;
    const holder = room.players.find(p => p.id === room.currentPlayerId);
    $('roundLabel').textContent = `السؤال ${formatNumber(room.round)}`;
    $('gameHeadline').textContent = mine ? 'السمكة عندك!' : 'خليك جاهز!';
    $('gameQuestion').textContent = room.question || '---';
    const topics = {'geography':'🌍 جغرافيا','food':'🍉 أكل ومشروبات','nature':'🦋 طبيعة','sports':'⚽ رياضة',
      'everyday':'🏡 يوميات','health-science':'🧬 علوم وصحة','technology':'💻 تقنية','entertainment':'🎬 ترفيه',
      'science':'🔭 علوم','arab-culture':'🌙 الوطن العربي','world-culture':'🌎 العالم','general':'✨ أسئلة عامة',
      'gaming-characters':'🎮 شخصيات ألعاب','gaming-worlds':'🗺️ عوالم ألعاب','gaming-items':'⚔️ أدوات ألعاب',
      'gaming-culture':'🏆 ثقافة Gaming','gaming-titles':'🕹️ ألعاب'};
    $('gameCategory').textContent = topics[room.theme] || '✨ تحدي جديد';
    $('holderChip').textContent = mine ? '⚡ دورك الآن!' : `🎯 الدور عند ${holder?.name || 'لاعب آخر'}`;
    $('holderChip').classList.toggle('mine',mine);
    $('answerInput').disabled = !mine;
    $('answerBtn').disabled = !mine;
    renderArena(room);
    $('gameCount').textContent = `${formatNumber(room.players.filter(p => p.hearts > 0).length)} ناجين`;
    $('gamePlayerList').replaceChildren();
    room.players.forEach(p => {
      const el = node('div',`game-player ${p.id === room.currentPlayerId ? 'is-active' : ''} ${p.hearts <= 0 ? 'is-dead' : ''}`);
      el.append(animalAvatar(p,'sidebar-avatar'));
      const info=node('div','player-meta');
      const title=node('strong','',p.name);
      if(p.id===socket.id) title.append(node('span','you-chip',' (أنت)'));
      info.append(title);
      info.append(node('div','hearts',('♥ '.repeat(p.hearts)||'خرج من اللعبة').trim()));
      const stats=node('div','player-stats',`${formatNumber(p.score)} نقطة · ${formatNumber(p.correct)} إجابة`);
      info.append(stats);
      const last=node('div','sidebar-last-word',p.lastAnswer ? `آخر جواب: ${p.lastAnswer}` : 'لم يجب بعد');
      info.append(last);
      if (p.timeBonus) info.append(node('div','time-bank',`+${formatNumber(p.timeBonus)} ثواني لما تبدأ جولة`));
      const bar=node('div','chargebar');const fill=node('span');fill.style.width=`${Math.max(0,Math.min(100,p.charge))}%`;bar.append(fill);info.append(bar);
      el.append(info); $('gamePlayerList').append(el);
    });
    $('usedCount').textContent = `${formatNumber(room.usedCount ?? room.usedAnswers.length)} / ${formatNumber(room.answerGoal ?? 0)}`;
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
    updateCountdown();
  }
  function updateCountdown() {
    const room=state.room;
    if(!room || room.status!=='playing' || !room.fuseEndsAt) return;
    const remaining=Math.max(0,(room.fuseEndsAt-(Date.now()+state.clockSkew))/1000);
    $('timerValue').textContent=remaining.toFixed(1);
    const fraction=Math.max(0,Math.min(1,remaining*1000/Math.max(1,room.fuseDurationMs||1000)));
    $('timerFill').style.width=`${fraction*100}%`;
    $('timerDisplay').classList.toggle('urgent',remaining<=5);
    $('timerDisplay').classList.toggle('critical',remaining<=2);
  }
  function updateEnded(room) {
    const winner = room.players.find(p => p.id === room.winnerId);
    $('winnerAvatar').replaceChildren();
    if (winner) $('winnerAvatar').append(animalAvatar(winner,'champion-avatar'));
    $('winnerName').textContent = winner ? `${winner.name} فاز!` : 'انتهت اللعبة';
    $('winnerSubtitle').textContent = winner ? 'آخر لاعب حافظ على قلوبه… بطل الجولة!' : 'كل اللاعبين خرجوا من المنافسة';
    const scores = [...room.players].sort((a,b) => b.hearts - a.hearts || b.score - a.score);
    $('finalScores').replaceChildren();
    scores.forEach((p,i) => {
      const row=node('div','final-entry');
      row.append(node('span','',`${formatNumber(i+1)}.`));
      row.append(node('strong','',p.name));
      row.append(node('span','',`${formatNumber(p.score)} نقطة · ${formatNumber(p.correct)} إجابة · ${formatNumber(p.hearts)} قلوب`));
      $('finalScores').append(row);
    });
    $('rematchBtn').hidden = room.hostId !== socket.id;
    if (state.screen !== 'ended') beep('win');
  }
  function onState(room) {
    state.room = room;
    if(Number.isFinite(room.serverNow)) state.clockSkew=room.serverNow-Date.now();
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
      gameCard.classList.add('boom');
      $('arena').classList.add('is-exploding');
      setTimeout(()=>{gameCard.classList.remove('boom');$('arena').classList.remove('is-exploding');},800);
      toast(event.text);
    }
    if(event.type==='win') toast(event.text);
  }
  function showAnswerError(message) {
    const duplicate=/مستخدم/.test(message);
    const wording=duplicate ? `⚠️ ${message}` : /ما لقينا جواب/.test(message)
      ? '✖ إجابة غير صحيحة! جرّب كلمة مختلفة أو تأكد من كتابتها.' : `✖ ${message}`;
    feedback(wording,'error');beep('wrong');
    const dock=document.querySelector('.answer-dock');
    dock.classList.remove('invalid');
    $('answerInput').classList.remove('input-shake');
    void dock.offsetWidth; // restart animation for consecutive wrong submissions
    dock.classList.add('invalid');
    $('answerInput').classList.add('input-shake');
    setTimeout(()=>{dock.classList.remove('invalid');$('answerInput').classList.remove('input-shake');},700);
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
        else if (suggestion.kind === 'typo') el.textContent = `تخميني: ${suggestion.display} · ${suggestion.rarityLabel} (+${formatNumber(suggestion.points)}) ✓`;
        else if (suggestion.kind === 'partial') el.textContent = `كمّلنا الكلمة: ${suggestion.display} · ${suggestion.rarityLabel} (+${formatNumber(suggestion.points)}) ✓`;
        else if (suggestion.kind === 'synonym') el.textContent = `مرادف مقبول: ${suggestion.display} · ${suggestion.rarityLabel} (+${formatNumber(suggestion.points)}) ✓`;
        else el.textContent = `جواب معروف: ${suggestion.display} · ${suggestion.rarityLabel} (+${formatNumber(suggestion.points)}) ✓`;
        el.classList.add('rarity-preview',suggestion.rarity);
      });
    }, 150);
  }
  function onAnswerSubmit(event) {
    event.preventDefault();
    const answer = $('answerInput').value.trim();
    if (!answer) return showAnswerError('اكتب إجابتك أولًا');
    request('submitAnswer', {answer}, ({answer:value, points, heartsGained, gainedTime, rarityLabel, correction}) => {
      $('answerInput').value = '';
      clearPreview();
      feedback(`${correction === 'exact' ? 'ممتاز!' : 'خمّنا جوابك!'} ${value} — ${rarityLabel} (+${formatNumber(points)} نقطة)${heartsGained ? ` +${formatNumber(heartsGained)} قلب!` : ''}${gainedTime ? ` +${formatNumber(gainedTime)} ثواني للمستقبل!` : ''}`, 'success');
    },showAnswerError);
  }
  socket.on('connect', () => {
    $('statusIndicator').classList.add('online');
    $('statusIndicator').querySelector('span').textContent = 'متصل';
    // Socket IDs change on reconnect. An existing room cannot be resumed in this version.
    if (state.room) { toast('رجع الاتصال. أدخل رمز الغرفة من جديد');state.room=null;state.wasMyTurn=false;switchScreen('home'); }
    if(pendingInviteCode && state.name && !inviteAutoAttempted) {
      inviteAutoAttempted = true;
      enterInviteRoom(true);
    }
  });
  socket.on('disconnect', () => {
    $('statusIndicator').classList.remove('online');
    $('statusIndicator').querySelector('span').textContent='غير متصل';
  });
  socket.on('state',onState);
  socket.on('feed',onFeed);
  $('username').value=state.name;
  $('inviteName').value=state.name;
  if(pendingInviteCode) {
    $('inviteCode').textContent=pendingInviteCode;
    $('roomCodeInput').value=pendingInviteCode;
    switchScreen('invite');
    if(!state.name) $('inviteName').focus();
  }
  $('inviteForm').addEventListener('submit', e=>{e.preventDefault();enterInviteRoom();});
  $('inviteBackBtn').addEventListener('click',()=>{
    pendingInviteCode=null;
    history.replaceState(null,'','/');
    $('inviteError').textContent='';
    switchScreen('home');
  });
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
  setInterval(updateCountdown,100);
})();
