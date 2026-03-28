'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CLASS_STATS } from '../../../shared/types';
import type { PlayerClass } from '../../../shared/types';

const EASE = [0.22, 1, 0.36, 1] as const;
const MAX_MESSAGES = 50;

export type ChatMessage = {
  id: string;
  playerId: string;
  name: string;
  text: string;
  timestamp: number;
  playerClass?: PlayerClass;
};

type ChatBoxProps = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  compact?: boolean;
};

const QUICK_CHAT_PRESETS = [
  { text: 'Buraya gel!', emoji: '📍' },
  { text: 'Dikkat!', emoji: '⚠️' },
  { text: 'İyi oyun!', emoji: '👍' },
  { text: 'Yardım!', emoji: '🆘' },
] as const;

function getNameColor(playerId: string, playerClass?: PlayerClass): string {
  if (playerClass && CLASS_STATS[playerClass]) {
    return CLASS_STATS[playerClass].color;
  }
  // Fallback: hash-based color
  const COLORS = [
    '#ef4444', '#8b5cf6', '#10b981', '#f59e0b',
    '#3b82f6', '#ec4899', '#06b6d4', '#f97316',
  ] as const;
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function ChatBox({ messages, onSend, compact = false }: ChatBoxProps) {
  const [isOpen, setIsOpen] = useState(!compact);
  const [inputValue, setInputValue] = useState('');
  const [showQuickChat, setShowQuickChat] = useState(false);
  const [newMessagePulse, setNewMessagePulse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  const displayMessages = messages.slice(-MAX_MESSAGES);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length]);

  // New message pulse notification
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && !isOpen) {
      setNewMessagePulse(true);
      const timer = setTimeout(() => setNewMessagePulse(false), 1000);
      prevMessageCountRef.current = messages.length;
      return () => clearTimeout(timer);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isOpen]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed.length === 0) return;
      onSend(trimmed.slice(0, 100));
      setInputValue('');
      setShowQuickChat(false);
    },
    [inputValue, onSend],
  );

  const handleQuickChat = useCallback(
    (text: string) => {
      onSend(text);
      setShowQuickChat(false);
    },
    [onSend],
  );

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
    setNewMessagePulse(false);
  }, []);

  const toggleQuickChat = useCallback(() => {
    setShowQuickChat((prev) => !prev);
  }, []);

  if (compact) {
    return (
      <div className="pointer-events-auto fixed bottom-16 left-1/2 z-30 w-full max-w-sm -translate-x-1/2 px-2 sm:bottom-20 sm:max-w-md">
        {/* Toggle button */}
        <button
          onClick={toggleOpen}
          className={`mb-1 rounded-lg border border-dm-border/50 bg-dm-bg/80 px-3 py-1.5 font-pixel text-[7px] text-zinc-400 backdrop-blur-md transition-colors hover:text-white sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px] ${
            newMessagePulse ? 'chat-pulse' : ''
          }`}
        >
          {isOpen
            ? 'Sohbeti Gizle'
            : `💬 Sohbet ${displayMessages.length > 0 ? `(${displayMessages.length})` : ''}`}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="overflow-hidden rounded-lg border border-white/[0.06] bg-dm-bg/80 backdrop-blur-md"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(2,6,23,0.4)',
              }}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              {/* Messages */}
              <div className="flex max-h-28 flex-col gap-0.5 overflow-y-auto p-2 sm:max-h-36 lg:max-h-44 2xl:max-h-52">
                {displayMessages.length === 0 && (
                  <p className="font-pixel text-[7px] text-zinc-600 sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]">
                    Henüz mesaj yok...
                  </p>
                )}
                {displayMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    className="font-pixel text-[7px] leading-relaxed sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span style={{ color: getNameColor(msg.playerId, msg.playerClass) }}>
                      {msg.name}
                    </span>
                    <span className="text-zinc-500">: </span>
                    <span className="text-zinc-300">{msg.text}</span>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick chat presets */}
              <AnimatePresence>
                {showQuickChat && (
                  <motion.div
                    className="flex flex-wrap gap-1 border-t border-dm-border/50 px-2 py-1.5"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    {QUICK_CHAT_PRESETS.map((preset) => (
                      <button
                        key={preset.text}
                        onClick={() => handleQuickChat(preset.text)}
                        className="rounded border border-dm-border/40 bg-dm-surface/50 px-2 py-1 font-pixel text-[6px] text-zinc-300 transition-colors hover:bg-dm-accent/20 hover:text-white sm:text-[7px] lg:text-[8px] xl:text-[9px] 2xl:text-[11px]"
                      >
                        {preset.emoji} {preset.text}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input */}
              <form
                onSubmit={handleSubmit}
                className="flex items-center border-t border-dm-border/50"
              >
                <button
                  type="button"
                  onClick={toggleQuickChat}
                  className="px-2 py-1.5 text-sm text-zinc-500 transition-colors hover:text-dm-accent"
                  title="Hızlı mesajlar"
                >
                  ⚡
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  maxLength={100}
                  placeholder="Mesaj yaz..."
                  className="flex-1 bg-transparent px-1 py-1.5 font-pixel text-[7px] text-white placeholder-zinc-600 outline-none sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
                />
                <button
                  type="submit"
                  className="px-2 font-pixel text-[7px] text-dm-accent transition-colors hover:text-white sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
                >
                  Gönder
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full mode (lobby)
  return (
    <div
      className="w-full overflow-hidden rounded-lg border border-white/[0.06] bg-dm-surface"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(2,6,23,0.4)',
      }}
    >
      {/* Header */}
      <button
        onClick={toggleOpen}
        className="flex w-full items-center justify-between border-b border-dm-border/50 px-3 py-2 transition-colors hover:bg-dm-bg/50"
      >
        <span className="font-pixel text-[9px] text-dm-accent sm:text-[10px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">💬 Sohbet</span>
        <motion.span
          className="text-xs text-zinc-500"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {/* Messages */}
            <div className="flex h-40 flex-col gap-1 overflow-y-auto p-3 lg:h-48 2xl:h-56">
              {displayMessages.length === 0 && (
                <p className="font-pixel text-[8px] text-zinc-600 sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]">
                  Henüz mesaj yok... Merhaba de!
                </p>
              )}
              {displayMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className="font-pixel text-[8px] leading-relaxed sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <span style={{ color: getNameColor(msg.playerId, msg.playerClass) }}>
                    {msg.name}
                  </span>
                  <span className="text-zinc-500">: </span>
                  <span className="text-zinc-300">{msg.text}</span>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick chat presets */}
            <div className="flex flex-wrap gap-1 border-t border-dm-border/50 px-3 py-2">
              {QUICK_CHAT_PRESETS.map((preset) => (
                <button
                  key={preset.text}
                  onClick={() => handleQuickChat(preset.text)}
                  className="rounded border border-dm-border/40 bg-dm-surface/50 px-2 py-1 font-pixel text-[7px] text-zinc-300 transition-colors hover:bg-dm-accent/20 hover:text-white sm:text-[8px] lg:text-[9px] xl:text-[10px] 2xl:text-[12px]"
                >
                  {preset.emoji} {preset.text}
                </button>
              ))}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex border-t border-dm-border/50"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                maxLength={100}
                placeholder="Mesaj yaz..."
                className="flex-1 bg-transparent px-3 py-2 font-pixel text-[8px] text-white placeholder-zinc-600 outline-none sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]"
              />
              <button
                type="submit"
                className="px-3 font-pixel text-[8px] text-dm-accent transition-colors hover:text-white sm:text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[13px]"
              >
                Gönder
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
