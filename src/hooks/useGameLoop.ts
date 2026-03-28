'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import type { GameState, PlayerInput } from '../../shared/types';

type UseGameLoopOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  gameState: GameState | null;
  localPlayerId: string;
  onInput: (input: PlayerInput) => void;
};

type UseGameLoopReturn = {
  fps: number;
  isTouchDevice: boolean;
};

export function useGameLoop({
  canvasRef,
  gameState,
  localPlayerId,
  onInput,
}: UseGameLoopOptions): UseGameLoopReturn {
  const [fps, setFps] = useState(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const rendererRef = useRef<unknown>(null);
  const inputManagerRef = useRef<unknown>(null);
  const touchControlsRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const fpsTimeRef = useRef(0);
  const gameStateRef = useRef<GameState | null>(null);
  const isPausedRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Keep gameState ref updated
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Initialize renderer, input, and touch controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Detect touch device
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(isTouch);

    // Add game-canvas-active class to prevent mobile browser defaults
    if (isTouch) {
      document.documentElement.classList.add('game-canvas-active');
      document.body.classList.add('game-canvas-active');
    }

    let renderer: {
      render: (state: GameState, playerId: string, dt: number) => void;
      resize: (w: number, h: number) => void;
      destroy: () => void;
      cameraInstance?: { setZoom: (z: number) => void };
    } | null = null;

    let inputManager: {
      getInput: () => PlayerInput;
      destroy: () => void;
    } | null = null;

    let touchControls: {
      attach: () => void;
      detach: () => void;
      getInput: () => PlayerInput;
      update: (dt: number) => void;
      render: () => void;
      zoom: number;
    } | null = null;

    let touchOverlayCanvas: HTMLCanvasElement | null = null;

    // Dynamic imports for game engine modules
    const initEngine = async () => {
      try {
        const imports = [
          import('@/game/renderer/GameRenderer'),
          import('@/game/input/InputManager'),
        ] as const;

        // Also import touch controls if on touch device
        const touchImport = isTouch
          ? import('@/game/input/TouchControls')
          : null;

        const [rendererModule, inputModule] = await Promise.all(imports);

        const { GameRenderer } = rendererModule;
        const { InputManager } = inputModule;

        renderer = new GameRenderer(canvas);
        rendererRef.current = renderer;

        inputManager = new InputManager(canvas);
        inputManagerRef.current = inputManager;

        // Initialize touch controls
        if (isTouch && touchImport) {
          const touchModule = await touchImport;
          const { TouchControls } = touchModule;

          // Create touch overlay canvas
          touchOverlayCanvas = document.createElement('canvas');
          touchOverlayCanvas.className = 'touch-overlay';
          touchOverlayCanvas.style.position = 'fixed';
          touchOverlayCanvas.style.inset = '0';
          touchOverlayCanvas.style.zIndex = '50';
          touchOverlayCanvas.style.touchAction = 'none';
          canvas.parentElement?.appendChild(touchOverlayCanvas);

          touchControls = new TouchControls(touchOverlayCanvas);
          touchControls.attach();
          touchControlsRef.current = touchControls;
        }
      } catch {
        // Game engine modules not available yet
      }
    };

    initEngine();

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      renderer?.resize(canvas.width, canvas.height);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Handle orientation change
    const handleOrientationChange = () => {
      // Small delay to let the browser finish rotating
      setTimeout(() => {
        handleResize();
      }, 100);
    };
    window.addEventListener('orientationchange', handleOrientationChange);

    // Visibility change handler — pause when tab hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isPausedRef.current = true;
      } else {
        isPausedRef.current = false;
        lastTimeRef.current = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Request wake lock on mobile to prevent screen dimming
    const requestWakeLock = async () => {
      if (!isTouch || !('wakeLock' in navigator)) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch {
        // Wake lock not available or denied
      }
    };
    requestWakeLock();

    // Re-request wake lock when page becomes visible again
    const handleWakeLockReacquire = () => {
      if (!document.hidden && !wakeLockRef.current && isTouch) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleWakeLockReacquire);

    // Game loop
    const loop = (time: number) => {
      if (isPausedRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // FPS counter
      frameCountRef.current++;
      if (time - fpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        fpsTimeRef.current = time;
      }

      // Get input from keyboard/gamepad
      let input: PlayerInput | null = null;
      if (inputManager) {
        input = inputManager.getInput();
      }

      // Get input from touch controls and merge
      if (touchControls) {
        touchControls.update(dt);
        const touchInput = touchControls.getInput();

        if (input) {
          // Merge: touch overrides keyboard if touch has non-zero movement
          if (touchInput.dx !== 0 || touchInput.dy !== 0) {
            input.dx = touchInput.dx;
            input.dy = touchInput.dy;
          }
          input.attack = input.attack || touchInput.attack;
          input.ability = input.ability || touchInput.ability;
          if (touchInput.interact) input.interact = true;
        } else {
          input = touchInput;
        }

        // Sync pinch-to-zoom with camera
        if (renderer?.cameraInstance && touchControls.zoom !== 1) {
          renderer.cameraInstance.setZoom(touchControls.zoom);
        }
      }

      if (input) {
        onInput(input);
      }

      // Render game
      const currentState = gameStateRef.current;
      if (renderer && currentState) {
        renderer.render(currentState, localPlayerId, dt);
      } else if (canvas) {
        // Fallback: clear canvas with background color
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0a0e17';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          if (!currentState) {
            ctx.fillStyle = '#8b5cf6';
            ctx.font = '16px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(
              'Bağlanılıyor...',
              canvas.width / 2,
              canvas.height / 2,
            );
          }
        }
      }

      // Render touch controls overlay (on top of everything)
      if (touchControls) {
        touchControls.render();
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleWakeLockReacquire);

      renderer?.destroy();
      inputManager?.destroy();

      if (touchControls) {
        touchControls.detach();
      }
      if (touchOverlayCanvas) {
        touchOverlayCanvas.remove();
      }

      // Release wake lock
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => { /* ignore */ });
        wakeLockRef.current = null;
      }

      // Remove game-canvas-active class
      document.documentElement.classList.remove('game-canvas-active');
      document.body.classList.remove('game-canvas-active');
    };
  }, [canvasRef, localPlayerId, onInput]);

  return { fps, isTouchDevice };
}
