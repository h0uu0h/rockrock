
import React, { useEffect, useState } from 'react';
import { Card, Rarity } from '../types';
import { Sparkles } from 'lucide-react';

interface CardPullOverlayProps {
  card: Card | null;
  onClose: () => void;
}

export const CardPullOverlay: React.FC<CardPullOverlayProps> = ({ card, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (card) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 500); // Wait for fade out
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [card, onClose]);

  if (!card) return null;

  const rarityText: Record<Rarity, string> = {
    COMMON: '平凡感官',
    RARE: '罕见触碰',
    ETERNAL: '永恒印记',
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center pointer-events-none transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      <div className="relative animate-in zoom-in-95 spin-in-1 duration-700 ease-out">
        {/* Shine effect for rare cards */}
        {card.rarity !== 'COMMON' && (
          <div className="absolute inset-[-40px] bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-45 animate-[shimmer_2s_infinite] pointer-events-none" />
        )}
        
        <div className={`w-72 aspect-[3/4.5] bg-stone-900 border-4 rounded-xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center justify-between text-center
          ${card.rarity === 'ETERNAL' ? 'border-yellow-400 shadow-yellow-500/20' : 
            card.rarity === 'RARE' ? 'border-blue-400 shadow-blue-500/20' : 'border-stone-500'}`}>
          
          <div className="space-y-1">
             <div className="flex items-center justify-center gap-1 text-[10px] font-mono tracking-widest text-stone-500 uppercase">
                <Sparkles className="w-3 h-3" />
                <span>{rarityText[card.rarity]}</span>
                <Sparkles className="w-3 h-3" />
             </div>
             <h2 className="text-2xl font-serif text-white uppercase tracking-tighter">{card.objectType.replace(/_/g, ' ')}</h2>
          </div>

          <div className="w-full h-40 bg-black/40 rounded-lg flex items-center justify-center overflow-hidden relative">
              {/* Abstract Pixel Representation */}
              <div className="grid grid-cols-8 gap-1 p-4 rotate-12 opacity-80">
                  {[...Array(64)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-2 h-2 rounded-sm" 
                      style={{ 
                        backgroundColor: card.color, 
                        opacity: Math.random() > 0.6 ? 0.8 : 0.1,
                        animationDelay: `${Math.random() * 2}s`
                      }} 
                    />
                  ))}
              </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-serif italic text-stone-300 px-2 leading-relaxed line-clamp-3">"{card.description}"</p>
            <div className="pt-4 border-t border-white/10 w-full flex justify-between items-center text-[10px] font-mono text-stone-500">
                <span>Y.{card.year}</span>
                <span>[{card.sound}]</span>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center text-stone-400 font-mono text-[10px] animate-pulse">
           档案已自动记录
        </div>
      </div>
    </div>
  );
};
