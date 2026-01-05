import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { Stone } from "./components/Stone";
import { World } from "./components/World";
import { Overlay } from "./components/Overlay";
import { Gallery } from "./components/Gallery";
import { CardPullOverlay } from "./components/CardPullOverlay";
import { Biome, WorldObject, InteractionLog, Card, Rarity } from "./types";
import { generateSensoryFeedback } from "./services/deepseekService";
// import { playInteractionSound } from "./services/soundService";
import { playInteractionSound, playBiomeAmbience, preloadAudio, initAudioSystem } from "./services/audioSystem";
import { EffectComposer, Noise, Vignette, Pixelation } from "@react-three/postprocessing";
// import { useEyeController } from "./components/EyeController";
const ObjectTranslations: Record<string, string> = {
    // 海边
    shell: "贝壳",
    seaweed: "海藻",
    reef_rock: "礁石",
    drift_bottle: "漂流瓶",
    // 山谷
    pine_root: "松树根",
    leaves_pile: "落叶堆",
    stream_bed_rock: "河床石",
    pine_cone: "松果",
    // 鱼缸
    goldfish: "金鱼",
    water_weed: "水草",
    filter_bubbles: "气泡",
    gravel_mound: "碎石堆",
    // 沙漠
    cactus: "仙人掌",
    dune_edge: "沙丘脊",
    ancient_ruin: "古遗迹",
    dry_skull: "枯骨",
    // 雨林
    glowing_mushroom: "发光蘑菇",
    rotten_log: "腐朽圆木",
    vine_tangle: "缠绕藤蔓",
    mossy_stone: "青苔石",
    // 冰川
    ice_pillar: "冰柱",
    ice_hole: "冰窟窿",
    penguin: "企鹅",
    frozen_rock: "冻土石",
    // 温泉
    spring_vent: "温泉眼",
    steam_fissure: "地热裂缝",
    slate_floor: "青石板",
    sulfur_rock: "硫磺石",
    // 火山
    magma_crack: "岩浆裂缝",
    gas_vent: "喷气孔",
    obsidian_shard: "黑曜石片",
    basalt_rock: "玄武岩",
    // 乐园
    carousel_pole: "木马立柱",
    rusted_rail: "生锈铁轨",
    plastic_toy_part: "塑料玩具碎片",
    ticket_booth_rubble: "售票亭废墟",
    // 老宅
    wind_chime: "风铃",
    paper_lantern: "纸灯笼",
    old_cat_sleeping: "沉睡的老猫",
    wooden_floorboard: "旧木地板",
    // 下水道
    trash_bag: "垃圾袋",
    scared_rat: "受惊的老鼠",
    rusty_pipe: "锈蚀水管",
    sludge_puddle: "污泥坑",
    // 古寺
    stone_step: "石阶",
    prayer_flag: "经幡",
    meditating_monk: "打坐的僧人",
    incense_burner: "香炉",
    // 虚无
    void: "虚无",
};
const ColorTag = "color" as any;
const FogTag = "fog" as any;
const AmbientLight = "ambientLight" as any;
const DirectionalLight = "directionalLight" as any;

const generateBiomeObjects = (biome: Biome, count: number = 60): WorldObject[] => {
    const objects: WorldObject[] = [];
    const types: Record<Biome, string[]> = {
        [Biome.BEACH]: ["shell", "seaweed", "reef_rock", "drift_bottle"],
        [Biome.MOUNTAIN]: ["pine_root", "leaves_pile", "stream_bed_rock", "pine_cone"],
        [Biome.FISHTANK]: ["goldfish", "water_weed", "filter_bubbles", "gravel_mound"],
        [Biome.DESERT]: ["cactus", "dune_edge", "ancient_ruin", "dry_skull"],
        [Biome.RAINFOREST]: ["glowing_mushroom", "rotten_log", "vine_tangle", "mossy_stone"],
        [Biome.TUNDRA]: ["ice_pillar", "ice_hole", "penguin", "frozen_rock"],
        [Biome.HOT_SPRING]: ["spring_vent", "steam_fissure", "slate_floor", "sulfur_rock"],
        [Biome.VOLCANO]: ["magma_crack", "gas_vent", "obsidian_shard", "basalt_rock"],
        [Biome.THEME_PARK]: ["carousel_pole", "rusted_rail", "plastic_toy_part", "ticket_booth_rubble"],
        [Biome.OLD_HOUSE]: ["wind_chime", "paper_lantern", "old_cat_sleeping", "wooden_floorboard"],
        [Biome.SEWER]: ["trash_bag", "scared_rat", "rusty_pipe", "sludge_puddle"],
        [Biome.TEMPLE]: ["stone_step", "prayer_flag", "meditating_monk", "incense_burner"],
    };

    const colors: Record<Biome, string[]> = {
        [Biome.BEACH]: ["#e3d8c4", "#c9b29b", "#f0f0f0", "#d88c74"],
        [Biome.MOUNTAIN]: ["#596358", "#4a4a4a", "#2e3b2b", "#6b5b45"],
        [Biome.FISHTANK]: ["#ff7f50", "#40e0d0", "#ff69b4", "#ffd700"],
        [Biome.DESERT]: ["#c2b280", "#a4915c", "#8b4513", "#e0dcd3"],
        [Biome.RAINFOREST]: ["#006400", "#228b22", "#8b4513", "#ff0000"],
        [Biome.TUNDRA]: ["#a5f2f3", "#e0ffff", "#778899", "#f0ffff"],
        [Biome.HOT_SPRING]: ["#708090", "#778899", "#d3d3d3", "#8b4513"],
        [Biome.VOLCANO]: ["#2f2f2f", "#8b0000", "#ff4500", "#696969"],
        [Biome.THEME_PARK]: ["#ff69b4", "#00ced1", "#ffd700", "#708090"],
        [Biome.OLD_HOUSE]: ["#8b4513", "#d2b48c", "#a0522d", "#fff8dc"],
        [Biome.SEWER]: ["#556b2f", "#2f4f4f", "#808000", "#696969"],
        [Biome.TEMPLE]: ["#696969", "#8b4513", "#d3d3d3", "#c0c0c0"],
    };

    const safeBiome = biome || Biome.BEACH;
    const currentTypes = types[safeBiome] || types[Biome.BEACH];
    const currentColors = colors[safeBiome] || colors[Biome.BEACH];

    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 80;
        const objType = currentTypes[Math.floor(Math.random() * currentTypes.length)];
        const color = currentColors[Math.floor(Math.random() * currentColors.length)];
        objects.push({
            id: `${safeBiome}-${i}`,
            type: objType,
            position: new Vector3(x, 0, z),
            scale: 0.4 + Math.random() * 0.8,
            rotation: [Math.random() * 0.2, Math.random() * Math.PI, Math.random() * 0.2],
            color: color,
        });
    }
    return objects;
};

export default function App() {
    const [biome, setBiome] = useState<Biome>(Biome.BEACH);
    const [year, setYear] = useState(2024);
    const [eyesClosed, setEyesClosed] = useState(false);
    const stonePosRef = useRef(new Vector3(0, 0.5, 0));
    const [logs, setLogs] = useState<InteractionLog[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [godMode, setGodMode] = useState(false);

    // Collection State
    const [collection, setCollection] = useState<Card[]>(() => {
        const saved = localStorage.getItem("lithos_collection");
        return saved ? JSON.parse(saved) : [];
    });
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [currentPulledCard, setCurrentPulledCard] = useState<Card | null>(null);

    // 初始化预加载
    useEffect(() => {
        preloadAudio();
    }, []);

    // 监听 Biome 变化，切换背景音
    useEffect(() => {
        // 只有当不是 GodMode (或者你自己定义的逻辑) 时才播放
        // 这里直接切换
        playBiomeAmbience(biome);
    }, [biome]);

    const eyeControllerConfig = useMemo(
        () => ({
            enabled: true,
            onEyesClosed: (duration: number) => {
                console.log(`眼睛闭合，持续时间: ${duration}s`);
                setEyesClosed(true);
                if (duration > 1.0) {
                    // 长时间闭眼逻辑
                }
            },
            onEyesOpened: () => {
                console.log("眼睛睁开");
                setEyesClosed(false);
            },
            onBlink: (blinkCount: number) => {
                // 注意：这里需要引用最新的 state (eyesClosed, isThinking, godMode)
                // 但由于我们在 useEffect 里是通过 event 触发 handleBlink 的，
                // 这里仅仅是打印日志，或者你需要用 ref 来获取最新状态
                console.log(`眨眼 ${blinkCount} 次`);
            },
        }),
        []
    ); // 👈 这里的空数组很重要
    /* 眨眼这块功能先屏蔽掉 */

    // 初始化眨眼控制器
    // const eyeController = useEyeController(eyeControllerConfig);
    // useEffect(() => {
    //     localStorage.setItem("lithos_collection", JSON.stringify(collection));
    // }, [collection]);

    const worldObjects = useMemo(() => {
        const seed = `${biome}-seed`; // 使用固定种子确保稳定
        return generateBiomeObjects(biome, 300); // 减少数量
    }, [biome]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (eyesClosed && !godMode) {
            interval = setInterval(() => {
                setYear((prev) => prev + 1);
            }, 100);
        }
        return () => clearInterval(interval);
    }, [eyesClosed, godMode]);

    const handleStoneMove = useCallback((pos: Vector3) => {
        if (stonePosRef.current && pos) {
            stonePosRef.current.set(pos.x, pos.y, pos.z);
        }
    }, []);

    const handleBlink = async () => {
        if (eyesClosed || isThinking || godMode) return;

        const currentPos = stonePosRef.current;
        if (!currentPos) return;

        let nearestObj: WorldObject | null = null;
        let minDist = Infinity;

        if (Array.isArray(worldObjects)) {
            worldObjects.forEach((obj) => {
                if (obj && obj.position) {
                    const dist = currentPos.distanceTo(obj.position);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestObj = obj;
                    }
                }
            });
        }

        const timestamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });

        if (nearestObj && minDist < 3.0) {
            const obj = nearestObj as WorldObject;
            const displayType = ObjectTranslations[obj.type] || obj.type;
            playInteractionSound(obj.type, minDist, biome);
            setIsThinking(true);

            const feedback = await generateSensoryFeedback(biome, displayType, minDist, Math.floor(year));

            const newLog: InteractionLog = {
                id: Date.now().toString(),
                year: Math.floor(year),
                text: feedback.description,
                sound: feedback.soundEffect,
                timestamp,
                objectName: displayType,
            };

            setLogs((prev) => [...prev, newLog]);

            // Create and Pull Card
            let rarity: Rarity = "COMMON";
            if (year > 10000) rarity = "ETERNAL";
            else if (minDist < 1.0 || Math.random() > 0.8) rarity = "RARE";

            const newCard: Card = {
                id: Date.now().toString(),
                objectType: displayType,
                biome: biome,
                year: Math.floor(year),
                description: feedback.description,
                sound: feedback.soundEffect,
                timestamp,
                rarity,
                color: obj.color,
            };

            setCollection((prev) => [...prev, newCard]);
            setCurrentPulledCard(newCard);
            setIsThinking(false);
        } else {
            playInteractionSound("void", 10, biome);
            setIsThinking(true);
            await new Promise((r) => setTimeout(r, 600));
            setLogs((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    year: Math.floor(year),
                    text: "周围只有冰冷的虚无，什么也没有。",
                    sound: "...",
                    timestamp,
                    objectName: "虚无",
                },
            ]);
            setIsThinking(false);
        }
    };

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            initAudioSystem();
            if (e.code === "Space" && !e.repeat && !godMode) {
                setEyesClosed(true);
            }

            if (e.code === "Enter" && !e.repeat) {
                handleBlink();
            }

            if (e.code === "KeyG" && !e.repeat) {
                setIsGalleryOpen((prev) => !prev);
            }
        },
        [godMode, handleBlink]
    );

    const handleKeyUp = useCallback(
        (e: KeyboardEvent) => {
            if (e.code === "Space" && !godMode) {
                setEyesClosed(false);
            }
        },
        [godMode]
    );
    /* 眨眼这块功能先屏蔽掉 */
    // useEffect(() => {
    //     if (eyeController.isConnected) {
    //         window.removeEventListener("keydown", handleKeyDown);
    //         window.removeEventListener("keyup", handleKeyUp);
    //     } else {
    //         window.addEventListener("keydown", handleKeyDown);
    //         window.addEventListener("keyup", handleKeyUp);
    //     }
    //     return () => {
    //         window.removeEventListener("keydown", handleKeyDown);
    //         window.removeEventListener("keyup", handleKeyUp);
    //     };
    // }, [handleKeyDown, handleKeyUp]);

    const fogNear = godMode ? 20 : eyesClosed ? 1.0 : 2;
    const fogFar = godMode ? 120 : eyesClosed ? 4.5 : 12;

    return (
        <div className="w-full h-screen bg-black relative font-sans select-none overflow-hidden">
            <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 6, 4], fov: 45 }}>
                <ColorTag attach="background" args={["#020202"]} />
                <FogTag attach="fog" args={["#020202", fogNear, fogFar]} />
                <AmbientLight intensity={godMode ? 10 : eyesClosed ? 0.8 : 0.05} />
                {godMode && <DirectionalLight position={[10, 20, 10]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} />}
                <Stone
                    eyesClosed={eyesClosed && !godMode}
                    biome={biome}
                    onPositionUpdate={handleStoneMove}
                    obstacles={worldObjects || []}
                    isThinking={isThinking}
                />
                {/* Fix: Removed eyesClosed prop from World component call as it is not defined in WorldProps */}
                <World biome={biome} objects={worldObjects || []} />
                <EffectComposer enableNormalPass={false}>
                    {!godMode && <Pixelation granularity={6} />}
                    {/* <Noise opacity={eyesClosed ? 0.4 : 0.1} /> */}
                    {/* <Vignette eskil={false} offset={0.1} darkness={godMode ? 0.5 : eyesClosed ? 1.8 : 1.3} /> */}
                </EffectComposer>
                <CameraRig targetRef={stonePosRef} eyesClosed={eyesClosed} godMode={godMode} />
            </Canvas>

            <Overlay
                year={year}
                biome={biome}
                eyesClosed={eyesClosed}
                logs={logs}
                isThinking={isThinking}
                godMode={godMode}
                onBlink={handleBlink}
                onToggleEyes={setEyesClosed}
                onChangeBiome={setBiome}
                onToggleGodMode={() => setGodMode(!godMode)}
                onOpenGallery={() => setIsGalleryOpen(true)}
            />
            {/* 眨眼这块功能先屏蔽掉 */}
            {/* {eyeController.isConnected && (
                <div className="absolute bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs">
                    <div>眼睛: {eyeController.eyeState === "closed" ? "闭合" : "睁开"}</div>
                    <div>EAR: {eyeController.earValue.toFixed(3)}</div>
                    <div>眨眼: {eyeController.blinkCount}</div>
                    <div>FPS: {eyeController.fps}</div>
                    {eyeController.isCalibrating && <div className="text-yellow-400">校准中...</div>}
                </div>
            )} */}
            <Gallery collection={collection} isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} />
            <CardPullOverlay card={currentPulledCard} onClose={() => setCurrentPulledCard(null)} />
        </div>
    );
}

function CameraRig({ targetRef, eyesClosed, godMode }: { targetRef: React.MutableRefObject<Vector3>; eyesClosed: boolean; godMode: boolean }) {
    useFrame((state) => {
        if (!targetRef.current) return;
        const target = targetRef.current;
        const camPos = new Vector3();
        if (godMode) {
            camPos.set(0, 60, 40);
            state.camera.position.lerp(camPos, 0.02);
            state.camera.lookAt(0, 0, 0);
        } else {
            const targetHeight = eyesClosed ? 9 : 7;
            const targetZ = eyesClosed ? 0.5 : 5;
            camPos.set(target.x, targetHeight, target.z + targetZ);
            if (state.camera.position.distanceTo(camPos) > 20) {
                state.camera.position.set(camPos.x, camPos.y, camPos.z);
                state.camera.lookAt(target.x, target.y, target.z);
            } else {
                state.camera.position.lerp(camPos, 0.04);
                state.camera.lookAt(target.x, target.y, target.z);
            }
        }
    });
    return null;
}
