// Seconds, start/end frequency in Hz, duration, peak gain and waveform.
const cues = {
  pass: [[0, 364, 420, .09, .12, 'triangle'], [.09, 550, 620, .13, .10, 'sine']],
  correct: [[0, 523, 523, .10, .11, 'sine'], [.08, 784, 784, .16, .10, 'sine']],
  wrong: [[0, 233, 185, .09, .10, 'triangle'], [.095, 175, 147, .12, .09, 'triangle']],
  tick: [[0, 1180, 670, .035, .075, 'triangle']],
  tock: [[0, 800, 440, .045, .08, 'triangle']],
  pop: [[0, 145, 42, .40, .24, 'sine'], [0, 410, 77, .14, .12, 'triangle']],
  win: [[0, 392, 392, .13, .10, 'triangle'], [.12, 494, 494, .14, .11, 'triangle'], [.24, 587, 587, .14, .11, 'triangle'], [.37, 784, 784, .34, .12, 'sine']]
};

function createGameAudio(createContext) {
  let context, bus;
  function unlock() {
    try {
      if (!context) {
        context = createContext();
        bus = context.createGain();
        bus.gain.value = .55;
        bus.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* The game also works on devices without Web Audio. */ }
  }
  function play(kind) {
    if (context?.state !== 'running' || !bus) return;
    for (const [delay, from, to, length, peak, wave] of cues[kind]) {
      const start = context.currentTime + delay;
      const osc = context.createOscillator(), envelope = context.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(to, start + length);
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.exponentialRampToValueAtTime(peak, start + .006);
      envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
      osc.connect(envelope);
      envelope.connect(bus);
      osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
      osc.start(start);
      osc.stop(start + length + .01);
    }
  }
  function mute() { if (context?.state === 'running') context.suspend().catch(() => {}); }
  return {unlock, play, mute};
}

function countdownCue(seconds, previous) {
  return seconds >= 1 && seconds <= 5 && seconds !== previous ? (seconds % 2 ? 'tick' : 'tock') : null;
}
if (typeof module !== 'undefined') module.exports = {createGameAudio, countdownCue};
