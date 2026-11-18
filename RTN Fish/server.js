'use strict';
const crypto = require('crypto');
const { createTransport } = require('./transport');
const { questions, norm, matchDetailed } = require('./data/questions');
const { requiredAnswers } = require('./data/progression');
const { server, io } = createTransport();
const PORT = Number(process.env.PORT) || 3000;
const rooms = new Map();
const socketRoom = new Map();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MIN_TIME = 6, MAX_TIME = 90, MAX_HEARTS = 10;
const RECONNECT_GRACE_MS = Math.max(500,Math.min(120_000,Number(process.env.RECONNECT_GRACE_MS)||45_000));
const REACTIONS = new Set(['👏','😂','😱','💀','🔥','🐡']);
const AVATARS = Object.freeze(['dog','wolf','fox','cat','bear','rabbit','lion','panda','tiger','owl','koala','raccoon']);

function chooseAvatar(players = []) {
  const occupied = new Set(players.map(player => player.avatar));
  const available = AVATARS.filter(animal => !occupied.has(animal));
  return available[crypto.randomInt(available.length)];
}

function safeName(value) {
  return String(value ?? '').replace(/[<>\r\n\u0000-\u001f]/g, '').trim().slice(0,18) || 'لاعب';
}
function roomCode() {
  for (let k = 0; k < 100; k++) {
    const code = Array.from(crypto.randomBytes(4), x => ALPHABET[x % ALPHABET.length]).join('');
    if (!rooms.has(code)) return code;
  }
  throw new Error('تعذّر إنشاء الغرفة');
}
function activePlayers(room) { return room.players.filter(p => p.hearts > 0); }
function parseSettings(data, current = {}) {
  const hearts = Number(data?.hearts ?? current.hearts ?? 3);
  // Rooms grow automatically as friends join; a host never has to choose capacity.
  const maxPlayers = 10;
  const fuseMinSec = Number(data?.fuseMinSec ?? current.fuseMinSec ?? 12);
  const fuseMaxSec = Number(data?.fuseMaxSec ?? current.fuseMaxSec ?? 30);
  const mode = String(data?.mode ?? current.mode ?? 'all');
  if (![hearts,fuseMinSec,fuseMaxSec].every(Number.isInteger)
      || hearts < 1 || hearts > 8
      || fuseMinSec < MIN_TIME || fuseMaxSec > MAX_TIME || fuseMaxSec < fuseMinSec
      || !['all','gaming','mostlyGaming'].includes(mode)) return null;
  return { hearts, maxPlayers, fuseMinSec, fuseMaxSec, mode };
}
function serialize(room) {
  const question=questions[room.questionId-1];
  return {
    code: room.code, status: room.status, hostId: room.hostId,
    settings: {...room.settings}, maxPlayers: room.settings.maxPlayers,
    hearts: room.settings.hearts, maxHearts: room.maxHearts,
    players: room.players.map(({id,name,avatar,hearts,charge,correct,score,timeBonus,rarityCounts,lastAnswer,connected,explosions,bestAnswerMs}) =>
      ({id,name,avatar,hearts,charge,correct,score,timeBonus,rarityCounts,lastAnswer,connected,explosions,bestAnswerMs})),
    currentPlayerId: room.currentPlayerId,
    question: question?.prompt ?? null, theme:question?.theme ?? null,
    usedAnswers: room.usedDisplay.slice(-30), usedCount: room.used.size,
    round: room.round, answerGoal: room.answerGoal, recent: room.recent, winnerId: room.winnerId,
    phaseStarted: room.phaseStarted, fuseEndsAt: room.fuseEndsAt,
    fuseDurationMs: room.fuseDurationMs, serverNow: Date.now()
  };
}
function broadcast(room) { io.to(room.code).emit('state',serialize(room)); }
function clearFuse(room) {
  clearTimeout(room.timer);room.timer = null;
  // Invalidates even callbacks already queued when a turn switches hands.
  room.fuseSerial=(room.fuseSerial||0)+1;
}
function emitFeed(room,type,text,detail={}) {
  room.recent = { type, text, ...detail, at: Date.now(), seq:(room.recent?.seq ?? 0) + 1 };
  io.to(room.code).emit('feed',room.recent);
}
function endGame(room) {
  clearFuse(room);room.status='ended';room.currentPlayerId=null;room.fuseEndsAt=null;
  room.winnerId=activePlayers(room)[0]?.id || null;
  room.lastActiveAt=Date.now(); broadcast(room);
  const winner=room.players.find(p=>p.id===room.winnerId);
  emitFeed(room,'win',winner?`${winner.name} فاز باللعبة!`:'انتهت اللعبة');
}
function setFuse(room,ms) {
  clearFuse(room);room.fuseDurationMs=ms;room.fuseEndsAt=Date.now()+ms;
  const serial=room.fuseSerial;
  room.timer=setTimeout(()=>{if(room.fuseSerial===serial)explode(room.code);},ms);
}
function nextActive(room,previousId) {
  const index=room.players.findIndex(p=>p.id===previousId);
  for(let step=1;step<=room.players.length;step++) {
    const p=room.players[(index+step+room.players.length)%room.players.length];
    if(p?.hearts>0 && p.connected) return p;
  }
  return null;
}
function chooseQuestion(room) {
  let pool = room.settings.mode === 'gaming'
    ? questions.filter(q=>q.category==='gaming')
    : room.settings.mode === 'mostlyGaming' && Math.random()<0.75
      ? questions.filter(q=>q.category==='gaming') : questions;
  let candidates=pool.filter(q=>!room.questionHistory.includes(q.id));
  if(!candidates.length) {
    // Don't repeat until relevant pool is exhausted; reset history if necessary.
    room.questionHistory=[];candidates=pool;
  }
  // Pick a topic that hasn't appeared recently. Balance between topics instead
  // of letting a large collection of near-identical prompts dominate the game.
  const recentThemes = room.themeHistory.slice(-3);
  const withoutRecent = candidates.filter(q=>!recentThemes.includes(q.theme));
  if(withoutRecent.length) candidates=withoutRecent;
  else {
    const withoutLast = candidates.filter(q=>q.theme!==room.themeHistory.at(-1));
    if(withoutLast.length) candidates=withoutLast;
  }
  const byTheme=new Map();
  for(const q of candidates) {
    if(!byTheme.has(q.theme))byTheme.set(q.theme,[]);
    byTheme.get(q.theme).push(q);
  }
  const leastUsed=Math.min(...[...byTheme.keys()].map(theme=>room.themeCounts[theme]||0));
  const diverseThemes=[...byTheme.keys()].filter(theme=>(room.themeCounts[theme]||0)<=leastUsed+1);
  const theme=diverseThemes[crypto.randomInt(diverseThemes.length)];
  const choices=byTheme.get(theme);
  const question=choices[crypto.randomInt(choices.length)];
  room.questionHistory.push(question.id);
  room.themeHistory.push(question.theme);
  if(room.themeHistory.length>8)room.themeHistory.shift();
  room.themeCounts[question.theme]=(room.themeCounts[question.theme]||0)+1;
  return question;
}
function startFuseFor(room,player,applyBonus=false) {
  const extra=applyBonus?Math.min(15,player.timeBonus):0;
  if(applyBonus) player.timeBonus=0;
  room.phaseStarted=Date.now();
  // Pick a personal time allowance once per question. If the fish returns to
  // this player, they start from that SAME full allowance, not the old remainder.
  let baseDuration=room.turnDurationByPlayer.get(player.id);
  if(baseDuration===undefined) {
    baseDuration=crypto.randomInt(room.settings.fuseMinSec*1000,room.settings.fuseMaxSec*1000+1);
    room.turnDurationByPlayer.set(player.id,baseDuration);
  }
  setFuse(room,baseDuration+extra*1000);
  return extra;
}
function beginQuestion(room,preferredId=null) {
  if(activePlayers(room).length<=1) return endGame(room);
  room.round++;room.used=new Set();room.usedDisplay=[];room.failedSinceAnswer=new Set();room.turnDurationByPlayer=new Map();
  const question=chooseQuestion(room);
  room.questionId=question.id;
  room.answerGoal=requiredAnswers(question.answers.length,activePlayers(room).length);
  const online=activePlayers(room).filter(p=>p.connected);
  const selected=online.find(p=>p.id===preferredId)
    ||(online.length ? online[crypto.randomInt(online.length)] : null);
  room.currentPlayerId=selected?.id ?? null;
  const extra=selected ? startFuseFor(room,selected,true) : 0;
  if(!selected){clearFuse(room);room.fuseEndsAt=null;}
  broadcast(room);
  io.to(room.code).emit('round',{round:room.round,bonusPlayerId:extra?selected.id:null,bonusSeconds:extra});
  if(extra) emitFeed(room,'time',`${selected.name} بدأ السؤال الجديد ومعه +${extra} ثوانٍ مكافأة!`,{bonusSeconds:extra});
}
function explode(code) {
  const room=rooms.get(code);
  if(!room||room.status!=='playing') return;
  const holder=room.players.find(p=>p.id===room.currentPlayerId);
  if(!holder) return endGame(room);
  holder.hearts=Math.max(0,holder.hearts-1);
  holder.explosions++;
  room.failedSinceAnswer.add(holder.id);
  clearFuse(room);
  emitFeed(room,'pop',`انفجرت السمكة عند ${holder.name} وخسر قلب!`);
  if(activePlayers(room).length<=1) return endGame(room);
  // An explosion costs one heart and passes the fish to the NEXT living player.
  // The same question and its used answers stay active until the answer goal is reached.
  const next=nextActive(room,holder.id);
  if(activePlayers(room).every(p=>room.failedSinceAnswer.has(p.id))) {
    // Everybody still alive has lost a heart without a successful answer:
    // don't trap the group on an impossible question.
    beginQuestion(room,next?.id);
    return;
  }
  room.currentPlayerId=next?.id ?? null;
  if(next)startFuseFor(room,next);
  else room.fuseEndsAt=null;
  broadcast(room);
}
function playerDeparture(room,player,expired=false) {
  clearTimeout(player.disconnectTimer);player.disconnectTimer=null;
  const wasHolder=room.currentPlayerId===player.id;
  const upcoming=wasHolder?nextActive(room,player.id):null;
  const wasHost=room.hostId===player.id;
  room.failedSinceAnswer.delete(player.id);
  room.turnDurationByPlayer?.delete(player.id);
  if(expired && ['playing','ended'].includes(room.status)) {
    if(room.status==='playing')player.hearts=0;
    player.connected=false;
  } else room.players=room.players.filter(p=>p!==player);
  room.lastActiveAt=Date.now();
  if(!room.players.length){clearFuse(room);rooms.delete(room.code);return;}
  if(wasHost)room.hostId=(room.players.find(p=>p.connected)||room.players[0]).id;
  if(room.status==='playing'){
    if(activePlayers(room).length<=1) return endGame(room);
    if(wasHolder){
      const next=upcoming?.hearts>0&&upcoming.connected?upcoming:nextActive(room,player.id);
      room.currentPlayerId=next?.id??null;
      if(next)startFuseFor(room,next);
      else {clearFuse(room);room.fuseEndsAt=null;}
    }
  }
  broadcast(room);
}
function leave(socket,notify=true) {
  const code=socketRoom.get(socket.id);if(!code)return;
  socketRoom.delete(socket.id);socket.leave(code);
  const room=rooms.get(code);if(!room)return;
  const leaving=room.players.find(p=>p.id===socket.id);
  if(!leaving)return;
  playerDeparture(room,leaving);
  if(notify && leaving && room.status!=='ended')emitFeed(room,'leave',`${leaving.name} غادر الغرفة`);
}
function disconnect(socket) {
  const code=socketRoom.get(socket.id);if(!code)return;
  socketRoom.delete(socket.id);
  const room=rooms.get(code),player=room?.players.find(p=>p.id===socket.id);
  if(!player)return;
  player.connected=false;
  player.disconnectTimer=setTimeout(()=>{
    if(rooms.get(code)!==room || player.connected)return;
    playerDeparture(room,player,true);
    if(room.status!=='ended')emitFeed(room,'leave',`${player.name} انتهت مهلة إعادة اتصاله`);
  },RECONNECT_GRACE_MS);
  player.disconnectTimer.unref?.();
  if(room.status==='playing' && room.currentPlayerId===player.id){
    const next=nextActive(room,player.id);
    room.currentPlayerId=next?.id??null;
    if(next)startFuseFor(room,next);
    else {clearFuse(room);room.fuseEndsAt=null;}
  }
  broadcast(room);
  emitFeed(room,'connection',`${player.name} انقطع اتصاله — عنده 45 ثانية ليرجع`);
}
function ackSafe(cb,response){if(typeof cb==='function')cb(response);}
function makePlayer(socket,name,hearts,avatar,token){
  return {id:socket.id,sessionToken:token||crypto.randomBytes(24).toString('base64url'),connected:true,
    name:safeName(name),avatar:avatar || chooseAvatar(),hearts,charge:0,correct:0,score:0,timeBonus:0,lastAnswer:'',explosions:0,bestAnswerMs:null,
    rarityCounts:{common:0,uncommon:0,rare:0,epic:0,legendary:0}};
}

io.on('connection',socket=>{
  let lastAnswerAt=0,lastPreviewAt=0,lastReactionAt=0,lastSuggestionAt=0;
  socket.on('createRoom',(data,ack)=>{
    const settings=parseSettings(data);
    if(!settings)return ackSafe(ack,{ok:false,error:'إعدادات الغرفة غير صحيحة'});
    leave(socket);
    const code=roomCode();
    const room={code,settings,maxHearts:Math.min(MAX_HEARTS,settings.hearts+3),hostId:socket.id,
      status:'lobby',players:[makePlayer(socket,data?.name,settings.hearts)],used:new Set(),
      usedDisplay:[],failedSinceAnswer:new Set(),questionId:null,questionHistory:[],themeHistory:[],themeCounts:{},round:0,answerGoal:0,currentPlayerId:null,
      fuseEndsAt:null,fuseDurationMs:null,timer:null,winnerId:null,recent:null,phaseStarted:null,lastActiveAt:Date.now()};
    rooms.set(code,room);socketRoom.set(socket.id,code);socket.join(code);broadcast(room);
    ackSafe(ack,{ok:true,code,sessionToken:room.players[0].sessionToken});
  });
  socket.on('joinRoom',(data,ack)=>{
    const code=String(data?.code||'').trim().toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
    const room=rooms.get(code);
    if(!room)return ackSafe(ack,{ok:false,error:'رمز الغرفة غير صحيح'});
    if(room.status!=='lobby')return ackSafe(ack,{ok:false,error:'اللعبة بدأت، انتظر المباراة القادمة'});
    if(room.players.length>=room.settings.maxPlayers)return ackSafe(ack,{ok:false,error:'الغرفة ممتلئة'});
    const name=safeName(data?.name);
    if(room.players.some(p=>norm(p.name)===norm(name)))return ackSafe(ack,{ok:false,error:'الاسم مستخدم بالغرفة'});
    leave(socket);
    const player=makePlayer(socket,name,room.settings.hearts,chooseAvatar(room.players));
    room.players.push(player);
    socketRoom.set(socket.id,code);socket.join(code);
    room.lastActiveAt=Date.now();broadcast(room);ackSafe(ack,{ok:true,code,sessionToken:player.sessionToken});
  });
  socket.on('resumeRoom',(data,ack)=>{
    const code=String(data?.code||'').trim().toUpperCase();
    const token=typeof data?.sessionToken==='string'?data.sessionToken:'';
    const room=rooms.get(code);
    const player=room?.players.find(p=>p.sessionToken===token && token.length>=24);
    if(!player)return ackSafe(ack,{ok:false,error:'الجلسة انتهت، ادخل للغرفة من جديد'});
    if(player.connected)return ackSafe(ack,{ok:false,error:'حساب اللاعب متصل من جهاز آخر'});
    leave(socket);
    const oldId=player.id;
    clearTimeout(player.disconnectTimer);player.disconnectTimer=null;
    player.id=socket.id;player.connected=true;
    if(room.hostId===oldId)room.hostId=socket.id;
    if(room.currentPlayerId===oldId)room.currentPlayerId=socket.id;
    if(room.winnerId===oldId)room.winnerId=socket.id;
    if(room.failedSinceAnswer.has(oldId)){room.failedSinceAnswer.delete(oldId);room.failedSinceAnswer.add(socket.id);}
    if(room.turnDurationByPlayer?.has(oldId)){
      const duration=room.turnDurationByPlayer.get(oldId);
      room.turnDurationByPlayer.delete(oldId);room.turnDurationByPlayer.set(socket.id,duration);
    }
    socketRoom.set(socket.id,code);socket.join(code);
    room.lastActiveAt=Date.now();
    if(room.status==='playing'&&!room.currentPlayerId){room.currentPlayerId=socket.id;startFuseFor(room,player);}
    broadcast(room);
    ackSafe(ack,{ok:true,code,sessionToken:token});
  });
  socket.on('updateSettings',(data,ack)=>{
    const room=rooms.get(socketRoom.get(socket.id));
    if(!room||room.hostId!==socket.id)return ackSafe(ack,{ok:false,error:'فقط الهوست يقدر يعدّل الإعدادات'});
    if(room.status!=='lobby')return ackSafe(ack,{ok:false,error:'تغيير الإعدادات مسموح قبل بدء اللعبة'});
    const settings=parseSettings(data,room.settings);
    if(!settings)return ackSafe(ack,{ok:false,error:'تأكد من الوقت والقلوب'});
    room.settings=settings;room.maxHearts=Math.min(MAX_HEARTS,settings.hearts+3);
    room.players.forEach(p=>p.hearts=settings.hearts);
    room.lastActiveAt=Date.now();broadcast(room);ackSafe(ack,{ok:true});
  });
  socket.on('startGame',(_data,ack)=>{
    const room=rooms.get(socketRoom.get(socket.id));
    if(!room)return ackSafe(ack,{ok:false,error:'أنت لست في غرفة'});
    if(room.hostId!==socket.id)return ackSafe(ack,{ok:false,error:'فقط الهوست يبدأ اللعبة'});
    if(room.players.filter(p=>p.connected).length<2)return ackSafe(ack,{ok:false,error:'تحتاج لاعبين متصلين على الأقل'});
    if(room.status==='playing')return ackSafe(ack,{ok:false,error:'اللعبة جارية'});
    clearFuse(room);room.status='playing';room.round=0;room.questionHistory=[];room.themeHistory=[];room.themeCounts={};room.winnerId=null;
    for(const p of room.players)if(!p.connected)clearTimeout(p.disconnectTimer);
    room.players=room.players.filter(p=>p.connected);
    room.players.forEach(p=>Object.assign(p,makePlayer({id:p.id},p.name,room.settings.hearts,p.avatar,p.sessionToken)));
    beginQuestion(room);ackSafe(ack,{ok:true});
  });
  socket.on('previewAnswer',(data,ack)=>{
    const now=Date.now();
    if(now-lastPreviewAt<90)return ackSafe(ack,{ok:true,suggestion:null});
    lastPreviewAt=now;
    const room=rooms.get(socketRoom.get(socket.id));
    if(!room||room.status!=='playing'||room.currentPlayerId!==socket.id||now>=room.fuseEndsAt)
      return ackSafe(ack,{ok:true,suggestion:null});
    const question=questions[room.questionId-1];
    const matched=matchDetailed(question,String(data?.answer??'').slice(0,70));
    // Typo/partial previews cannot leak the undiscovered answer to a player.
    ackSafe(ack,{ok:true,suggestion:matched?{
      display:['exact','synonym'].includes(matched.kind)?matched.answer.display:null,
      kind:matched.kind,rarity:matched.answer.rarity,
      rarityLabel:matched.answer.rarityLabel,points:matched.answer.value,
      used:room.used.has(norm(matched.answer.display))}:null});
  });
  socket.on('submitAnswer',(data,ack)=>{
    const now=Date.now();
    if(now-lastAnswerAt<220)return ackSafe(ack,{ok:false,error:'تمهّل قليلًا'});
    lastAnswerAt=now;
    const room=rooms.get(socketRoom.get(socket.id));
    if(!room||room.status!=='playing')return ackSafe(ack,{ok:false,error:'اللعبة لم تبدأ'});
    if(room.currentPlayerId!==socket.id)return ackSafe(ack,{ok:false,error:'ليس دورك الآن'});
    if(now>=room.fuseEndsAt){explode(room.code);return ackSafe(ack,{ok:false,error:'انتهى الوقت!'});}
    const submitted=String(data?.answer??'').replace(/[\r\n\u0000-\u001f]/g,'').trim().slice(0,70);
    const match=matchDetailed(questions[room.questionId-1],submitted);
    if(!match)return ackSafe(ack,{ok:false,error:'ما لقينا جواب قريب، جرّب كلمة أوضح شوي'});
    const answer=match.answer,key=norm(answer.display);
    if(room.used.has(key))return ackSafe(ack,{ok:false,error:`${answer.display} مستخدمة! جرّب جواب غيره`});
    room.used.add(key);room.usedDisplay.push({display:answer.display,rarity:answer.rarity,rarityLabel:answer.rarityLabel});
    room.failedSinceAnswer.clear();
    const player=room.players.find(p=>p.id===socket.id);
    player.lastAnswer=submitted;
    player.correct++;player.score+=answer.value;player.charge+=answer.value;
    const answerMs=Math.max(0,now-room.phaseStarted);
    player.bestAnswerMs=player.bestAnswerMs===null?answerMs:Math.min(player.bestAnswerMs,answerMs);
    player.rarityCounts[answer.rarity]++;
    const beforeBonus=player.timeBonus;
    if(answer.timeBonus)player.timeBonus=Math.min(15,player.timeBonus+answer.timeBonus);
    const gainedTime=player.timeBonus-beforeBonus;
    let heartsGained=0;
    if(answer.rarity==='legendary'&&player.hearts<room.maxHearts){player.hearts++;heartsGained++;}
    if(player.charge>=100){player.charge-=100;
      if(player.hearts<room.maxHearts){player.hearts++;heartsGained++;}
    }
    const next=nextActive(room,socket.id);
    if(room.used.size>=room.answerGoal) {
      // A fraction of the question's available answers unlocks the next question.
      beginQuestion(room,next?.id);
    } else {
      // Every turn has a fresh timer. The outgoing player's unused time never
      // carries over to the next player or their next turn on this question.
      room.currentPlayerId=next?.id ?? null;
      if(next)startFuseFor(room,next);
    }
    const reward=heartsGained?` +${heartsGained} قلب`:gainedTime?` +${gainedTime} ثواني لجولة قادمة`:'';
    emitFeed(room,'answer',`${player.name} جاوب «${answer.display}» — ${answer.rarityLabel} (+${answer.value} نقطة${reward})`,
      {rarity:answer.rarity,answer:answer.display,points:answer.value,heartsGained,gainedTime});
    broadcast(room);
    ackSafe(ack,{ok:true,answer:answer.display,rarity:answer.rarity,rarityLabel:answer.rarityLabel,
      points:answer.value,heartsGained,gainedTime,correction:match.kind});
  });
  socket.on('react',(data,ack)=>{
    const room=rooms.get(socketRoom.get(socket.id));
    const emoji=String(data?.emoji||'');
    if(!room||room.status!=='playing'||!REACTIONS.has(emoji))return ackSafe(ack,{ok:false,error:'تفاعل غير مسموح'});
    if(Date.now()-lastReactionAt<1300)return ackSafe(ack,{ok:false,error:'لحظة قبل التفاعل التالي'});
    lastReactionAt=Date.now();
    io.to(room.code).emit('reaction',{playerId:socket.id,emoji,at:Date.now()});
    ackSafe(ack,{ok:true});
  });
  socket.on('suggestAnswer',(data,ack)=>{
    const room=rooms.get(socketRoom.get(socket.id));
    if(!room||room.status!=='playing')return ackSafe(ack,{ok:false,error:'يجب أن تكون داخل مباراة'});
    if(Date.now()-lastSuggestionAt<10_000)return ackSafe(ack,{ok:false,error:'انتظر 10 ثواني قبل اقتراح جديد'});
    const answer=String(data?.answer||'').replace(/[<>\r\n\u0000-\u001f]/g,'').trim().slice(0,70);
    if(answer.length<2)return ackSafe(ack,{ok:false,error:'اكتب إجابة من حرفين على الأقل'});
    const q=questions[room.questionId-1];
    if(matchDetailed(q,answer))return ackSafe(ack,{ok:false,error:'هذه الكلمة مقبولة بالفعل!'});
    lastSuggestionAt=Date.now();
    console.log('ANSWER_SUGGESTION',JSON.stringify({questionId:q.id,question:q.prompt,answer}));
    ackSafe(ack,{ok:true});
  });
  socket.on('leaveRoom',(_data,ack)=>{leave(socket);ackSafe(ack,{ok:true});});
  socket.on('disconnect',()=>disconnect(socket));
});

setInterval(()=>{
  for(const [code,room] of rooms.entries()){
    if(!room.players.length||(room.status!=='playing'&&Date.now()-room.lastActiveAt>6*3600_000)){
      clearFuse(room);rooms.delete(code);
    }
  }
},20*60_000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`Samaka Arabic multiplayer online server on port ${PORT}`));
