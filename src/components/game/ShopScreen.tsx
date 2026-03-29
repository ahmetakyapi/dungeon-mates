'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ShopItem } from '../../../shared/types';

type ShopScreenProps = {
  items: ShopItem[];
  playerGold: number;
  floor: number;
  onBuy: (itemId: string) => void;
  onContinue: () => void;
};

// Vezneci Arin diyalogları
const MERCHANT_LINES: Record<string, string> = {
  early: 'Ah, yeni yüzler. Altınlarınız varsa, Zephara\'nın kalıntılarından bir şeyler sunabilirim.',
  mid: 'Selvira\'yı gördünüz demek... Daha derine inecekseniz, hazırlıklı olun.',
  late: 'Karanmir\'in yakınına gidiyorsunuz. Alabildiğinizi alın — geri dönemeyen çok oldu.',
};

function getMerchantLine(floor: number): string {
  if (floor <= 4) return MERCHANT_LINES.early;
  if (floor <= 7) return MERCHANT_LINES.mid;
  return MERCHANT_LINES.late;
}

export function ShopScreen({ items, playerGold, floor, onBuy, onContinue }: ShopScreenProps) {
  const [gold, setGold] = useState(playerGold);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    setGold(playerGold);
  }, [playerGold]);

  // 30 saniye geri sayım
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          onContinue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onContinue]);

  const handleBuy = useCallback((item: ShopItem) => {
    if (gold < item.cost) return;
    if (item.type === 'upgrade' && purchasedIds.has(item.id)) return;
    onBuy(item.id);
    setGold(prev => prev - item.cost);
    if (item.type === 'upgrade') {
      setPurchasedIds(prev => new Set(prev).add(item.id));
    }
  }, [gold, purchasedIds, onBuy]);

  const consumables = items.filter(i => i.type === 'consumable');
  const upgrades = items.filter(i => i.type === 'upgrade');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Başlık */}
        <div className="text-center mb-4">
          <div className="text-3xl mb-1">👻</div>
          <h2 className="text-xl font-bold text-yellow-400">Vezneci Arin</h2>
          <p className="text-zinc-400 text-sm mt-1 italic max-w-md mx-auto">
            &quot;{getMerchantLine(floor)}&quot;
          </p>
        </div>

        {/* Altın ve Zamanlayıcı */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-900/30 border border-yellow-600/30">
            <span className="text-yellow-400 font-bold">{gold}</span>
            <span className="text-yellow-600 text-sm">altın</span>
          </div>
          <div className={`px-3 py-1.5 rounded-lg font-mono text-sm ${timer <= 10 ? 'bg-red-900/30 text-red-400 animate-pulse' : 'bg-zinc-800 text-zinc-400'}`}>
            {timer}s
          </div>
        </div>

        {/* Tüketimlikler */}
        {consumables.length > 0 && (
          <div className="mb-4">
            <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2 px-2">Tüketimlik</h3>
            <div className="grid grid-cols-2 gap-2">
              {consumables.map(item => (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  canAfford={gold >= item.cost}
                  purchased={false}
                  onBuy={() => handleBuy(item)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Yükseltmeler */}
        {upgrades.length > 0 && (
          <div className="mb-4">
            <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2 px-2">Kalıcı Yükseltme</h3>
            <div className="grid grid-cols-2 gap-2">
              {upgrades.map(item => (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  canAfford={gold >= item.cost}
                  purchased={purchasedIds.has(item.id)}
                  onBuy={() => handleBuy(item)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Devam butonu */}
        <div className="flex justify-center mt-4">
          <button
            onClick={onContinue}
            className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
          >
            Devam Et
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ShopItemCard({
  item,
  canAfford,
  purchased,
  onBuy,
}: {
  item: ShopItem;
  canAfford: boolean;
  purchased: boolean;
  onBuy: () => void;
}) {
  const disabled = !canAfford || purchased;

  return (
    <button
      onClick={onBuy}
      disabled={disabled}
      className={`
        p-3 rounded-lg border text-left transition-all
        ${purchased
          ? 'bg-zinc-800/50 border-zinc-700/30 opacity-50'
          : canAfford
            ? 'bg-zinc-800/80 border-zinc-600/40 hover:border-yellow-500/50 hover:bg-zinc-700/60'
            : 'bg-zinc-900/50 border-zinc-800/30 opacity-60'
        }
        disabled:cursor-not-allowed
      `}
    >
      <div className="flex items-start gap-2">
        <span className="text-xl">{item.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-white text-sm font-medium truncate">{item.name}</h4>
            <span className={`text-xs font-bold ml-2 ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
              {item.cost}g
            </span>
          </div>
          <p className="text-zinc-400 text-xs mt-0.5">{item.description}</p>
          {purchased && (
            <span className="text-emerald-400 text-[10px] font-medium mt-1 inline-block">Satın alındı</span>
          )}
        </div>
      </div>
    </button>
  );
}
