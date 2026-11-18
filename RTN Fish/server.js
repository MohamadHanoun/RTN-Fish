'use strict';
const crypto = require('crypto');
const { createTransport } = require('./transport');
const { questions, norm, matchDetailed } = require('./data/questions');
const { server, io } = createTransport();
const PORT = Number(process.env.PORT) || 3000;
const rooms = new Map();
const socketRoom = new Map();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MIN_TIME = 6, MAX_TIME = 90, MAX_HEARTS = 10;

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
  const maxPlayers = Number(data?.maxPlayers ?? current.maxPlayers ?? 6);
  const fuseMinSec = Number(data?.fuseMinSec ?? current.fuseMinSec ?? 12);
  const fuseMaxSec = Number(data?.fuseMaxSec ?? current.fuseMaxSec ?? 30);
  const mode = String(data?.mode ?? current.mode ?? 'all');
  if (![hearts,maxPlayers,fuseMinSec,fuseMaxSec].every(Number.isInteger)
      || hearts < 1 || hearts > 8 || maxPlayers < 2 || maxPlayers > 10
      || fuseMinSec < MIN_TIME || fuseMaxSec > MAX_TIME || fuseMaxSec < fuseMinSec
      || !['all','gaming','mostlyGaming'].includes(mode)) return null;
  return { hearts, maxPlayers, fuseMinSec, fuseMaxSec, mode };
}
function serialize(room) {
  return {
    code: room.code, status: room.status, hostId: room.hostId,
    settings: {...room.settings}, maxPlayers: room.settings.maxPlayers,
    hearts: room.settings.hearts, maxHearts: room.maxHearts,
    players: room.players.map(({id,name,hearts,charge,correct,score,timeBonus,rarityCounts}) =>
      ({id,name,hearts,charge,correct,score,timeBonus,rarityCounts})),
    currentPlayerId: room.currentPlayerId,
    question: questions.find(q => q.id === room.questionId)?.prompt ?? null,
    usedAnswers: room.usedDisplay.slice(-30),
    round: room.round, recent: room.recent, winnerId: room.winnerId,
    // The precise fuse duration and end time must stay hidden on the server.
    phaseStarted: room.phaseStarted
  };
}
function broadcast(room) { io.to(room.code).emit('state',serialize(room)); }
function clearFuse(room) { clearTimeout(room.timer);room.timer = null; }
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
  clearFuse(room);room.fuseEndsAt=Date.now()+ms;
  room.timer=setTimeout(()=>explode(room.code),ms);
}
function nextActive(room,previousId) {
  const index=room.players.findIndex(p=>p.id===previousId);
  for(let step=1;step<=room.players.length;step++) {
    const p=room.players[(index+step+room.players.length)%room.players.length];
    if(p?.hearts>0) return p;
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
  const question=candidates[crypto.randomInt(candidates.length)];
  room.questionHistory.push(question.id);
  return question;
}
function beginRound(room,preferredId=null) {
  if(activePlayers(room).length<=1) return endGame(room);
  room.round++;room.used=new Set();room.usedDisplay=[];
  room.questionId=chooseQuestion(room).id;
  const selected=activePlayers(room).find(p=>p.id===preferredId)
    ||activePlayers(room)[crypto.randomInt(activePlayers(room).length)];
  room.currentPlayerId=selected.id;
  const extra=Math.min(15,selected.timeBonus);
  selected.timeBonus=0; // bonus earned earlier applies when that player next starts a fresh round.
  room.phaseStarted=Date.now();
  const randomDuration=crypto.randomInt(room.settings.fuseMinSec*1000,room.settings.fuseMaxSec*1000+1);
  setFuse(room,randomDuration+extra*1000);
  broadcast(room);
  io.to(room.code).emit('round',{round:room.round,bonusPlayerId:extra?selected.id:null,bonusSeconds:extra});
  if(extra) emitFeed(room,'time',`${selected.name} بدأ الجولة ومعه +${extra} ثوانٍ مكافأة!`,{bonusSeconds:extra});
}
function explode(code) {
  const room=rooms.get(code);
  if(!room||room.status!=='playing') return;
  const holder=room.players.find(p=>p.id===room.currentPlayerId);
  if(!holder) return endGame(room);
  holder.hearts=Math.max(0,holder.hearts-1);
  clearFuse(room);
  emitFeed(room,'pop',`انفجرت السمكة عند ${holder.name} وخسر قلب!`);
  if(activePlayers(room).length<=1) return endGame(room);
  const next=holder.hearts>0?holder.id:nextActive(room,holder.id)?.id;
  beginRound(room,next);
}
function leave(socket,notify=true) {
  const code=socketRoom.get(socket.id);if(!code)return;
  socketRoom.delete(socket.id);socket.leave(code);
  const room=rooms.get(code);if(!room)return;
  const leaving=room.players.find(p=>p.id===socket.id);
  const wasHolder=room.currentPlayerId===socket.id;
  room.players=room.players.filter(p=>p.id!==socket.id);
  room.lastActiveAt=Date.now();
  if(!room.players.length){clearFuse(room);rooms.delete(code);return;}
  if(room.hostId===socket.id)room.hostId=room.players[0].id;
  if(room.status==='playing'){
    if(activePlayers(room).length<=1)endGame(room);
    else if(wasHolder){
      const next=activePlayers(room)[0];room.currentPlayerId=next.id;
      // Don't reset the timer on disconnect, preventing free time exploits.
      room.phaseStarted=Date.now();
    }
  }
  if(notify && leaving)emitFeed(room,'leave',`${leaving.name} غادر الغرفة`);
  broadcast(room);
}
function ackSafe(cb,response){if(typeof cb==='function')cb(response);}
function makePlayer(socket,name,hearts){
  return {id:socket.id,name:safeName(name),hearts,charge:0,correct:0,score:0,timeBonus:0,
    rarityCounts:{common:0,uncommon:0,rare:0,epic:0,legendary:0}};
}

io.on('connection',socket=>{
  let lastAnswerAt=0,lastPreviewAt=0;
  socket.on('createRoom',(data,ack)=>{
    const settings=parseSettings(data);
    if(!settings)return ackSafe(ack,{ok:false,error:'إعدادات الغرفة غير صحيحة'});
    leave(socket);
    const code=roomCode();
    const room={code,settings,maxHearts:Math.min(MAX_HEARTS,settings.hearts+3),hostId:socket.id,
      status:'lobby',players:[makePlayer(socket,data?.name,settings.hearts)],used:new Set(),
      usedDisplay:[],questionId:null,questionHistory:[],round:0,currentPlayerId:null,
      fuseEndsAt:null,timer:null,winnerId:null,recent:null,phaseStarted:null,lastActiveAt:Date.now()};
    rooms.set(code,room);socketRoom.set(socket.id,code);socket.join(code);broadcast(room);
    ackSafe(ack,{ok:true,code});
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
    room.players.push(makePlayer(socket,name,room.settings.hearts));
    socketRoom.set(socket.id,code);socket.join(code);
    room.lastActiveAt=Date.now();broadcast(room);ackSafe(ack,{ok:true,code});
  });
  socket.on('updateSettings',(data,ack)=>{
    const room=rooms.get(socketRoom.get(socket.id));
    if(!room||room.hostId!==socket.id)return ackSafe(ack,{ok:false,error:'فقط الهوست يقدر يعدّل الإعدادات'});
    if(room.status!=='lobby')return ackSafe(ack,{ok:false,error:'تغيير الإعدادات مسموح قبل بدء اللعبة'});
    const settings=parseSettings(data,room.settings);
    if(!settings||settings.maxPlayers<room.players.length)return ackSafe(ack,{ok:false,error:'تأكد من الوقت والقلوب وعدد اللاعبين'});
    room.settings=settings;room.maxHearts=Math.min(MAX_HEARTS,settings.hearts+3);
    room.players.forEach(p=>p.hearts=settings.hearts);
    room.lastActiveAt=Date.now();broadcast(room);ackSafe(ack,{ok:true});
  });
  socket.on('startGame',(_data,ack)=>{
    const room=rooms.get(socketRoom.get(socket.id));
    if(!room)return ackSafe(ack,{ok:false,error:'أنت لست في غرفة'});
    if(room.hostId!==socket.id)return ackSafe(ack,{ok:false,error:'فقط الهوست يبدأ اللعبة'});
    if(room.players.length<2)return ackSafe(ack,{ok:false,error:'تحتاج لاعبين على الأقل'});
    if(room.status==='playing')return ackSafe(ack,{ok:false,error:'اللعبة جارية'});
    clearFuse(room);room.status='playing';room.round=0;room.questionHistory=[];room.winnerId=null;
    room.players.forEach(p=>Object.assign(p,makePlayer({id:p.id},p.name,room.settings.hearts)));
    beginRound(room);ackSafe(ack,{ok:true});
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
    ackSafe(ack,{ok:true,suggestion:matched?{
      display:matched.answer.display,kind:matched.kind,rarity:matched.answer.rarity,
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
    const match=matchDetailed(questions[room.questionId-1],String(data?.answer??'').slice(0,80));
    if(!match)return ackSafe(ack,{ok:false,error:'ما لقينا جواب قريب، جرّب كلمة أوضح شوي'});
    const answer=match.answer,key=norm(answer.display);
    if(room.used.has(key))return ackSafe(ack,{ok:false,error:`${answer.display} مستخدمة! جرّب جواب غيره`});
    room.used.add(key);room.usedDisplay.push({display:answer.display,rarity:answer.rarity,rarityLabel:answer.rarityLabel});
    const player=room.players.find(p=>p.id===socket.id);
    player.correct++;player.score+=answer.value;player.charge+=answer.value;
    player.rarityCounts[answer.rarity]++;
    const beforeBonus=player.timeBonus;
    if(answer.timeBonus)player.timeBonus=Math.min(15,player.timeBonus+answer.timeBonus);
    const gainedTime=player.timeBonus-beforeBonus;
    let heartsGained=0;
    if(answer.rarity==='legendary'&&player.hearts<room.maxHearts){player.hearts++;heartsGained++;}
    if(player.charge>=100){player.charge-=100;
      if(player.hearts<room.maxHearts){player.hearts++;heartsGained++;}
    }
    const remaining=Math.max(1,room.fuseEndsAt-now); // no resetting the shared fuse on each answer
    room.currentPlayerId=nextActive(room,socket.id)?.id ?? null;
    room.phaseStarted=Date.now();setFuse(room,remaining);
    const reward=heartsGained?` +${heartsGained} قلب`:gainedTime?` +${gainedTime} ثواني لجولة قادمة`:'';
    emitFeed(room,'answer',`${player.name} جاوب «${answer.display}» — ${answer.rarityLabel} (+${answer.value} نقطة${reward})`,
      {rarity:answer.rarity,answer:answer.display,points:answer.value,heartsGained,gainedTime});
    broadcast(room);
    ackSafe(ack,{ok:true,answer:answer.display,rarity:answer.rarity,rarityLabel:answer.rarityLabel,
      points:answer.value,heartsGained,gainedTime,correction:match.kind});
  });
  socket.on('leaveRoom',(_data,ack)=>{leave(socket);ackSafe(ack,{ok:true});});
  socket.on('disconnect',()=>leave(socket));
});

setInterval(()=>{
  for(const [code,room] of rooms.entries()){
    if(!room.players.length||(room.status!=='playing'&&Date.now()-room.lastActiveAt>6*3600_000)){
      clearFuse(room);rooms.delete(code);
    }
  }
},20*60_000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`Samaka Arabic multiplayer online server on port ${PORT}`));
