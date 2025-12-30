import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, Vector3, Group as ThreeGroup } from "three";
import { Biome, WorldObject } from "../types";
import { playCollisionSound } from "../services/soundService";

const Group = "group" as any;
const PointLight = "pointLight" as any;
const MeshTag = "mesh" as any;
const DodecahedronGeometry = "dodecahedronGeometry" as any;
const MeshStandardMaterial = "meshStandardMaterial" as any;

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

    // 保持原有的状态引用，不改变模型
    const position = useRef(new Vector3(0, 0.4, 0));
    const driftDirection = useRef(new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize());
    const angularVelocity = useRef(new Vector3(0, 0, 0));
    const lastCollisionTime = useRef(0);

    // 新增：速度平滑控制
    const currentSpeed = useRef(0);
    const targetSpeed = useRef(0);

    const WORLD_SIZE = 40;

    // 空间分区优化
    const obstaclesGrid = useMemo(() => {
        const grid = new Map<string, WorldObject[]>();
        obstacles.forEach((obj) => {
            const gridX = Math.floor(obj.position.x / 5);
            const gridZ = Math.floor(obj.position.z / 5);
            const key = `${gridX},${gridZ}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key)!.push(obj);
        });
        return grid;
    }, [obstacles]);

    useFrame((state, delta) => {
        if (!groupRef.current || !meshRef.current) return;

        // 1. 根据眼睛状态设置目标速度（平滑过渡）
        if (eyesClosed) {
            targetSpeed.current = 2.5; // 闭眼：中等速度
        } else {
            targetSpeed.current = 0.03; // 睁眼：缓慢速度
        }

        // 2. 平滑调整当前速度
        const speedLerpFactor = 0.1;
        currentSpeed.current += (targetSpeed.current - currentSpeed.current) * speedLerpFactor;

        // 3. 获取附近物体
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

        // 4. 自然转向逻辑（基于当前速度）
        if (Math.random() > 0.99) {
            // 小概率随机微调方向
            const turnAmount = (Math.random() - 0.5) * 0.3;
            driftDirection.current.applyAxisAngle(new Vector3(0, 1, 0), turnAmount);
            driftDirection.current.normalize();
        }

        // 5. 计算移动
        const moveVec = driftDirection.current.clone().multiplyScalar(currentSpeed.current * delta);
        const nextPos = position.current.clone().add(moveVec);

        // 6. 碰撞检测（保持原有的碰撞逻辑，但调整力度）
        const stoneRadius = 0.4;
        let hasCollision = false;

        nearbyObjects.forEach((obj) => {
            if (hasCollision) return;

            const objX = obj.position.x ?? 0;
            const objZ = obj.position.z ?? 0;
            const dx = nextPos.x - objX;
            const dz = nextPos.z - objZ;
            const distSq = dx * dx + dz * dz;
            const objRadius = 0.5 * (obj.scale || 1);
            const combinedRadius = stoneRadius + objRadius;

            if (distSq < combinedRadius * combinedRadius) {
                hasCollision = true;
                const dist = Math.sqrt(distSq);

                const now = state.clock.getElapsedTime();
                if (now - lastCollisionTime.current > 0.5) {
                    playCollisionSound();
                    lastCollisionTime.current = now;
                }

                // 自然碰撞反射
                const normal = new Vector3(dx, 0, dz).normalize();
                const dot = driftDirection.current.dot(normal);

                if (dot < 0) {
                    // 反射计算：v' = v - 2*(v·n)*n
                    driftDirection.current.sub(normal.clone().multiplyScalar(2 * dot));
                    driftDirection.current.normalize();

                    // 添加一点随机性，避免卡住
                    driftDirection.current.x += (Math.random() - 0.5) * 0.2;
                    driftDirection.current.z += (Math.random() - 0.5) * 0.2;
                    driftDirection.current.normalize();
                }

                // 推开石头
                const overlap = combinedRadius - dist;
                const pushOut = normal.multiplyScalar(overlap + 0.02);
                nextPos.add(pushOut);

                // 角速度增加（根据当前速度调整力度）
                const angularForce = currentSpeed.current * 0.15;
                angularVelocity.current.x += normal.z * angularForce;
                angularVelocity.current.z -= normal.x * angularForce;
                angularVelocity.current.y += (Math.random() - 0.5) * angularForce * 0.3;
            }
        });

        // 7. 边界处理（环形世界）
        if (nextPos.x > WORLD_SIZE) nextPos.x -= WORLD_SIZE * 2;
        if (nextPos.x < -WORLD_SIZE) nextPos.x += WORLD_SIZE * 2;
        if (nextPos.z > WORLD_SIZE) nextPos.z -= WORLD_SIZE * 2;
        if (nextPos.z < -WORLD_SIZE) nextPos.z += WORLD_SIZE * 2;

        // 8. 更新位置
        position.current.copy(nextPos);
        groupRef.current.position.copy(position.current);

        // 9. 自然旋转逻辑
        // 9.1 基础滚动（根据移动方向）
        if (currentSpeed.current > 0.1) {
            const rollAxis = new Vector3().crossVectors(new Vector3(0, 1, 0), driftDirection.current).normalize();
            const rollAmount = currentSpeed.current * 1.5 * delta;
            meshRef.current.rotateOnWorldAxis(rollAxis, rollAmount);
        }

        // 9.2 应用角速度（碰撞产生的旋转）
        meshRef.current.rotation.x += angularVelocity.current.x * delta;
        meshRef.current.rotation.y += angularVelocity.current.y * delta;
        meshRef.current.rotation.z += angularVelocity.current.z * delta;

        // 9.3 角速度自然衰减
        angularVelocity.current.multiplyScalar(0.96);

        // 9.4 睁眼时额外的稳定效果
        if (!eyesClosed) {
            // 缓慢减少X/Z轴的倾斜（恢复水平）
            angularVelocity.current.x *= 0.98;
            angularVelocity.current.z *= 0.98;

            // 添加微小的自然摆动
            const idleSwing = Math.sin(state.clock.getElapsedTime() * 1.2) * 0.002;
            meshRef.current.rotation.x += idleSwing;
            meshRef.current.rotation.z += idleSwing * 0.7;
        }

        // 10. 通知父组件
        onPositionUpdate(position.current);
    });

    return (
        <Group ref={groupRef}>
            <PointLight
                position={[0, 0.8, 0]}
                distance={eyesClosed ? 4.5 : 8.0}
                decay={2.5}
                intensity={20}
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
