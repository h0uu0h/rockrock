import React, { useMemo } from "react";
import { Biome, WorldObject } from "../types";

// Fix JSX intrinsic element errors by aliasing tags to any
const Group = "group" as any;
const MeshTag = "mesh" as any;
const PlaneGeometry = "planeGeometry" as any;
const MeshStandardMaterial = "meshStandardMaterial" as any;
const BoxGeometry = "boxGeometry" as any;
const MeshPhysicalMaterial = "meshPhysicalMaterial" as any;
const CylinderGeometry = "cylinderGeometry" as any;
const ConeGeometry = "coneGeometry" as any;
const DodecahedronGeometry = "dodecahedronGeometry" as any;
const CapsuleGeometry = "capsuleGeometry" as any;
const SphereGeometry = "sphereGeometry" as any;
const IcosahedronGeometry = "icosahedronGeometry" as any;

interface WorldProps {
    biome: Biome;
    objects: WorldObject[];
}

export const World: React.FC<WorldProps> = ({ biome, objects }) => {
    const floorColor = useMemo(() => {
        switch (biome) {
            case Biome.BEACH:
                return "#1a1814"; // Wet Sand
            case Biome.MOUNTAIN:
                return "#0d0d0d"; // Obsidian/Dark Rock
            case Biome.FISHTANK:
                return "#001a26"; // Deep water darkness
            case Biome.DESERT:
                return "#3d2616"; // Dark Sand/Red Rock
            case Biome.RAINFOREST:
                return "#0a1f0a"; // Dark Mossy Earth
            case Biome.TUNDRA:
                return "#1a262e"; // Dark Ice/Permafrost
            case Biome.HOT_SPRING:
                return "#1f1f1f"; // Wet Slate
            case Biome.VOLCANO:
                return "#140505"; // Scorched Earth
            case Biome.THEME_PARK:
                return "#1a1a1a"; // Old Asphalt
            case Biome.OLD_HOUSE:
                return "#261e16"; // Packed Earth/Dark Wood
            case Biome.SEWER:
                return "#12140f"; // Sludge
            case Biome.TEMPLE:
                return "#1c1c1c"; // Stone Pavement
            default:
                return "#000000";
        }
    }, [biome]);

    return (
        <Group>
            {/* Floor - Responsive to point light */}
            <MeshTag rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                <PlaneGeometry args={[200, 200, 64, 64]} />
                <MeshStandardMaterial color={floorColor} roughness={0.8} metalness={0.1} />
            </MeshTag>

            {/* Scattered Objects with null safety */}
            {Array.isArray(objects) &&
                objects.map((obj) =>
                    obj && obj.position ? (
                        <Group
                            key={obj.id}
                            position={[obj.position.x, obj.position.y, obj.position.z]}
                            rotation={obj.rotation}
                            scale={[obj.scale, obj.scale, obj.scale]}>
                            <MeshForType type={obj.type} color={obj.color} />
                        </Group>
                    ) : null
                )}

            {/* Biome Specific Boundaries/Ambience */}
            {biome === Biome.FISHTANK && (
                <MeshTag position={[0, 10, 0]}>
                    <BoxGeometry args={[80, 20, 80]} />
                    <MeshPhysicalMaterial transmission={0.6} roughness={0.2} thickness={1} color="#003344" side={1} />
                </MeshTag>
            )}
            {biome === Biome.SEWER && (
                <MeshTag rotation={[0, 0, Math.PI / 2]} position={[0, 10, 0]}>
                    <CylinderGeometry args={[20, 20, 100, 16, 1, true]} />
                    <MeshStandardMaterial color="#0a0a0a" side={2} />
                </MeshTag>
            )}
        </Group>
    );
};

const MeshForType = ({ type, color }: { type: string; color: string }) => {
    if (!type) return null;

    if (["shell", "fern", "obsidian_shard"].some((t) => type.includes(t))) {
        return (
            <MeshTag castShadow receiveShadow>
                <ConeGeometry args={[0.4, 0.8, 16]} />
                <MeshStandardMaterial color={color} roughness={0.9} />
            </MeshTag>
        );
    }

    if (["driftwood", "log", "bone", "root", "pipe"].some((t) => type.includes(t))) {
        return (
            <MeshTag castShadow receiveShadow rotation={[0, 0, 1.5]}>
                <CylinderGeometry args={[0.1, 0.15, 3, 5]} />
                <MeshStandardMaterial color={color} roughness={0.9} />
            </MeshTag>
        );
    }

    if (["pebble", "rock", "gravel", "ruin", "skull", "slate", "basalt"].some((t) => type.includes(t))) {
        return (
            <MeshTag castShadow receiveShadow>
                <DodecahedronGeometry args={[0.3, 0]} />
                <MeshStandardMaterial color={color} roughness={0.9} />
            </MeshTag>
        );
    }

    if (type.includes("starfish")) {
        return (
            <Group>
                {[0, 72, 144, 216, 288].map((deg) => (
                    <MeshTag key={deg} rotation={[0, (deg * Math.PI) / 180, 0]} position={[0, 0, 0]} castShadow receiveShadow>
                        <BoxGeometry args={[0.8, 0.1, 0.2]} />
                        <MeshStandardMaterial color={color} roughness={0.9} />
                    </MeshTag>
                ))}
            </Group>
        );
    }

    if (type.includes("cactus")) {
        return (
            <Group>
                <MeshTag position={[0, 0.5, 0]} castShadow receiveShadow>
                    <CapsuleGeometry args={[0.2, 1, 4, 8]} />
                    <MeshStandardMaterial color={color} roughness={0.9} />
                </MeshTag>
                <MeshTag position={[0.3, 0.5, 0]} rotation={[0, 0, -0.5]} castShadow receiveShadow>
                    <CapsuleGeometry args={[0.1, 0.4, 4, 8]} />
                    <MeshStandardMaterial color={color} roughness={0.9} />
                </MeshTag>
            </Group>
        );
    }

    if (type.includes("mushroom")) {
        return (
            <Group>
                <MeshTag position={[0, 0.2, 0]} castShadow receiveShadow>
                    <CylinderGeometry args={[0.1, 0.15, 0.4]} />
                    <MeshStandardMaterial color={color} roughness={0.9} />
                </MeshTag>
                <MeshTag position={[0, 0.4, 0]} castShadow receiveShadow>
                    <ConeGeometry args={[0.4, 0.2, 16]} />
                    <MeshStandardMaterial color={color} roughness={0.9} />
                </MeshTag>
            </Group>
        );
    }

    if (type.includes("ice_pillar") || type.includes("vent") || type.includes("pole")) {
        return (
            <MeshTag castShadow receiveShadow position={[0, 1, 0]}>
                <CylinderGeometry args={[0.2, 0.4, 2, 6]} />
                <MeshStandardMaterial color={color} roughness={0.9} />
            </MeshTag>
        );
    }

    if (type.includes("bubble") || type.includes("steam")) {
        return (
            <MeshTag castShadow receiveShadow position={[0, 0.5, 0]}>
                <SphereGeometry args={[0.2, 16, 16]} />
                <MeshPhysicalMaterial color="white" transmission={0.9} roughness={0} thickness={0.1} />
            </MeshTag>
        );
    }

    if (type.includes("lantern") || type.includes("chime") || type.includes("booth")) {
        return (
            <MeshTag castShadow receiveShadow position={[0, 0.5, 0]}>
                <BoxGeometry args={[0.3, 0.6, 0.3]} />
                <MeshStandardMaterial color={color} roughness={0.9} />
            </MeshTag>
        );
    }

    if (type.includes("goldfish") || type.includes("rat") || type.includes("cat") || type.includes("penguin")) {
        return (
            <MeshTag castShadow receiveShadow position={[0, 0.3, 0]}>
                <CapsuleGeometry args={[0.3, 0.6, 4, 8]} />
                <MeshStandardMaterial color={color} roughness={0.9} />
            </MeshTag>
        );
    }

    if (type.includes("bag") || type.includes("leaves")) {
        return (
            <MeshTag castShadow receiveShadow position={[0, 0.2, 0]}>
                <DodecahedronGeometry args={[0.5, 1]} />
                <MeshStandardMaterial color={color} roughness={0.9} />
            </MeshTag>
        );
    }

    if (type.includes("monk")) {
        return (
            <MeshTag position={[0, 0.7, 0]}>
                <CapsuleGeometry args={[0.3, 1.4, 4, 8]} />
                <MeshStandardMaterial color="#333" transparent opacity={0.3} />
            </MeshTag>
        );
    }

    // Default fallback
    return (
        <MeshTag castShadow receiveShadow>
            <IcosahedronGeometry args={[0.5, 0]} />
            <MeshStandardMaterial color={color} roughness={0.9} />
        </MeshTag>
    );
};
