// Minimal browser socket adapter for a built-in WebSocket server (no packages needed).
(function(){
  'use strict';
  window.io = function () {
    const listeners = new Map();
    const pending = new Map();
    let nextSeq = 0;
    let ws = null, closed = false, attempts = 0;
    const socket = {
      id: null, connected: false,
      on(event, callback) { if (!listeners.has(event)) listeners.set(event,[]);listeners.get(event).push(callback);return socket; },
      emit(event, data, callback) { return transmit(event,data,callback); },
      timeout(milliseconds) { return { emit(event,data,callback) { return transmit(event,data,(result)=>callback(null,result)); } }; },
      disconnect() {closed=true;if(ws)ws.close();}
    };
    function event(name,data){(listeners.get(name)||[]).forEach(fn => fn(data));}
    function transmit(name,data,callback) {
      if(!socket.connected){if(callback)callback({ok:false,error:'غير متصل'});return;}
      const seq=++nextSeq;
      if(callback){
        pending.set(seq,callback);
        setTimeout(()=>{if(pending.has(seq)){pending.delete(seq);callback(null,{ok:false,error:'انتهت مهلة الاتصال'});}},7000);
      }
      ws.send(JSON.stringify({t:'event',event:name,data,seq}));
    }
    function connect() {
      if(closed)return;
      const protocol=location.protocol==='https:'?'wss:':'ws:';
      ws=new WebSocket(`${protocol}//${location.host}/ws`);
      ws.addEventListener('message',msg=>{
        let parsed;try{parsed=JSON.parse(msg.data);}catch(_e){return;}
        if(parsed.t==='hello') {socket.id=parsed.id;socket.connected=true;attempts=0;event('connect');}
        if(parsed.t==='event')event(parsed.event,parsed.data);
        if(parsed.t==='ack') {const cb=pending.get(parsed.seq);if(cb){pending.delete(parsed.seq);cb(null,parsed.result);}}
      });
      ws.addEventListener('close',()=>{
        if(socket.connected){socket.connected=false;event('disconnect');}
        for(const [seq,cb] of pending){pending.delete(seq);cb(null,{ok:false,error:'انقطع الاتصال'});}
        if(!closed && attempts++<30)setTimeout(connect,Math.min(1000*attempts,5000));
      });
    }
    connect();return socket;
  };
})();
