// services/soundMp3Service.ts

let audioCtx: AudioContext | null = null;
let currentBgmSource: AudioBufferSourceNode | null = null;
let currentBgmGain: GainNode | null = null;

// 新增：记录当前“原本应该”播放的 URL，用于解决异步冲突
let activeBgmUrl: string | null = null;

// 缓存已解码的音频 Buffer
const soundBufferCache: Map<string, AudioBuffer> = new Map();

// 1. 简单的兜底“嘟”声
const createFallbackBuffer = (ctx: AudioContext): AudioBuffer => {
    const sampleRate = ctx.sampleRate;
    const duration = 0.1;
    const frameCount = sampleRate * duration;
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate;
        data[i] = Math.sin(t * 440 * 2 * Math.PI) * (1 - t / duration);
    }
    return buffer;
};

export const initAudioContext = () => {
    if (!audioCtx) {
        const Win = window as any;
        const AudioContextClass = Win.AudioContext || Win.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch((e) => console.warn('Audio resume failed:', e));
    }
    return audioCtx;
};

export const loadSound = async (url: string): Promise<AudioBuffer | null> => {
    const ctx = initAudioContext();
    if (!ctx) return null;

    if (soundBufferCache.has(url)) {
        return soundBufferCache.get(url)!;
    }

    try {
        const response = await fetch(url);

        // 如果找不到文件，使用兜底音效
        if (!response.ok) {
            console.warn(`[Audio] 文件丢失: ${url} (Status: ${response.status}) - 使用默认音效。`);
            const fallback = createFallbackBuffer(ctx);
            soundBufferCache.set(url, fallback);
            return fallback;
        }

        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        soundBufferCache.set(url, decodedBuffer);
        return decodedBuffer;
    } catch (error) {
        console.warn(`[Audio] 加载异常: ${url} - 使用默认音效。`, error);
        const fallback = createFallbackBuffer(ctx);
        soundBufferCache.set(url, fallback);
        return fallback;
    }
};

export const preloadSounds = async (urls: string[]) => {
    return Promise.all(urls.map(url => loadSound(url)));
};

interface PlayOptions {
    volume?: number;
    loop?: boolean;
    pitchVariance?: number;
    pan?: number;
}

export const playSound = async (url: string, options: PlayOptions = {}) => {
    const ctx = initAudioContext();
    if (!ctx) return;

    let buffer = soundBufferCache.get(url);
    if (!buffer) {
        buffer = await loadSound(url);
    }
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop || false;

    if (options.pitchVariance) {
        const rate = 1.0 + (Math.random() * options.pitchVariance * 2 - options.pitchVariance);
        source.playbackRate.value = Math.max(0.1, rate);
    }

    const gainNode = ctx.createGain();
    const volume = options.volume !== undefined ? options.volume : 1.0;
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);

    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
};

// ==================== 修复后的背景音乐逻辑 ====================

/**
 * 内部函数：立即停止当前音乐（无淡出，用于强制切换）
 */
const stopInternal = () => {
    if (currentBgmSource) {
        try { currentBgmSource.stop(); } catch (e) { }
        currentBgmSource.disconnect();
        currentBgmSource = null;
    }
    if (currentBgmGain) {
        currentBgmGain.disconnect();
        currentBgmGain = null;
    }
};

export const stopBackgroundMusic = () => {
    const ctx = initAudioContext();
    if (currentBgmGain && ctx) {
        // 优雅淡出
        const gain = currentBgmGain; // 闭包引用
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

        setTimeout(() => {
            // 500ms 后再次检查：如果 gain 还是当前的 gain，说明没有新音乐覆盖它，可以断开
            // 如果已经被新音乐覆盖了，就不管了
            if (currentBgmGain === gain) {
                stopInternal();
            }
        }, 550);
    } else {
        stopInternal();
    }
    activeBgmUrl = null; // 清除当前目标
};

export const playBackgroundMusic = async (url: string, volume: number = 0.4) => {
    // 1. 立即标记：我们要播放的是这个 URL
    // 如果用户在这之后又点击了别的，activeBgmUrl 会变
    if (activeBgmUrl === url) return; // 如果已经是这个音乐，不做操作
    activeBgmUrl = url;

    const ctx = initAudioContext();
    if (!ctx) return;

    // 2. 加载音频 (这是异步的，耗时较长)
    // 注意：加载期间，旧音乐还在放，这是正常的
    let buffer = await loadSound(url);

    // 3. 关键检查：加载回来后，世界变了吗？
    // 如果 activeBgmUrl 已经不等于 url，说明在加载期间用户又切场景了
    if (activeBgmUrl !== url) {
        console.log(`[Audio] 放弃播放 ${url}，因为场景已切换到 ${activeBgmUrl}`);
        return;
    }

    if (!buffer) return;

    // 4. 只有确认要播放新音乐了，才强制干掉旧音乐
    stopInternal(); // 简单粗暴，直接切断旧的，防止重叠

    try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gainNode = ctx.createGain();
        gainNode.gain.value = 0; // 初始 0，准备淡入

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(0);

        // 5. 淡入效果
        gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.5);

        // 6. 更新全局引用
        currentBgmSource = source;
        currentBgmGain = gainNode;

    } catch (e) {
        console.error("Play BGM failed:", e);
    }
};