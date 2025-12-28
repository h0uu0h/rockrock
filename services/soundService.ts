import { Biome } from '../types';

let audioCtx: any = null;
let noiseBuffer: any = null;

const initAudio = () => {
  if (!audioCtx) {
    const Win = window as any;
    const AudioContextClass = Win.AudioContext || Win.webkitAudioContext;
    if (AudioContextClass) {
        audioCtx = new AudioContextClass();
        // Create a 1-second white noise buffer for texture synthesis
        const bufferSize = audioCtx.sampleRate;
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// Helper to create a noise node
const createNoiseNode = (ctx: any) => {
  const node = ctx.createBufferSource();
  node.buffer = noiseBuffer;
  node.loop = true;
  return node;
};

export const playCollisionSound = () => {
    const ctx = initAudio();
    if (!ctx) return;
  
    const t = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    
    // Sharp percussive "clack" (High frequency impact)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.08);
    
    oscGain.gain.setValueAtTime(0.15, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    
    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  
    // Low thud (Body of the stone hitting)
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(150, t);
    thudOsc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  
    thudGain.gain.setValueAtTime(0.4, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  
    thudOsc.connect(thudGain);
    thudGain.connect(masterGain);
    thudOsc.start(t);
    thudOsc.stop(t + 0.2);

    // Short scratch/noise
    playNoiseBurst(ctx, masterGain, t, 1000, 0.05);
};

export const playInteractionSound = (type: string, distance: number, biome: Biome) => {
  const ctx = initAudio();
  if (!ctx) return;

  const t = ctx.currentTime;
  const volume = Math.max(0.1, 1 - (distance / 4)); // Attenuate by distance
  
  // Master Gain for this event
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.setValueAtTime(volume, t);

  // 1. Always play a "Sonar Ping" (The Stone's sense)
  const pingOsc = ctx.createOscillator();
  const pingGain = ctx.createGain();
  pingOsc.type = 'sine';
  pingOsc.frequency.setValueAtTime(800, t);
  pingOsc.frequency.exponentialRampToValueAtTime(400, t + 0.1);
  
  pingGain.gain.setValueAtTime(0.1, t);
  pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  
  pingOsc.connect(pingGain);
  pingGain.connect(masterGain);
  pingOsc.start(t);
  pingOsc.stop(t + 0.15);

  // 2. Material Response
  if (type === 'void') {
    return; 
  }

  // Generalized sound mapping
  if (['shell', 'glass', 'pebble', 'ice', 'obsidian', 'tile', 'bottle'].some(t => type.includes(t))) {
      playHardClick(ctx, masterGain, t, 1200);
  } 
  else if (['rock', 'stone', 'castle', 'gravel', 'statue', 'steps', 'lantern', 'ruin', 'slate'].some(t => type.includes(t))) {
      playHardClick(ctx, masterGain, t, 400); 
      playNoiseBurst(ctx, masterGain, t, 300, 0.1); 
  }
  else if (['driftwood', 'wood', 'log', 'chest', 'bench', 'door', 'root'].some(t => type.includes(t))) {
      playWoodThud(ctx, masterGain, t);
  }
  else if (['rail', 'pipe', 'coin', 'pole', 'burner'].some(t => type.includes(t))) {
      playMetalClang(ctx, masterGain, t);
  }
  else if (['chime', 'bell'].some(t => type.includes(t))) {
      playChimeSound(ctx, masterGain, t);
  }
  else if (['bubble', 'vent', 'steam', 'goldfish'].some(t => type.includes(t))) {
      playBubblePop(ctx, masterGain, t);
  }
  else if (['plastic', 'bag', 'flag'].some(t => type.includes(t))) {
      playRustle(ctx, masterGain, t); // Crinkle
  }
  else if (['rat', 'penguin', 'cat', 'monk'].some(t => type.includes(t))) {
      // Soft organic
      playSoftThud(ctx, masterGain, t);
      // Maybe a little squeak for rat/penguin?
      if (type.includes('rat') || type.includes('penguin')) {
         playSqueak(ctx, masterGain, t);
      }
  }
  else {
      // Default soft/organic (fern, moss, vine, etc.)
      playSoftThud(ctx, masterGain, t);
  }
};

// -- Sound Generators --

const playMetalClang = (ctx: any, output: any, time: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Inharmonic frequencies for metallic sound
    osc.type = 'square';
    osc.frequency.setValueAtTime(500, time);
    osc.frequency.exponentialRampToValueAtTime(480, time + 0.3);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 5;

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    osc.start(time);
    osc.stop(time + 0.6);
};

const playChimeSound = (ctx: any, output: any, time: number) => {
    // Multiple high sine waves
    [2000, 2400, 3100].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5 + i * 0.5);
        osc.connect(gain);
        gain.connect(output);
        osc.start(time);
        osc.stop(time + 2.0);
    });
};

const playHardClick = (ctx: any, output: any, time: number, freq: number) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.05);

  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

  osc.connect(gain);
  gain.connect(output);
  osc.start(time);
  osc.stop(time + 0.1);
};

const playWoodThud = (ctx: any, output: any, time: number) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  // Square gives a "hollow" quality
  osc.type = 'square';
  osc.frequency.setValueAtTime(200, time);
  osc.frequency.exponentialRampToValueAtTime(100, time + 0.1);

  // Lowpass to muffle it
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;

  gain.gain.setValueAtTime(0.4, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  osc.start(time);
  osc.stop(time + 0.2);
};

const playSoftThud = (ctx: any, output: any, time: number) => {
  const noise = createNoiseNode(ctx);
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, time);
  filter.frequency.linearRampToValueAtTime(100, time + 0.2);

  gain.gain.setValueAtTime(0.5, time);
  gain.gain.linearRampToValueAtTime(0.001, time + 0.2);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  noise.start(time);
  noise.stop(time + 0.25);
};

const playRustle = (ctx: any, output: any, time: number) => {
    playNoiseBurst(ctx, output, time, 2000, 0.15);
};

const playSqueak = (ctx: any, output: any, time: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1500, time);
    osc.frequency.linearRampToValueAtTime(2000, time + 0.1);
    
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.linearRampToValueAtTime(0.001, time + 0.15);
    
    osc.connect(gain);
    gain.connect(output);
    osc.start(time);
    osc.stop(time + 0.2);
};

const playNoiseBurst = (ctx: any, output: any, time: number, cutoff: number, duration: number) => {
  const noise = createNoiseNode(ctx);
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = 'bandpass';
  filter.frequency.value = cutoff;
  filter.Q.value = 1;

  gain.gain.setValueAtTime(0.2, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  noise.start(time);
  noise.stop(time + duration + 0.1);
};

const playBubblePop = (ctx: any, output: any, time: number) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, time);
  osc.frequency.exponentialRampToValueAtTime(900, time + 0.1);

  gain.gain.setValueAtTime(0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

  osc.connect(gain);
  gain.connect(output);
  osc.start(time);
  osc.stop(time + 0.15);
};