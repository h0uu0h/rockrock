
import { GoogleGenAI, Type } from "@google/genai";
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

export const generateSensoryFeedback = async (
  biome: Biome,
  objectType: string,
  distance: number,
  year: number
): Promise<{ description: string; soundEffect: string }> => {
  try {
    // Initialize GoogleGenAI right before the call to ensure fresh API key context
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const biomeName = BiomePromptNames[biome] || biome;
    
    const prompt = `
      你是一块位于 ${biomeName} 环境中的有感知的石头。
      当前年份是 ${year}。
      你是盲目的，只能通过触觉（纹理、温度、硬度）和听觉（声纹、振动）来感知世界。
      
      你刚刚轻轻触碰或感应到了一个距离约 ${distance.toFixed(1)} 米的 "${objectType}"。
      
      请严格使用触觉和听觉术语来描述这种感觉。
      绝对不要描述视觉画面（颜色、光影）。
      请用中文回答，风格风趣幽默充满童真（视场景而定），简短（不超过30个字）。
      同时提供一个拟声词（onomatopoeia）来描述它发出的声音。
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: {
              type: Type.STRING,
              description: "触觉/听觉感官描述 (中文).",
            },
            soundEffect: {
              type: Type.STRING,
              description: "拟声词.",
            },
          },
          required: ["description", "soundEffect"],
          propertyOrdering: ["description", "soundEffect"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      description: "你感觉到黑暗中某种模糊的存在。",
      soundEffect: "嗡...",
    };
  }
};
