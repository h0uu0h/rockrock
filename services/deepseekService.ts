import { Biome } from "../types";

export const generateSensoryFeedback = async (
    biome: Biome,
    objectType: string,
    distance: number,
    year: number
): Promise<{ description: string; soundEffect: string }> => {
    try {
        // 直接请求你自己的后端 API
        // 注意：因为你在 nginx 配置了 /api/ 的反向代理，这里可以用相对路径
        const response = await fetch('/api/sensory-feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                biome,       // TS Enum 的值会自动转为字符串传过去
                objectType,
                distance,
                year
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        // 后端已经处理好了 JSON 格式，直接拿来用
        const data = await response.json();

        return {
            description: data.description,
            soundEffect: data.soundEffect
        };

    } catch (error) {
        console.error("Sensory Feedback Error:", error);
        // 发生网络错误时的兜底文案
        return {
            description: "你感觉到黑暗中某种模糊的存在。",
            soundEffect: "..."
        };
    }
};