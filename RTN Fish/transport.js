'use strict';
// Tiny dependency-free WebSocket + static HTTP transport for the Arabic party game.
// Protocol: {t:'event',event,data,seq?}, {t:'ack',seq,result}, {t:'hello',id}.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json; charset=utf-8', '.ico':'image/x-icon' };
const PUBLIC = path.join(__dirname, 'public');
function makeFrame(payload, opcode = 1) {
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let header;
  if (bytes.length < 126) { header = Buffer.from([0x80 | opcode, bytes.length]); }
  else if(bytes.length < 65536) { header = Buffer.alloc(4);header[0]=0x80|opcode;header[1]=126;header.writeUInt16BE(bytes.length,2); }
  else { header=Buffer.alloc(10);header[0]=0x80|opcode;header[1]=127;header.writeBigUInt64BE(BigInt(bytes.length),2); }
  return Buffer.concat([header,bytes]);
}
function createTransport() {
  const clients = new Map();
  const hooks = new EventEmitter();
  const io = {
    on: (event,fn) => hooks.on(event,fn),
    getSocket: id => clients.get(id),
    to: code => ({ emit: (event,data) => {
      for (const socket of clients.values()) if (socket.rooms.has(code)) socket.emit(event,data);
    } })
  };
  const server = http.createServer((req,res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405);return res.end('Method Not Allowed'); }
    if (req.url.split('?')[0] === '/health') {
      const {v4Summary} = require('./data/questions');
      res.setHeader('Content-Type','application/json');
      return res.end(JSON.stringify({ok:true,clients:clients.size,knowledgeV4:v4Summary}));
    }
    let requested;
    try { requested = decodeURIComponent(req.url.split('?')[0]); } catch (_e) { res.writeHead(400);return res.end('Bad Request'); }
    if (requested === '/') requested = '/index.html';
    const isThreeModule = requested === '/vendor/three.module.js';
    const full = isThreeModule
      ? path.join(path.dirname(require.resolve('three')), 'three.module.min.js')
      : path.resolve(PUBLIC, `.${requested}`);
    if (!isThreeModule && !full.startsWith(PUBLIC + path.sep)) {res.writeHead(403);return res.end('Forbidden');}
    fs.stat(full, (err,stats) => {
      if (err || !stats.isFile()) {res.writeHead(404);return res.end('Not Found');}
      res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      if (req.method === 'HEAD') {res.writeHead(200);return res.end();}
      fs.createReadStream(full).pipe(res);
    });
  });
  server.on('upgrade',(req,networkSocket) => {
    if (req.url.split('?')[0] !== '/ws' || req.headers.upgrade?.toLowerCase() !== 'websocket' || !req.headers['sec-websocket-key']) {
      networkSocket.destroy();return;
    }
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    networkSocket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const session = new EventEmitter();
    const id = crypto.randomUUID();
    let buffer = Buffer.alloc(0), closed = false;
    const socket = {
      id, rooms: new Set(),
      on: (event, fn) => session.on(event,fn),
      emit: (event,data) => send({t:'event',event,data}),
      join: code => socket.rooms.add(code),
      leave: code => socket.rooms.delete(code)
    };
    function send(data) {
      if(!closed && networkSocket.writable) networkSocket.write(makeFrame(JSON.stringify(data)));
    }
    function disconnect() {
      if(closed)return;
      closed=true;clients.delete(id);session.emit('disconnect');
    }
    clients.set(id,socket);
    send({t:'hello',id});
    hooks.emit('connection',socket);
    networkSocket.on('data',chunk => {
      if(closed)return;
      buffer = Buffer.concat([buffer,chunk]);
      if(buffer.length > 100_000) {networkSocket.destroy();return;}
      while (buffer.length >= 2) {
        const first = buffer[0],second=buffer[1];
        const opcode=first&0x0f;
        const masked=(second&0x80)!==0;
        if (!masked || (first&0x70)!==0 || (first&0x80)===0) {networkSocket.destroy();return;}
        let payloadLen=second&0x7f,header=2;
        if(payloadLen===126) {if(buffer.length<4)return;payloadLen=buffer.readUInt16BE(2);header=4;}
        else if(payloadLen===127) {if(buffer.length<10)return;const wide=buffer.readBigUInt64BE(2);if(wide>20_000n){networkSocket.destroy();return;}payloadLen=Number(wide);header=10;}
        if(payloadLen>20_000) {networkSocket.destroy();return;}
        if(buffer.length<header+4+payloadLen)return;
        const mask=buffer.subarray(header,header+4);
        const payload=Buffer.from(buffer.subarray(header+4,header+4+payloadLen));
        buffer=buffer.subarray(header+4+payloadLen);
        for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];
        if(opcode===8){networkSocket.end(makeFrame(Buffer.alloc(0),8));disconnect();return;}
        if(opcode===9){networkSocket.write(makeFrame(payload,10));continue;}
        if(opcode===10)continue;
        if(opcode!==1){networkSocket.destroy();return;}
        let msg;
        try {msg=JSON.parse(payload.toString('utf8'));} catch(_e){continue;}
        if(!msg || msg.t!=='event'||typeof msg.event!=='string')continue;
        if(['disconnect','connect'].includes(msg.event))continue;
        const ack = response => {
          if(Number.isSafeInteger(msg.seq))send({t:'ack',seq:msg.seq,result:response});
        };
        // Guard against handler errors from malformed input.
        try {session.emit(msg.event,msg.data,ack);} catch(e) {ack({ok:false,error:'تعذّر تنفيذ الطلب'});}
      }
    });
    networkSocket.on('close',disconnect);
    networkSocket.on('error',disconnect);
  });
  return {server,io};
}
module.exports = {createTransport};
