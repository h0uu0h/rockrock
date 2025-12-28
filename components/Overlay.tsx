
import React, { useRef, useEffect } from 'react';
import { Biome, InteractionLog } from '../types';
import { Eye, EyeOff, Loader2, Map, BookOpen } from 'lucide-react';

interface OverlayProps {
  year: number;
  biome: Biome;
  eyesClosed: boolean;
  logs: InteractionLog[];
  isThinking: boolean;
  godMode: boolean;
  onBlink: () => void;
  onToggleEyes: (closed: boolean) => void;
  onChangeBiome: (biome: Biome) => void;
  onToggleGodMode: () => void;
  onOpenGallery: () => void;
}

const BiomeNames: Record<string, string> = {
  [Biome.BEACH]: '海边', [Biome.MOUNTAIN]: '山谷', [Biome.FISHTANK]: '鱼缸',
  [Biome.DESERT]: '沙漠', [Biome.RAINFOREST]: '雨林', [Biome.TUNDRA]: '冰川',
  [Biome.HOT_SPRING]: '温泉', [Biome.VOLCANO]: '火山', [Biome.THEME_PARK]: '乐园',
  [Biome.OLD_HOUSE]: '老宅', [Biome.SEWER]: '下水道', [Biome.TEMPLE]: '古寺',
};

export const Overlay: React.FC<OverlayProps> = ({
  year, biome, eyesClosed, logs, isThinking, godMode,
  onBlink, onToggleEyes, onChangeBiome, onToggleGodMode, onOpenGallery,
}) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (logsEndRef.current as any)?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isThinking]);

  const biomes = Biome ? Object.values(Biome) : [];

  return (
    <div className="absolute inset-0 pointer-events-none p-6 select-none z-10 flex flex-col justify-between">
      
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="bg-black/80 backdrop-blur border border-white/10 p-4 rounded-lg pointer-events-auto min-w-[200px] shadow-2xl">
          <h1 className="text-2xl font-serif text-stone-200 tracking-widest mb-2">顽石 (LITHOS)</h1>
          <div className="font-mono text-sm text-stone-400 space-y-1">
            <p>年份: <span className="text-white">{Math.floor(year).toLocaleString()}</span></p>
            <p>环境: <span className="text-yellow-500">{BiomeNames[biome] || biome}</span></p>
            <p>状态: <span className={eyesClosed ? "text-blue-400" : "text-green-400"}>
              {eyesClosed ? "沉睡" : "苏醒"}
            </span></p>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <button 
            onClick={onOpenGallery}
            className="pointer-events-auto flex items-center gap-2 px-4 py-3 bg-stone-100 text-stone-900 rounded-lg font-bold border-b-4 border-stone-400 active:border-b-0 active:translate-y-1 transition-all"
          >
            <BookOpen className="w-5 h-5" />
            <span>感官档案 (G)</span>
          </button>
          
          <div className="pointer-events-auto bg-black/50 p-2 rounded-lg border border-white/5 max-w-[300px] mt-2">
            <div className="flex flex-wrap gap-1 justify-end">
                {biomes.map((b) => (
                <button
                    key={b}
                    onClick={() => onChangeBiome(b as Biome)}
                    className={`px-2 py-1 text-[10px] rounded border ${
                    biome === b ? 'bg-stone-200 text-black border-white' : 'bg-black/40 text-stone-400 border-transparent'
                    }`}
                >
                    {BiomeNames[b]}
                </button>
                ))}
            </div>
          </div>
          
          <button 
            onClick={onToggleGodMode}
            className={`pointer-events-auto mt-2 flex items-center gap-2 px-3 py-1 text-[10px] border rounded transition-colors ${
              godMode ? 'bg-purple-900/50 border-purple-400 text-purple-200' : 'bg-black/50 border-stone-700 text-stone-500'
            }`}
          >
            <Map className="w-3 h-3" />
            {godMode ? "退出上帝视角" : "上帝视角"}
          </button>
        </div>
      </div>

      {eyesClosed && !godMode && (
        <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-1000 z-0 bg-black/40">
          <p className="text-stone-600 font-serif italic text-xl animate-pulse">时光飞逝...</p>
        </div>
      )}

      {!godMode && (
        <div className="absolute left-6 bottom-28 w-80 pointer-events-auto flex flex-col gap-2 z-20 max-h-[40vh] overflow-hidden">
            {logs.slice(-4).map((log) => (
                <div key={log.id} className="bg-black/70 backdrop-blur-sm border-l-2 border-stone-500 p-2 rounded-r-lg animate-in slide-in-from-left-4 fade-in">
                    <p className="text-stone-200 font-serif italic text-xs">"{log.text}"</p>
                    <p className="text-[9px] text-stone-500 mt-1 font-mono uppercase tracking-widest">{log.objectName.replace(/_/g, ' ')}</p>
                </div>
            ))}
            {isThinking && (
                <div className="bg-blue-900/40 border-l-2 border-blue-400 p-2 rounded-r-lg text-blue-200 text-[10px] flex items-center gap-2 animate-pulse w-fit">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>感知中...</span>
                </div>
            )}
            <div ref={logsEndRef} />
        </div>
      )}

      <div className="self-center flex gap-4 items-center justify-center bg-black/80 p-4 rounded-xl border border-white/5 pointer-events-auto shadow-2xl z-30 mb-6">
          <button
              onMouseDown={() => onToggleEyes(true)} onMouseUp={() => onToggleEyes(false)}
              disabled={godMode}
              className={`flex items-center gap-2 px-6 py-3 rounded-md transition-all border-b-4 ${
                godMode ? 'bg-stone-900 border-stone-800 text-stone-700' : 'bg-stone-800 hover:bg-stone-700 text-white border-stone-950'
              }`}
          >
              {eyesClosed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              <span className="font-bold">闭眼</span>
          </button>
          <button
              onClick={onBlink}
              disabled={eyesClosed || isThinking || godMode}
              className={`flex items-center gap-2 px-6 py-3 rounded-md transition-all font-bold ${
                  eyesClosed || godMode ? 'bg-stone-900 text-stone-600 border-stone-800' : 'bg-white text-black border-b-4 border-stone-400'
              }`}
          >
              眨眼感知
          </button>
      </div>
    </div>
  );
};
