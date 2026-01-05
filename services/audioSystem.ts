// audioSystem.ts
import { Biome } from '../types';
import * as SoundService from './soundMp3Service';

const BASE_URL = '/rockrock/assets/sounds/';
const getPath = (filename: string) => `${BASE_URL}${filename}`;
// ==================== 背景音配置 ====================
// 确保 public/assets/sounds/ambient/ 下有这些文件
const AMBIENCE_ASSETS: Record<string, string> = {
    [Biome.BEACH]: getPath('ambient/amb_beach_waves.mp3'),
    [Biome.MOUNTAIN]: getPath('ambient/amb_mountain_wind.mp3'),
    [Biome.FISHTANK]: getPath('ambient/amb_underwater_hum.mp3'),
    [Biome.DESERT]: getPath('ambient/amb_desert_wind.mp3'),
    [Biome.RAINFOREST]: getPath('ambient/amb_jungle_crickets.mp3'),
    [Biome.TUNDRA]: getPath('ambient/amb_ice_wind.mp3'),
    [Biome.HOT_SPRING]: getPath('ambient/amb_steam_hiss.mp3'),
    [Biome.VOLCANO]: getPath('ambient/amb_magma_rumble.mp3'),
    [Biome.THEME_PARK]: getPath('ambient/amb_theme_park.mp3'),
    [Biome.OLD_HOUSE]: getPath('ambient/amb_creaky_room.mp3'),
    [Biome.SEWER]: getPath('ambient/amb_water_drip_echo.mp3'),
    [Biome.TEMPLE]: getPath('ambient/amb_temple_bell_wind.mp3'),
};

// ==================== 资源配置表 ====================
// TODO: 请确保 public/assets/sounds/ 目录下有对应的文件
const SOUND_ASSETS = {
    UI: {
        VOID_HUM: getPath('ui_void_hum.mp3'), // 虚无时的背景音√
    },
    IMPACT: {
        COLLISION: getPath('impact_heavy.mp3'), // 玩家/相机碰撞√
        GENERIC: getPath('impact_soft.mp3'),    // 默认软碰撞√
    },
    MATERIAL: {
        GLASS: getPath('mat_glass_hit.mp3'),   // 玻璃/晶体√
        STONE: getPath('mat_stone_hit.mp3'),   // 岩石/石头√
        WOOD: getPath('mat_wood_hit.mp3'),     // 木头√
        METAL: getPath('mat_metal_hit.mp3'),   // 金属√
        WATER: getPath('mat_water_pop.mp3'),   // 水/气泡√
        FLESH: getPath('mat_flesh_squish.mp3'),// 生物/肉体√
        PLASTIC: getPath('mat_plastic_rattle.mp3'), // 塑料√
        DIRT: getPath('mat_dirt_thud.mp3'),    // 泥土/沙子√
        CHIME: getPath('mat_chime_ring.mp3'),  // 铃铛√
        ICE: getPath('mat_ice_crack.mp3'),     // 冰√
        MAGMA: getPath('mat_magma_sizzle.mp3'),// 岩浆√
    }
};
/**
 * 根据生物群系播放背景音
 */
export const playBiomeAmbience = (biome: Biome) => {
    const url = AMBIENCE_ASSETS[biome];
    if (url) {
        // 音量可根据场景微调，比如火山声音比较大，可以给小一点
        SoundService.playBackgroundMusic(url, 0.3);
    } else {
        SoundService.stopBackgroundMusic();
    }
};
/**
 * 暴露初始化接口 (用于在 App 中用户点击时唤醒 AudioContext)
 */
export const initAudioSystem = () => {
    SoundService.initAudioContext();
};
// ==================== 辅助函数 ====================

/**
 * 预加载所有关键音效
 * 在游戏启动或进入关卡时调用
 */
export const preloadAudio = () => {
    const allSounds = [
        ...Object.values(SOUND_ASSETS.UI),
        ...Object.values(SOUND_ASSETS.IMPACT),
        ...Object.values(SOUND_ASSETS.MATERIAL),
    ];
    SoundService.preloadSounds(allSounds);
    SoundService.preloadSounds(Object.values(AMBIENCE_ASSETS));
    // 初始化 Context
    SoundService.initAudioContext();
};

// ==================== 业务接口 ====================

/**
 * 播放碰撞音效 (玩家自身撞击)
 */
export const playCollisionSound = () => {
    SoundService.playSound(SOUND_ASSETS.IMPACT.COLLISION, {
        volume: 0.6,
        pitchVariance: 0.1 // 允许10%的音高浮动
    });
};

/**
 * 播放交互音效 - 基于物体材质
 * @param type 物体类型字符串 (如 'frozen_rock', 'iron_pipe')
 * @param distance 距离 (米)
 * @param biome 当前生物群系 (备用)
 */
export const playInteractionSound = (type: string, distance: number, biome: Biome) => {
    // 1. 计算音量衰减
    // 距离衰减：1米内全音量，4米外10%音量
    const distanceVolume = Math.max(0.1, 1 - (distance / 4));
    const baseVolume = distanceVolume * 0.8; // 稍微降低整体增益

    // 2. 处理虚无
    if (type === 'void') {
        // 虚无音效通常比较轻灵，不需要随机音高
        SoundService.playSound(SOUND_ASSETS.UI.VOID_HUM, { volume: baseVolume * 0.5 });
        return;
    }

    const typeLower = type.toLowerCase();
    let soundUrl = SOUND_ASSETS.IMPACT.GENERIC;
    let pitchVar = 0.1; // 默认随机音高范围

    // ============ 材质匹配逻辑 ============

    // 贝壳/玻璃/晶体类
    if (typeLower.includes('shell') || typeLower.includes('glass') || typeLower.includes('crystal') ||
        typeLower.includes('obsidian') || typeLower.includes('bottle')) {
        soundUrl = SOUND_ASSETS.MATERIAL.GLASS;
        pitchVar = 0.15; // 玻璃声音可以更清脆多变
    }

    // 岩石/石头类
    else if (typeLower.includes('rock') || typeLower.includes('stone') || typeLower.includes('reef') ||
        typeLower.includes('gravel') || typeLower.includes('slate') || typeLower.includes('basalt') ||
        typeLower.includes('pebble') || typeLower.includes('frozen_rock')) {
        soundUrl = SOUND_ASSETS.MATERIAL.STONE;
    }

    // 木质类
    else if (typeLower.includes('wood') || typeLower.includes('log') || typeLower.includes('root') ||
        typeLower.includes('pine') || typeLower.includes('drift') || typeLower.includes('floorboard')) {
        soundUrl = SOUND_ASSETS.MATERIAL.WOOD;
    }

    // 金属类
    else if (typeLower.includes('metal') || typeLower.includes('iron') || typeLower.includes('steel') ||
        typeLower.includes('pipe') || typeLower.includes('rail') || typeLower.includes('pole') ||
        typeLower.includes('booth') || typeLower.includes('carousel') || typeLower.includes('filter')) {
        soundUrl = SOUND_ASSETS.MATERIAL.METAL;
        pitchVar = 0.05; // 金属共振频率比较固定，变化少一点
    }

    // 气泡/水/温泉
    else if (typeLower.includes('bubble') || typeLower.includes('water') || typeLower.includes('fish') ||
        typeLower.includes('spring') || typeLower.includes('steam') || typeLower.includes('fissure') ||
        typeLower.includes('hot')) {
        soundUrl = SOUND_ASSETS.MATERIAL.WATER;
        pitchVar = 0.2; // 水声变化很大
    }

    // 生物类/柔软
    else if (typeLower.includes('rat') || typeLower.includes('penguin') || typeLower.includes('cat') ||
        typeLower.includes('monk') || typeLower.includes('goldfish')) {
        soundUrl = SOUND_ASSETS.MATERIAL.FLESH;
    }

    // 塑料/合成材料/垃圾
    else if (typeLower.includes('plastic') || typeLower.includes('toy') || typeLower.includes('bag') ||
        typeLower.includes('trash') || typeLower.includes('ticket') || typeLower.includes('part')) {
        soundUrl = SOUND_ASSETS.MATERIAL.PLASTIC;
    }

    // 沙/土/泥
    else if (typeLower.includes('sand') || typeLower.includes('dune') || typeLower.includes('mound') ||
        typeLower.includes('sludge') || typeLower.includes('puddle') || typeLower.includes('mud')) {
        soundUrl = SOUND_ASSETS.MATERIAL.DIRT;
    }

    // 风铃/铃铛
    else if (typeLower.includes('chime') || typeLower.includes('bell') || typeLower.includes('wind_chime')) {
        soundUrl = SOUND_ASSETS.MATERIAL.CHIME;
        pitchVar = 0.02; // 乐器类保持音准
    }

    // 冰类 (如果没有专门的冰音效，可以混用玻璃或石头，这里假设有)
    else if (typeLower.includes('ice') || typeLower.includes('frozen') || typeLower.includes('glacial')) {
        soundUrl = SOUND_ASSETS.MATERIAL.ICE;
    }

    // 火山/岩浆
    else if (typeLower.includes('magma') || typeLower.includes('volcano') || typeLower.includes('lava')) {
        soundUrl = SOUND_ASSETS.MATERIAL.MAGMA;
    }

    // 废墟/骨头 (归类为石头或特殊的)
    else if (typeLower.includes('ruin') || typeLower.includes('ancient') || typeLower.includes('skull') ||
        typeLower.includes('bone')) {
        soundUrl = SOUND_ASSETS.MATERIAL.STONE; // 暂时用石头代替，也可以加 BONE
    }

    // 植物/苔藓
    else if (typeLower.includes('moss') || typeLower.includes('mushroom') || typeLower.includes('fern') ||
        typeLower.includes('weed') || typeLower.includes('vine') || typeLower.includes('leaves')) {
        soundUrl = SOUND_ASSETS.MATERIAL.DIRT; // 或者用比较闷的的声音
    }

    // 3. 执行播放
    SoundService.playSound(soundUrl, {
        volume: baseVolume,
        pitchVariance: pitchVar
    });
};