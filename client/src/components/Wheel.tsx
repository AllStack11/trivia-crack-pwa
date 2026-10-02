import { WHEEL_SPIN_DURATION_MS } from '../../../shared/src/index';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Hand } from 'lucide-react';
import type { Category, WheelSlice } from '../../../shared/src/index';
import { playButtonPop, playWheelTick, triggerHaptic } from '../utils/audio';
import { requestWakeLock, releaseWakeLock } from '../hooks/usePWA';
import CategoryCharacter from './characters/CategoryCharacter';
import { CHARACTER_PROFILES } from './characters/characterData';
import Button from './ui/Button';
interface WheelProps {
  canSpin: boolean;
  isSpinning: boolean;
  targetDegrees?: number;
  onSpinStart: () => void;
  onSpinComplete: (slice: WheelSlice) => void;
}

interface SliceConfig {
  slice: WheelSlice;
  label: string;
  sublabel: string;
  icon: string;
  color: string;
  accentColor: string;
}

const SLICE_CONFIGS: SliceConfig[] = [
  { slice: 'GEOGRAPHY', label: 'GEOGRAPHY', sublabel: 'Tina', icon: '🌍', color: '#3B82F6', accentColor: '#1D4ED8' },
  { slice: 'SCIENCE', label: 'SCIENCE', sublabel: 'Albert', icon: '🔬', color: '#10B981', accentColor: '#047857' },
  { slice: 'HISTORY', label: 'HISTORY', sublabel: 'Hector', icon: '⏳', color: '#EAB308', accentColor: '#A16207' },
  { slice: 'SPORTS', label: 'SPORTS', sublabel: 'Bonzo', icon: '🏆', color: '#F97316', accentColor: '#C2410C' },
  { slice: 'ART', label: 'ART', sublabel: 'Arthur', icon: '🎨', color: '#EF4444', accentColor: '#B91C1C' },
  { slice: 'ENTERTAINMENT', label: 'ENTERTAINMENT', sublabel: 'Pop', icon: '🎬', color: '#EC4899', accentColor: '#BE185D' },
  { slice: 'CROWN', label: 'CROWN', sublabel: 'Prize', icon: '👑', color: '#F59E0B', accentColor: '#B45309' }
];

export default function Wheel({
  canSpin,
  isSpinning,
  targetDegrees,
  onSpinStart,
  onSpinComplete
}: WheelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentRotationRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastPegCrossedRef = useRef<number>(-1);

  // Gesture drag & flick physics refs
  const isDraggingRef = useRef<boolean>(false);
  const dragStartAngleRef = useRef<number>(0);
  const dragBaseRotationRef = useRef<number>(0);
  const dragPointsRef = useRef<Array<{ angle: number; time: number }>>([]);
  const totalDragDisplacementRef = useRef<number>(0);
  const dragCenterRef = useRef<{ cx: number; cy: number }>({ cx: 0, cy: 0 });

  const [flapperDeflection, setFlapperDeflection] = useState<number>(0);
  const [landedSlice, setLandedSlice] = useState<WheelSlice | null>(null);
  const [isGestureActive, setIsGestureActive] = useState<boolean>(false);
  const drawWheel = useCallback((rotationAngleRad: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 12;
    const sliceCount = SLICE_CONFIGS.length;
    const sliceAngle = (2 * Math.PI) / sliceCount;

    ctx.clearRect(0, 0, width, height);

    // 1. Outer Deep Ambient Shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI);
    ctx.fillStyle = '#060A14';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fill();
    ctx.restore();

    // 2. Beveled Metallic Golden Ring with Neon Trim
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 6, 0, 2 * Math.PI);
    const rimGrad = ctx.createLinearGradient(0, 0, width, height);
    rimGrad.addColorStop(0, '#FEF08A');
    rimGrad.addColorStop(0.3, '#EAB308');
    rimGrad.addColorStop(0.7, '#CA8A04');
    rimGrad.addColorStop(1, '#78350F');
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = Math.max(7, Math.round(radius * 0.06));
    ctx.stroke();

    // Inner subtle glow border
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 1, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 3. Rotate context for Wedges
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngleRad);

    const iconSize = Math.max(14, Math.round(radius * 0.12));
    const labelSize = Math.max(8, Math.round(radius * 0.058));
    const iconPos = radius * 0.82;
    const labelCenterPos = radius * 0.46;

    for (let i = 0; i < sliceCount; i++) {
      const config = SLICE_CONFIGS[i];
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      // Wedge radial gradient
      const wedgeGrad = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius);
      wedgeGrad.addColorStop(0, config.color);
      wedgeGrad.addColorStop(1, config.accentColor);
      ctx.fillStyle = wedgeGrad;
      ctx.fill();

      // Crisp slice divider with specular shine
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Slice Content (Text & Icon)
      ctx.save();
      const midAngle = startAngle + sliceAngle / 2;
      ctx.rotate(midAngle);
      ctx.textBaseline = 'middle';

      // Draw Icon near the rim
      ctx.textAlign = 'center';
      ctx.font = `${iconSize}px sans-serif`;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(config.icon, iconPos, 0);

      // Draw Label centered in clear wedge band
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 ${labelSize}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText(config.label, labelCenterPos, 0);

      ctx.restore();
    }

    // 4. Outer Rim Jewels / LED Pegs (14 pegs around the circumference)
    const pegCount = 14;
    for (let p = 0; p < pegCount; p++) {
      const pegAngle = (p * 2 * Math.PI) / pegCount;
      const px = Math.cos(pegAngle) * (radius + 2);
      const py = Math.sin(pegAngle) * (radius + 2);

      // Jewel base
      ctx.beginPath();
      ctx.arc(px, py, Math.max(3, radius * 0.028), 0, 2 * Math.PI);
      ctx.fillStyle = p % 2 === 0 ? '#FDE047' : '#FFFFFF';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      ctx.fill();

      // Jewel specular glint
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1.2, radius * 0.012), 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    ctx.restore(); // Restore translate & rotate

    // 5. Center Hub
    const hubOuterRadius = Math.round(radius * 0.24);
    const hubInnerRadius = Math.round(radius * 0.19);
    const spinFontSize = Math.max(10, Math.round(radius * 0.095));

    // Outer Hub Gold Ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, hubOuterRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = Math.max(2.5, Math.round(radius * 0.025));
    ctx.stroke();

    // Center Hub Button Gradient
    const hubGrad = ctx.createLinearGradient(
      centerX - hubInnerRadius,
      centerY - hubInnerRadius,
      centerX + hubInnerRadius,
      centerY + hubInnerRadius
    );
    if (canSpin && !isSpinning) {
      hubGrad.addColorStop(0, '#F59E0B');
      hubGrad.addColorStop(0.5, '#D97706');
      hubGrad.addColorStop(1, '#92400E');
    } else {
      hubGrad.addColorStop(0, '#334155');
      hubGrad.addColorStop(1, '#0F172A');
    }
    ctx.beginPath();
    ctx.arc(centerX, centerY, hubInnerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.shadowColor = canSpin && !isSpinning ? 'rgba(245, 158, 11, 0.6)' : 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = canSpin && !isSpinning ? 12 : 4;
    ctx.fill();

    // "SPIN" text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = canSpin && !isSpinning ? '#FFFFFF' : '#94A3B8';
    ctx.font = `900 ${spinFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('SPIN', centerX, centerY);
    ctx.restore();
  }, [canSpin, isSpinning]);

  // Handle responsive canvas resizing
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const size = Math.round(Math.min(rect.width || 270, rect.height || 270));

    if (size > 0) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      drawWheel(currentRotationRef.current);
    }
  }, [drawWheel]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Spin Animation Engine with WakeLock
  useEffect(() => {
    if (!isSpinning || targetDegrees === undefined) return;
    setLandedSlice(null);
    void requestWakeLock();

    const startAngle = currentRotationRef.current;
    const targetRad = (targetDegrees * Math.PI) / 180;
    const deltaAngle = targetRad - startAngle;
    const duration = WHEEL_SPIN_DURATION_MS; // ms
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Decelerating quintic ease-out curve
      const easeOut = 1 - Math.pow(1 - progress, 4);
      const currentAngle = startAngle + deltaAngle * easeOut;
      currentRotationRef.current = currentAngle;

      // Track flapper peg hits
      const currentDeg = ((currentAngle * 180) / Math.PI) % 360;
      const pegIndex = Math.floor((currentDeg * 14) / 360);

      if (pegIndex !== lastPegCrossedRef.current) {
        lastPegCrossedRef.current = pegIndex;
        playWheelTick((14 - (pegIndex % 14)) * 0.1);
        setFlapperDeflection(-18);
        setTimeout(() => setFlapperDeflection(0), 40);

        if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate(8);
        }
      }

      drawWheel(currentAngle);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Spin finished
        const normalizedDeg = (360 - ((currentAngle * 180) / Math.PI) % 360) % 360;
        const sliceArc = 360 / SLICE_CONFIGS.length;
        const landedIndex = Math.floor(normalizedDeg / sliceArc) % SLICE_CONFIGS.length;
        const resultSlice = SLICE_CONFIGS[landedIndex].slice;
        setLandedSlice(resultSlice);
        void releaseWakeLock();
        onSpinComplete(resultSlice);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      void releaseWakeLock();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSpinning, targetDegrees, drawWheel, onSpinComplete]);

  const handleCenterClick = useCallback(() => {
    if (!canSpin || isSpinning) return;
    playButtonPop();
    triggerHaptic('heavy');
    onSpinStart();
  }, [canSpin, isSpinning, onSpinStart]);

  // Pointer / Touch Drag & Flick Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canSpin || isSpinning) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const px = e.clientX;
    const py = e.clientY;

    const dist = Math.hypot(px - cx, py - cy);
    const radius = rect.width / 2;

    // Only initiate drag if pointer is inside the wheel circle
    if (dist > radius) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture might fail if not supported
    }

    const angle = Math.atan2(py - cy, px - cx);
    isDraggingRef.current = true;
    dragStartAngleRef.current = angle;
    dragBaseRotationRef.current = currentRotationRef.current;
    dragCenterRef.current = { cx, cy };
    dragPointsRef.current = [{ angle, time: performance.now() }];
    totalDragDisplacementRef.current = 0;
    setIsGestureActive(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !canSpin || isSpinning) return;
    const { cx, cy } = dragCenterRef.current;
    const currentAngle = Math.atan2(e.clientY - cy, e.clientX - cx);

    // Normalize angle delta
    let delta = currentAngle - dragStartAngleRef.current;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;

    totalDragDisplacementRef.current += Math.abs(delta);
    const newRotation = dragBaseRotationRef.current + delta;
    currentRotationRef.current = newRotation;

    // Record points for velocity estimation (keep last 5)
    const now = performance.now();
    dragPointsRef.current.push({ angle: currentAngle, time: now });
    if (dragPointsRef.current.length > 6) {
      dragPointsRef.current.shift();
    }

    // Flapper peg deflection during manual drag
    const currentDeg = ((newRotation * 180) / Math.PI) % 360;
    const pegIndex = Math.floor((Math.abs(currentDeg) * 14) / 360);
    if (pegIndex !== lastPegCrossedRef.current) {
      lastPegCrossedRef.current = pegIndex;
      playWheelTick(0.2);
      setFlapperDeflection(delta > 0 ? -12 : 12);
      setTimeout(() => setFlapperDeflection(0), 50);
    }

    drawWheel(newRotation);
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsGestureActive(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Pointer capture release
    }

    if (!canSpin || isSpinning) return;

    // Calculate release velocity
    const pts = dragPointsRef.current;
    let angularVelocity = 0;
    if (pts.length >= 2) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      const dt = last.time - first.time;
      if (dt > 0) {
        let da = last.angle - first.angle;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        angularVelocity = Math.abs(da / dt); // rad/ms
      }
    }

    const totalDisplacement = totalDragDisplacementRef.current;

    // Flick trigger threshold: velocity > 0.001 rad/ms or total angular displacement > 0.3 rad (~17 deg)
    if (angularVelocity > 0.0012 || totalDisplacement > 0.3) {
      playButtonPop();
      triggerHaptic('heavy');
      onSpinStart();
    } else if (totalDisplacement < 0.15) {
      // It was a tap / click on the wheel
      handleCenterClick();
    }
  };

  const landedProfile = landedSlice && landedSlice !== 'CROWN'
    ? CHARACTER_PROFILES[landedSlice as Category]
    : null;

  return (
    <div className="relative flex flex-col items-center justify-center p-2 select-none touch-manipulation w-full">
      <div
        className="absolute top-1 z-30 flex flex-col items-center transition-transform duration-75 origin-top pointer-events-none"
        style={{ transform: `rotate(${flapperDeflection}deg)` }}
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-yellow-300 via-amber-400 to-yellow-500 border-2 border-yellow-200 shadow-lg flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
        </div>
        <div className="w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-t-[20px] border-t-red-600 drop-shadow-lg -mt-1" />
      </div>

      {/* Main Wheel Canvas with ambient neon halo */}
      {/* Main Wheel Canvas with gesture physics & ambient neon halo */}
      <motion.div
        ref={containerRef}
        whileHover={canSpin && !isSpinning ? { scale: 1.02 } : undefined}
        whileTap={canSpin && !isSpinning ? { scale: 0.98 } : undefined}
        className="relative cursor-grab active:cursor-grabbing w-[270px] h-[270px] xs:w-[295px] xs:h-[295px] sm:w-[335px] sm:h-[335px] max-w-[85vw] max-h-[50vh] flex items-center justify-center touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
      >
        {/* Pulsing golden aura when it's your turn to spin */}
        {canSpin && !isSpinning && (
          <motion.div
            animate={{
              scale: isGestureActive ? 1.08 : [1, 1.06, 1],
              opacity: isGestureActive ? 0.8 : [0.35, 0.7, 0.35]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -inset-3 rounded-full blur-xl bg-amber-400/40 pointer-events-none"
          />
        )}

        {/* Interactive Flick/Tap floating hint pill */}
        {canSpin && !isSpinning && !isGestureActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -top-3 z-30 pointer-events-none"
          >
            <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-slate-950/90 border border-amber-400/50 shadow-lg text-[11px] font-bold text-amber-300">
              <Hand className="w-3.5 h-3.5 animate-bounce text-amber-400" />
              <span>Flick or Tap to Spin</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>
          </motion.div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-full drop-shadow-2xl rounded-full relative z-10 touch-none pointer-events-none"
        />
      </motion.div>

      {/* Action / Status Controls */}
      <div className="mt-3 text-center w-full max-w-xs">
        {isSpinning ? (
          <div className="py-2.5 px-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-black text-amber-300 tracking-wide uppercase">
              Wheel Spinning…
            </span>
          </div>
        ) : canSpin ? (
          <Button
            variant="primary"
            size="lg"
            glow
            onClick={handleCenterClick}
            className="w-full shadow-amber-500/30"
          >
            <span>🎲 SPIN THE WHEEL!</span>
          </Button>
        ) : (
          <div className="py-2 px-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] font-bold text-slate-400">
            ⏳ Waiting for opponent's turn…
          </div>
        )}
      </div>

      {/* Character Landing Celebration Card */}
      <AnimatePresence>
        {landedSlice && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 450, damping: 25 }}
            className="mt-3 w-full max-w-sm p-3.5 rounded-2xl bg-slate-900/95 border border-white/15 backdrop-blur-xl shadow-2xl flex items-center gap-3 relative z-30"
          >
            {landedSlice === 'CROWN' ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-2xl shadow-lg border border-yellow-200 shrink-0">
                  👑
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-amber-400 uppercase tracking-wider">Landed on Crown!</div>
                  <div className="text-sm font-extrabold text-white">Crown Challenge Unlocked!</div>
                  <p className="text-[10px] text-slate-300">Choose a character to duel or steal.</p>
                </div>
              </>
            ) : landedProfile ? (
              <>
                <CategoryCharacter
                  category={landedSlice}
                  size="md"
                  mood="celebrating"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white">{landedProfile.name}</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.2 rounded-full text-white"
                      style={{ backgroundColor: landedProfile.color }}
                    >
                      {landedSlice}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-amber-300 italic mt-0.5 truncate">
                    "{landedProfile.quotes.greeting}"
                  </div>
                </div>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
