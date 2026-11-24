'use strict';
const assert = require('node:assert/strict');
const {createGameAudio, countdownCue} = require('../public/sound');
const seconds = [6,5,5,4,3,2,2,1,0];
assert.deepEqual(seconds.map((s,i)=>countdownCue(s,seconds[i-1])).filter(Boolean),
  ['tick','tock','tick','tock','tick']);
const starts = [], stops = [];
const param = {setValueAtTime(){}, exponentialRampToValueAtTime(){}};
const node = {connect(){}, disconnect(){}};
const context = {
  state:'suspended', currentTime:2, destination:{},
  async resume(){ this.state='running'; },
  async suspend(){ this.state='suspended'; },
  createGain(){ return {...node,gain:{...param}}; },
  createOscillator(){ return {...node,frequency:param,start:t=>starts.push(t),stop:t=>stops.push(t)}; }
};
const sound = createGameAudio(()=>context);
sound.play('tick');
assert.equal(starts.length,0);
sound.unlock();
for(const cue of ['pass','correct','wrong','pop','tick','tock','win']) sound.play(cue);
assert.equal(starts.length,14);
assert(stops.every((end,i)=>end>starts[i] && end-starts[i]<.5));
sound.mute();
sound.play('wrong');
assert.equal(starts.length,14);
console.log('PASS: game audio cues, mute, and countdown deduplication');
