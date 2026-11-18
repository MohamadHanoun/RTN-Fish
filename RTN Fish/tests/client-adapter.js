'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class FakeWebSocket {
  constructor(url) { this.url = url; this.handlers = {}; FakeWebSocket.active = this; }
  addEventListener(name, callback) { this.handlers[name] = callback; }
  send(payload) {
    const packet = JSON.parse(payload);
    const response = packet.event === 'createRoom'
      ? { ok: true, code: 'FISH' }
      : { ok: false, error: 'إجابة غير صحيحة' };
    this.handlers.message({ data: JSON.stringify({ t: 'ack', seq: packet.seq, result: response }) });
  }
}

const context = {
  window: {}, WebSocket: FakeWebSocket,
  location: { protocol: 'https:', host: 'rtn-fish.onrender.com' },
  setTimeout: () => 0
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/ws-adapter.js'), 'utf8'), context);
const socket = context.window.io();
FakeWebSocket.active.handlers.message({ data: JSON.stringify({ t: 'hello', id: 'test-id' }) });
assert.strictEqual(socket.connected, true);

let success = null, failure = null;
socket.timeout(6000).emit('createRoom', {}, (err, response) => { success = { err, response }; });
socket.timeout(6000).emit('submitAnswer', {}, (err, response) => { failure = { err, response }; });
assert.strictEqual(success.err, null);
assert.strictEqual(success.response.ok, true);
assert.strictEqual(success.response.code, 'FISH');
assert.strictEqual(failure.err, null);
assert.strictEqual(failure.response.ok, false);
assert.strictEqual(failure.response.error, 'إجابة غير صحيحة');
console.log('PASS: browser WebSocket adapter preserves successful and failed acknowledgements');
