import { Biome } from '../types';

let audioCtx: any = null;
let noiseBuffer: any = null;

// ==================== 音频系统初始化 ====================
const initAudio = () => {
  if (!audioCtx) {
    const Win = window as any;
    const AudioContextClass = Win.AudioContext || Win.webkitAudioContext;
    if (AudioContextClass) {
      try {
        audioCtx = new AudioContextClass();
        // 创建白噪声缓冲区
        const bufferSize = audioCtx.sampleRate * 1;
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      } catch (error) {
        console.error('音频上下文创建失败:', error);
      }
    }
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// 创建噪音节点
const createNoiseNode = (ctx: any) => {
  const node = ctx.createBufferSource();
  node.buffer = noiseBuffer;
  node.loop = true;
  return node;
};

// ==================== 公开音效函数 ====================

/**
 * 播放碰撞音效
 */
export const playCollisionSound = () => {
  const ctx = initAudio();
  if (!ctx) return;

  const t = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  // 1. 高频撞击声
  const impactOsc = ctx.createOscillator();
  const impactGain = ctx.createGain();
  impactOsc.type = 'square';
  impactOsc.frequency.setValueAtTime(1000, t);
  impactOsc.frequency.exponentialRampToValueAtTime(180, t + 0.08);

  impactGain.gain.setValueAtTime(0.4, t);
  impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

  impactOsc.connect(impactGain);
  impactGain.connect(masterGain);
  impactOsc.start(t);
  impactOsc.stop(t + 0.12);

  // 2. 低频共鸣声
  const resonanceOsc = ctx.createOscillator();
  const resonanceGain = ctx.createGain();
  resonanceOsc.type = 'sine';
  resonanceOsc.frequency.setValueAtTime(160, t);
  resonanceOsc.frequency.exponentialRampToValueAtTime(50, t + 0.25);

  resonanceGain.gain.setValueAtTime(0.25, t);
  resonanceGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

  resonanceOsc.connect(resonanceGain);
  resonanceGain.connect(masterGain);
  resonanceOsc.start(t);
  resonanceOsc.stop(t + 0.3);

  // 3. 碎石声
  playNoiseBurst(ctx, masterGain, t + 0.01, 700, 0.06, 0.2);
};

/**
 * 播放交互音效 - 只有物体材质声音，无声纳
 */
export const playInteractionSound = (type: string, distance: number, biome: Biome) => {
  const ctx = initAudio();
  if (!ctx) return;

  const t = ctx.currentTime;

  // 距离衰减：1米内全音量，4米外10%音量
  const distanceVolume = Math.max(0.1, 1 - (distance / 4));
  const volume = distanceVolume * 0.9;

  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.setValueAtTime(volume, t);

  // ============ 直接播放物体材质响应 ============
  if (type === 'void') {
    // 虚无：播放轻微的环境音
    playVoidSound(ctx, masterGain, t, volume * 0.5);
    return;
  }

  const typeLower = type.toLowerCase();

  // 贝壳/玻璃/晶体类
  if (typeLower.includes('shell') || typeLower.includes('glass') || typeLower.includes('crystal') ||
    typeLower.includes('obsidian') || typeLower.includes('bottle')) {
    playHardClick(ctx, masterGain, t, 1400, volume * 0.8);
  }

  // 岩石/石头类
  else if (typeLower.includes('rock') || typeLower.includes('stone') || typeLower.includes('reef') ||
    typeLower.includes('gravel') || typeLower.includes('slate') || typeLower.includes('basalt') ||
    typeLower.includes('pebble') || typeLower.includes('frozen_rock')) {
    playHardClick(ctx, masterGain, t, 500, volume * 0.7);
    playNoiseBurst(ctx, masterGain, t + 0.02, 300, 0.1, volume * 0.5);
  }

  // 木质类
  else if (typeLower.includes('wood') || typeLower.includes('log') || typeLower.includes('root') ||
    typeLower.includes('pine') || typeLower.includes('drift') || typeLower.includes('floorboard')) {
    playWoodThud(ctx, masterGain, t, volume * 0.9);
  }

  // 金属类
  else if (typeLower.includes('metal') || typeLower.includes('iron') || typeLower.includes('steel') ||
    typeLower.includes('pipe') || typeLower.includes('rail') || typeLower.includes('pole') ||
    typeLower.includes('booth') || typeLower.includes('carousel') || typeLower.includes('filter')) {
    playMetalClang(ctx, masterGain, t, volume * 0.8);
  }

  // 气泡/水相关
  else if (typeLower.includes('bubble') || typeLower.includes('water') || typeLower.includes('fish') ||
    typeLower.includes('weed') || typeLower.includes('spring') || typeLower.includes('steam') ||
    typeLower.includes('fissure') || typeLower.includes('hot')) {
    playBubblePop(ctx, masterGain, t, volume);
    if (typeLower.includes('bubble') || typeLower.includes('filter')) {
      playNoiseBurst(ctx, masterGain, t + 0.05, 1000, 0.08, volume * 0.4);
    }
  }

  // 生物类
  else if (typeLower.includes('rat') || typeLower.includes('penguin') || typeLower.includes('cat') ||
    typeLower.includes('monk') || typeLower.includes('goldfish')) {
    playSoftThud(ctx, masterGain, t, volume * 0.7);
    if (typeLower.includes('rat') || typeLower.includes('penguin')) {
      playSqueak(ctx, masterGain, t + 0.05, volume * 0.6);
    }
  }

  // 塑料/合成材料
  else if (typeLower.includes('plastic') || typeLower.includes('toy') || typeLower.includes('bag') ||
    typeLower.includes('trash') || typeLower.includes('ticket') || typeLower.includes('part')) {
    playRustle(ctx, masterGain, t, volume * 0.9);
  }

  // 沙/土/泥
  else if (typeLower.includes('sand') || typeLower.includes('dune') || typeLower.includes('mound') ||
    typeLower.includes('sludge') || typeLower.includes('puddle') || typeLower.includes('mud')) {
    playNoiseBurst(ctx, masterGain, t, 250, 0.18, volume * 0.8);
  }

  // 风铃/铃铛
  else if (typeLower.includes('chime') || typeLower.includes('bell') || typeLower.includes('wind_chime')) {
    playChimeSound(ctx, masterGain, t, volume);
  }

  // 苔藓/蘑菇/植物
  else if (typeLower.includes('moss') || typeLower.includes('mushroom') || typeLower.includes('fern') ||
    typeLower.includes('weed') || typeLower.includes('seaweed') || typeLower.includes('vine') ||
    typeLower.includes('tangle') || typeLower.includes('leaves') || typeLower.includes('pile') ||
    typeLower.includes('cactus')) {
    playSoftThud(ctx, masterGain, t, volume * 0.6);
    playNoiseBurst(ctx, masterGain, t + 0.02, 600, 0.12, volume * 0.5);
  }

  // 冰类
  else if (typeLower.includes('ice') || typeLower.includes('frozen') || typeLower.includes('glacial') ||
    typeLower.includes('tundra') || typeLower.includes('pillar') || typeLower.includes('hole')) {
    playHardClick(ctx, masterGain, t, 1600, volume * 0.7);
    playNoiseBurst(ctx, masterGain, t + 0.03, 1800, 0.08, volume * 0.4);
  }

  // 火山/岩浆
  else if (typeLower.includes('magma') || typeLower.includes('volcano') || typeLower.includes('lava') ||
    typeLower.includes('gas') || typeLower.includes('sulfur')) {
    playNoiseBurst(ctx, masterGain, t, 120, 0.3, volume * 0.7);
  }

  // 废墟/古老建筑
  else if (typeLower.includes('ruin') || typeLower.includes('ancient') || typeLower.includes('castle') ||
    typeLower.includes('statue') || typeLower.includes('step') || typeLower.includes('rubble')) {
    playHardClick(ctx, masterGain, t, 350, volume * 0.8);
    playNoiseBurst(ctx, masterGain, t + 0.05, 200, 0.15, volume * 0.4);
  }

  // 头骨/骨骼
  else if (typeLower.includes('skull') || typeLower.includes('bone') || typeLower.includes('skeleton')) {
    playHardClick(ctx, masterGain, t, 700, volume * 0.7);
    playNoiseBurst(ctx, masterGain, t + 0.03, 500, 0.1, volume * 0.5);
  }

  // 默认（柔软的有机材料）
  else {
    playSoftThud(ctx, masterGain, t, volume * 0.6);
  }
};

/**
 * 播放虚无音效（当没有物体可感知时）
 */
const playVoidSound = (ctx: any, output: any, time: number, volume: number = 1.0) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, time);
  osc.frequency.exponentialRampToValueAtTime(180, time + 0.3);

  gain.gain.setValueAtTime(0.2 * volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

  osc.connect(gain);
  gain.connect(output);
  osc.start(time);
  osc.stop(time + 0.35);
};

// ==================== 音效生成器函数 ====================

const playMetalClang = (ctx: any, output: any, time: number, volume: number = 1.0) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(450, time);
  osc.frequency.exponentialRampToValueAtTime(420, time + 0.3);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 6;

  gain.gain.setValueAtTime(0.4 * volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  osc.start(time);
  osc.stop(time + 0.4);
};

const playChimeSound = (ctx: any, output: any, time: number, volume: number = 1.0) => {
  const frequencies = [1046.5, 1318.5, 1568];
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.1 * volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5 + i * 0.2);
    osc.connect(gain);
    gain.connect(output);
    osc.start(time);
    osc.stop(time + 1.7);
  });
};

const playHardClick = (ctx: any, output: any, time: number, freq: number, volume: number = 1.0) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, time + 0.05);

  gain.gain.setValueAtTime(0.3 * volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

  osc.connect(gain);
  gain.connect(output);
  osc.start(time);
  osc.stop(time + 0.08);
};

const playWoodThud = (ctx: any, output: any, time: number, volume: number = 1.0) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(180, time);
  osc.frequency.exponentialRampToValueAtTime(90, time + 0.1);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 350;

  gain.gain.setValueAtTime(0.5 * volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  osc.start(time);
  osc.stop(time + 0.15);
};

const playSoftThud = (ctx: any, output: any, time: number, volume: number = 1.0) => {
  const noise = createNoiseNode(ctx);
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(280, time);
  filter.frequency.linearRampToValueAtTime(100, time + 0.2);

  gain.gain.setValueAtTime(0.7 * volume, time);
  gain.gain.linearRampToValueAtTime(0.001, time + 0.2);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  noise.start(time);
  noise.stop(time + 0.22);
};

const playRustle = (ctx: any, output: any, time: number, volume: number = 1.0) => {
  playNoiseBurst(ctx, output, time, 1800, 0.15, volume * 0.8);
};

const playSqueak = (ctx: any, output: any, time: number, volume: number = 1.0) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1600, time);
  osc.frequency.linearRampToValueAtTime(2200, time + 0.06);

  gain.gain.setValueAtTime(0.2 * volume, time);
  gain.gain.linearRampToValueAtTime(0.001, time + 0.08);

  osc.connect(gain);
  gain.connect(output);
  osc.start(time);
  osc.stop(time + 0.1);
};

const playNoiseBurst = (ctx: any, output: any, time: number, cutoff: number, duration: number, volume: number = 1.0) => {
  const noise = createNoiseNode(ctx);
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = 'bandpass';
  filter.frequency.value = cutoff;
  filter.Q.value = 1.2;

  gain.gain.setValueAtTime(0.3 * volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  noise.start(time);
  noise.stop(time + duration + 0.05);
};

const playBubblePop = (ctx: any, output: any, time: number, volume: number = 1.0) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(350, time);
  osc.frequency.exponentialRampToValueAtTime(850, time + 0.06);

  gain.gain.setValueAtTime(0.6 * volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

  osc.connect(gain);
  gain.connect(output);
  osc.start(time);
  osc.stop(time + 0.1);
};

/**
 * 预加载音频系统
 */
export const preloadAudio = () => {
  const ctx = initAudio();
  if (ctx) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.001);
  }
};