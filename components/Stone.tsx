import React, { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, Vector3, MathUtils, Group as ThreeGroup } from "three";
import { Biome, WorldObject } from "../types";
import { playCollisionSound } from "../services/soundService";

// Fix JSX intrinsic element errors by aliasing tags to any
const Group = "group" as any;
const PointLight = "pointLight" as any;
const MeshTag = "mesh" as any;
const DodecahedronGeometry = "dodecahedronGeometry" as any;
const MeshStandardMaterial = "meshStandardMaterial" as any;
const SphereGeometry = "sphereGeometry" as any;

interface StoneProps {
    eyesClosed: boolean;
    biome: Biome;
    onPositionUpdate: (pos: Vector3) => void;
    obstacles: WorldObject[];
    isThinking: boolean;
}

export const Stone: React.FC<StoneProps> = ({ eyesClosed, biome, onPositionUpdate, obstacles, isThinking }) => {
    const groupRef = useRef<ThreeGroup>(null);
    const meshRef = useRef<Mesh>(null);

    // Physics state
    const position = useRef(new Vector3(0, 0.4, 0));
    const driftDirection = useRef(new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize());
    const angularVelocity = useRef(new Vector3(0, 0, 0));
    const lastCollisionTime = useRef(0);

    // Map Boundary for Toroidal Wrapping
    const WORLD_SIZE = 40;

    // 使用空间分区优化
    const obstaclesGrid = useMemo(() => {
        const grid = new Map<string, WorldObject[]>();
        obstacles.forEach((obj) => {
            const gridX = Math.floor(obj.position.x / 5); // 5为格子大小
            const gridZ = Math.floor(obj.position.z / 5);
            const key = `${gridX},${gridZ}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key)!.push(obj);
        });
        return grid;
    }, [obstacles]);

    useFrame((state, delta) => {
        if (!groupRef.current || !meshRef.current) return;
        const gridX = Math.floor(position.current.x / 5);
        const gridZ = Math.floor(position.current.z / 5);

        const nearbyObjects: WorldObject[] = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const key = `${gridX + dx},${gridZ + dz}`;
                const objs = obstaclesGrid.get(key) || [];
                nearbyObjects.push(...objs);
            }
        }

        if (eyesClosed) {
            const speed = 3.0 * delta;

            if (Math.random() > 0.98) {
                driftDirection.current.applyAxisAngle(new Vector3(0, 1, 0), (Math.random() - 0.5) * 1.0);
                driftDirection.current.normalize();
            }

            const moveVec = driftDirection.current.clone().multiplyScalar(speed);
            const nextPos = position.current.clone().add(moveVec);

            const stoneRadius = 0.4;

            if (Array.isArray(obstacles)) {
                nearbyObjects.forEach((obj) => {
                    const objX = obj.position.x ?? 0;
                    const objZ = obj.position.z ?? 0;

                    const dx = nextPos.x - objX;
                    const dz = nextPos.z - objZ;
                    const distSq = dx * dx + dz * dz;

                    const objRadius = 0.5 * (obj.scale || 1);
                    const combinedRadius = stoneRadius + objRadius;

                    if (distSq < combinedRadius * combinedRadius) {
                        const dist = Math.sqrt(distSq);

                        const now = state.clock.getElapsedTime();
                        if (now - lastCollisionTime.current > 0.3) {
                            playCollisionSound();
                            lastCollisionTime.current = now;
                        }

                        const normal = new Vector3(dx, 0, dz).normalize();
                        const dot = driftDirection.current.dot(normal);

                        if (dot < 0) {
                            driftDirection.current.sub(normal.multiplyScalar(dot));
                            driftDirection.current.x += (Math.random() - 0.5) * 0.1;
                            driftDirection.current.z += (Math.random() - 0.5) * 0.1;
                            driftDirection.current.normalize();
                        }

                        const overlap = combinedRadius - dist;
                        const pushOut = normal.multiplyScalar(overlap + 0.02);
                        nextPos.add(pushOut);

                        angularVelocity.current.x += normal.z * 0.4;
                        angularVelocity.current.z -= normal.x * 0.4;
                        angularVelocity.current.y += (Math.random() - 0.5) * 0.5;
                    }
                });
            }

            if (nextPos.x > WORLD_SIZE) nextPos.x -= WORLD_SIZE * 2;
            if (nextPos.x < -WORLD_SIZE) nextPos.x += WORLD_SIZE * 2;
            if (nextPos.z > WORLD_SIZE) nextPos.z -= WORLD_SIZE * 2;
            if (nextPos.z < -WORLD_SIZE) nextPos.z += WORLD_SIZE * 2;

            position.current.set(nextPos.x, nextPos.y, nextPos.z);

            const rollAxis = new Vector3().crossVectors(new Vector3(0, 1, 0), driftDirection.current).normalize();
            meshRef.current.rotateOnWorldAxis(rollAxis, speed * 2);

            meshRef.current.rotation.x += angularVelocity.current.x * delta * 5;
            meshRef.current.rotation.y += angularVelocity.current.y * delta * 5;
            meshRef.current.rotation.z += angularVelocity.current.z * delta * 5;
        } else {
            meshRef.current.rotation.y = MathUtils.lerp(meshRef.current.rotation.y, state.clock.getElapsedTime() * 0.2, 0.05);
            angularVelocity.current.lerp(new Vector3(0, 0, 0), 0.1);
        }

        angularVelocity.current.multiplyScalar(0.92);

        // Update group position
        groupRef.current.position.set(position.current.x, position.current.y, position.current.z);

        if (typeof onPositionUpdate === "function") {
            onPositionUpdate(position.current);
        }
    });

    return (
        <Group ref={groupRef}>
            <PointLight
                position={[0, 0.5, 0]}
                distance={eyesClosed ? 4.5 : 8.0}
                decay={2.5}
                intensity={eyesClosed ? 4.0 : 8.0}
                color={eyesClosed ? "#88aaff" : "#ffeedd"}
                castShadow
            />

            <MeshTag ref={meshRef} castShadow receiveShadow>
                <DodecahedronGeometry args={[0.4, 1]} />
                <MeshStandardMaterial color="#6c6c6c" roughness={0.7} metalness={0.2} flatShading={true} />
            </MeshTag>
        </Group>
    );
};
