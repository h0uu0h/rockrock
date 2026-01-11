import { Biome } from "../types";

const BiomePromptNames: Record<Biome, string> = {
    [Biome.BEACH]: '潮汐涨落的海边',
    [Biome.MOUNTAIN]: '幽静的风吹松林山谷',
    [Biome.FISHTANK]: '略显拥挤的家庭鱼缸内部',
    [Biome.DESERT]: '风沙呼啸的荒凉沙漠',
    [Biome.RAINFOREST]: '潮湿阴暗的苔藓森林',
    [Biome.TUNDRA]: '极度寒冷的冰川极地',
    [Biome.HOT_SPRING]: '温暖且充满蒸汽的温泉边',
    [Biome.VOLCANO]: '危险的火山口边缘',
    [Biome.THEME_PARK]: '风中呜咽的废弃游乐园',
    [Biome.OLD_HOUSE]: '有着灵异气息的日式老宅院',
    [Biome.SEWER]: '阴暗潮湿的城市下水道',
    [Biome.TEMPLE]: '充满禅意的古老寺院',
};
const StoneMoods = [
    "没睡醒的", "饥肠辘辘把什么都当食物的", "有点神经质的",
    "充满哲学思考的", "嫌弃一切的洁癖", "像个好奇宝宝的",
    "老气横秋的", "充满童真的", "有点暴躁的",
];
export const generateSensoryFeedback = async (
    biome: Biome,
    objectType: string,
    distance: number,
    year: number
): Promise<{ description: string; soundEffect: string }> => {
    try {
        const biomeName = BiomePromptNames[biome] || biome;
        const currentMood = StoneMoods[Math.floor(Math.random() * StoneMoods.length)];
        const prompt = `
        【角色设定】
        你是一块位于 ${biomeName} 的石头。当前年份 ${year}。
        状态：你现在是"${currentMood}"。
        感官：你完全**看不见**，只能通过**触觉**（纹理/温度/湿度/痛感）和**听觉**（振动/频率）感知。

        【当前事件】
        如果你伸出不存在的手，摸到了距离 ${distance.toFixed(1)} 米处的一个"${objectType}"。

        【任务要求】
        1. **描述**：用"${currentMood}"的语气描述这个触感。
        2. **通感**：必须使用**比喻**。把它比作食物、生活用品或身体部位（例如："像摸到了冷掉的油条"、"像老奶奶的脚后跟"）。
        3. **禁忌**：绝对禁止出现视觉词汇（颜色、光影、形状、"看起来"）。不要直接说出"${objectType}"的名字，要描述感觉！
        4. **长度**：30字以内，短小精悍，意犹未尽。
        5. **拟声词**：给出一个生动的、非传统的拟声词。

        【返回格式】
        仅返回JSON：
        {
            "description": "触觉描述内容",
            "soundEffect": "拟声词"
        }
    `;

        // 使用DeepSeek API调用
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat', // 使用DeepSeek-V3模型[citation:10]
                messages: [
                    {
                        role: 'system',
                        content: '你是一个严格的JSON生成器。请只返回有效的JSON，不要添加任何解释性文字。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 150,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`DeepSeek API error: ${response.status}`);
        }

        const data = await response.json();

        // 解析返回的JSON内容
        const content = data.choices[0].message.content;

        // 检查返回内容是否是JSON格式
        try {
            const parsedContent = JSON.parse(content);
            return {
                description: parsedContent.description || "你感觉到黑暗中某种模糊的存在。",
                soundEffect: parsedContent.soundEffect || "嗡..."
            };
        } catch {
            // 如果返回的不是JSON，尝试提取结构化信息
            const descriptionMatch = content.match(/"description":\s*"([^"]*)"/) ||
                content.match(/description[：:]\s*([^\n"]*)/);
            const soundEffectMatch = content.match(/"soundEffect":\s*"([^"]*)"/) ||
                content.match(/soundEffect[：:]\s*([^\n"]*)/);

            return {
                description: descriptionMatch ? descriptionMatch[1].trim() : "你感觉到黑暗中某种模糊的存在。",
                soundEffect: soundEffectMatch ? soundEffectMatch[1].trim() : "嗡..."
            };
        }
    } catch (error) {
        console.error("DeepSeek Error:", error);
        return {
            description: "你感觉到黑暗中某种模糊的存在。",
            soundEffect: "嗡...",
        };
    }
};