
import React from 'react';
import { Card, Biome, Rarity } from '../types';
import { X, Book, Trophy } from 'lucide-react';

interface GalleryProps {
  collection: Card[];
  isOpen: boolean;
  onClose: () => void;
}

const RarityColors: Record<Rarity, string> = {
  COMMON: 'border-stone-500 text-stone-400',
  RARE: 'border-blue-400 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]',
  ETERNAL: 'border-yellow-400 text-yellow-200 shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse',
};

const BiomeNames: Record<string, string> = {
  [Biome.BEACH]: '海边', [Biome.MOUNTAIN]: '山谷', [Biome.FISHTANK]: '鱼缸',
  [Biome.DESERT]: '沙漠', [Biome.RAINFOREST]: '雨林', [Biome.TUNDRA]: '冰川',
  [Biome.HOT_SPRING]: '温泉', [Biome.VOLCANO]: '火山', [Biome.THEME_PARK]: '乐园',
  [Biome.OLD_HOUSE]: '老宅', [Biome.SEWER]: '下水道', [Biome.TEMPLE]: '古寺',
};

export const Gallery: React.FC<GalleryProps> = ({ collection, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/95 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto">
      <div className="relative w-full max-w-5xl h-full max-h-[85vh] bg-stone-900/50 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-stone-900/80">
          <div className="flex items-center gap-3">
            <Book className="text-yellow-500 w-6 h-6" />
            <h2 className="text-2xl font-serif tracking-widest text-stone-100">感官档案 <span className="text-xs font-mono text-stone-500 ml-2">ARCHIVE</span></h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-stone-400 font-mono text-sm">
              <Trophy className="w-4 h-4" />
              <span>已收集: {collection.length}</span>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="text-stone-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 scrollbar-hide">
          {collection.length === 0 ? (
            <div className="col-span-full h-64 flex flex-col items-center justify-center text-stone-600 font-serif italic">
              <p>这里目前空空如也...</p>
              <p className="text-xs mt-2 font-mono">去感知外面的世界吧，顽石。</p>
            </div>
          ) : (
            collection.map((card) => (
              <div 
                key={card.id} 
                className={`aspect-[3/4] p-3 rounded-lg border-2 bg-stone-800/40 flex flex-col justify-between transition-transform hover:scale-105 ${RarityColors[card.rarity]}`}
              >
                <div className="flex justify-between items-start">
                    <span className="text-[8px] font-mono opacity-60">#{card.id.slice(-4)}</span>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-center py-2">
                   {/* Pixel Art Placeholder Icon */}
                   <div className="w-12 h-12 bg-white/5 rounded flex items-center justify-center mb-2 overflow-hidden">
                      <div className="grid grid-cols-4 gap-1">
                         {[...Array(16)].map((_, i) => (
                           <div key={i} className="w-1.5 h-1.5" style={{ backgroundColor: i % 3 === 0 ? card.color : 'transparent', opacity: 0.4 }} />
                         ))}
                      </div>
                   </div>
                   <h3 className="text-xs font-bold text-center uppercase tracking-tighter truncate w-full">
                     {card.objectType.replace(/_/g, ' ')}
                   </h3>
                </div>

                <div className="mt-auto pt-2 border-t border-white/5 space-y-1">
                  <p className="text-[9px] font-mono truncate">{BiomeNames[card.biome]}</p>
                  <p className="text-[8px] opacity-50 font-mono">Y.{card.year}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
