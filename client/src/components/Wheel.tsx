import { CLASSIC_CATEGORIES, CATEGORIES, WHEEL_SPIN_DURATION_MS } from '../../../shared/src/index';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Zap } from 'lucide-react';
import type { Category, WheelSlice } from '../../../shared/src/index';
import { playButtonPop, playWheelTick, triggerHaptic, startWheelMotion } from '../utils/audio';
import { requestWakeLock, releaseWakeLock } from '../hooks/usePWA';
interface WheelProps {
  categories?: Category[];
  canSpin: boolean;
  isSpinning: boolean;
  pending?: boolean;
  targetDegrees?: number;
  onSpinStart: () => void;
  onSpinComplete: (slice: WheelSlice) => void;
}

interface SliceConfig {
  slice: WheelSlice;
  color: string;
  accentColor: string;
}


export default function Wheel({
  categories = CLASSIC_CATEGORIES,
  canSpin: allowedToSpin,
  isSpinning,
  pending = false,
  targetDegrees,
  onSpinStart,
  onSpinComplete
}: WheelProps) {
  const categoryKey = categories.join('|');
  const SLICE_CONFIGS = useMemo<SliceConfig[]>(() => ([...categories, 'CROWN'] as WheelSlice[]).map(slice => ({ slice, color: slice === 'CROWN' ? '#F59E0B' : CATEGORIES[slice].color, accentColor: slice === 'CROWN' ? '#B45309' : CATEGORIES[slice].accentColor })), [categoryKey]);
  const reducedMotion = useReducedMotion();
  const [mediaReady, setMediaReady] = useState(false);
  const canSpin = allowedToSpin && mediaReady;
  const categoryImages = useRef<Partial<Record<WheelSlice, HTMLImageElement>>>({});
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
    ctx.fillStyle = '#173e55';
    ctx.shadowColor = 'rgba(35, 86, 83, 0.25)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fill();
    ctx.restore();

    // 2. Beveled Metallic Golden Ring with Neon Trim
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 6, 0, 2 * Math.PI);
    const rimGrad = ctx.createLinearGradient(0, 0, width, height);
    rimGrad.addColorStop(0, '#fff8d1');
    rimGrad.addColorStop(0.3, '#ffc76a');
    rimGrad.addColorStop(0.7, '#c48428');
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

    const iconPos = radius * .66;

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
      // A polished inset edge and outer highlight give each segment depth.
      ctx.beginPath();
      ctx.arc(0, 0, radius * .95, startAngle + .025, endAngle - .025);
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = radius * .026;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius * .61, startAngle + .025, endAngle - .025);
      ctx.strokeStyle = 'rgba(0,0,0,.10)';
      ctx.lineWidth = radius * .28;
      ctx.stroke();

      // Crisp slice divider with specular shine
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Large, text-free category artwork. It faces outward with its segment.
      ctx.save();
      const midAngle = startAngle + sliceAngle / 2;
      ctx.translate(Math.cos(midAngle) * iconPos, Math.sin(midAngle) * iconPos);
      ctx.rotate(midAngle + Math.PI / 2);
      const icon = categoryImages.current[config.slice];
      if (icon?.complete && icon.naturalWidth) {
        const artSize = radius * .53;
        ctx.shadowColor = 'rgba(0,0,0,.28)';
        ctx.shadowBlur = radius * .025;
        ctx.shadowOffsetY = radius * .015;
        ctx.drawImage(icon, -artSize / 2, -artSize / 2, artSize, artSize);
      }
      else {
        ctx.fillStyle = '#FFFFFF'; ctx.font = `bold ${radius * .065}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(config.slice === 'CROWN' ? 'Crown' : CATEGORIES[config.slice].name, 0, 0);
      }
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

    // An embossed lightning emblem keeps the hub free of lettering too.
    const boltSize = hubInnerRadius * .65;
    ctx.beginPath();
    ctx.moveTo(centerX + boltSize * .2, centerY - boltSize);
    ctx.lineTo(centerX - boltSize * .65, centerY + boltSize * .15);
    ctx.lineTo(centerX - boltSize * .05, centerY + boltSize * .15);
    ctx.lineTo(centerX - boltSize * .2, centerY + boltSize);
    ctx.lineTo(centerX + boltSize * .65, centerY - boltSize * .15);
    ctx.lineTo(centerX + boltSize * .05, centerY - boltSize * .15);
    ctx.closePath();
    ctx.fillStyle = canSpin && !isSpinning ? '#fff5bc' : '#a6bdc8';
    ctx.shadowColor = '#442a1d';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.restore();
  }, [canSpin, isSpinning, SLICE_CONFIGS]);

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
    // Normalize actual angular velocity against a brisk 32-radian/second spin.
    const peakSpeed = Math.min(1, Math.abs(deltaAngle) * 4 / (duration / 1000) / 32);
    const stopMotion = startWheelMotion(duration, peakSpeed);
    lastPegCrossedRef.current = Math.floor(startAngle * 14 / (2 * Math.PI));
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      stopMotion.update(progress);

      // Decelerating quartic ease-out curve
      const easeOut = 1 - Math.pow(1 - progress, 4);
      const currentAngle = reducedMotion ? targetRad : startAngle + deltaAngle * easeOut;
      currentRotationRef.current = currentAngle;

      // Track flapper peg hits
      const pegIndex = Math.floor(currentAngle * 14 / (2 * Math.PI));

      if (pegIndex !== lastPegCrossedRef.current) {
        // Account for multiple peg crossings at high speed, with no backlog after a stalled frame.
        const crossings = Math.min(3, Math.abs(pegIndex - lastPegCrossedRef.current));
        lastPegCrossedRef.current = pegIndex;
        for (let hit = 0; hit < crossings; hit++) playWheelTick(peakSpeed * Math.pow(1 - progress, 3), hit * .004);
        setFlapperDeflection(-18);
        setTimeout(() => setFlapperDeflection(0), 40);

      }

      drawWheel(currentAngle);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        stopMotion();
        // Spin finished
        const normalizedDeg = ((270 - (currentAngle * 180) / Math.PI) % 360 + 360) % 360;
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
      stopMotion();
      void releaseWakeLock();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSpinning, targetDegrees, drawWheel, onSpinComplete, reducedMotion]);

  const drawWheelRef = useRef(drawWheel);
  drawWheelRef.current = drawWheel;

  useEffect(() => {
    let active = true;
    let settled = 0;
    setMediaReady(false);
    const complete = () => {
      if (!active || ++settled !== SLICE_CONFIGS.length) return;
      drawWheelRef.current(currentRotationRef.current);
      setMediaReady(true);
    };
    for (const config of SLICE_CONFIGS) {
      const image = new Image();
      categoryImages.current[config.slice] = image;
      image.onload = complete;
      image.onerror = complete;
      const extension = ['MEMES', 'CUSTOM', 'MOVIES_TV', 'VIDEO_GAMES'].includes(config.slice) ? 'png' : 'webp';
      image.src = `/art/wheel-icons/${config.slice.toLowerCase()}.${extension}`;
    }
    return () => { active = false; };
  }, [SLICE_CONFIGS]);

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
    lastPegCrossedRef.current = Math.floor(currentRotationRef.current * 14 / (2 * Math.PI));
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
    dragStartAngleRef.current = currentAngle;
    dragBaseRotationRef.current = newRotation;

    // Record points for velocity estimation (keep last 5)
    const now = performance.now();
    dragPointsRef.current.push({ angle: currentAngle, time: now });
    if (dragPointsRef.current.length > 6) {
      dragPointsRef.current.shift();
    }

    // Flapper peg deflection during manual drag
    const pegIndex = Math.floor(newRotation * 14 / (2 * Math.PI));
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

    if (!canSpin || isSpinning || e.type === 'pointercancel') return;

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
    }
  };

  return (
    <div className="premium-wheel relative flex flex-col items-center justify-center select-none touch-manipulation w-full">
      {/* Main Wheel Canvas with ambient neon halo */}
      {/* Main Wheel Canvas with gesture physics & ambient neon halo */}
      <motion.div
        ref={containerRef}
        whileHover={canSpin && !isSpinning ? { scale: 1.02 } : undefined}
        whileTap={canSpin && !isSpinning ? { scale: 0.98 } : undefined}
        className="wheel-disc relative cursor-grab active:cursor-grabbing flex items-center justify-center touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
      >
      <div
        className="wheel-flapper"
        style={{ transform: `rotate(${flapperDeflection}deg)` }}
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-yellow-300 via-amber-400 to-yellow-500 border-2 border-yellow-200 shadow-lg flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
        </div>
        <div className="w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-t-[20px] border-t-red-600 drop-shadow-lg -mt-1" />
      </div>

        {/* Pulsing golden aura when it's your turn to spin */}
        {canSpin && !isSpinning && !reducedMotion && (
          <motion.div
            animate={{
              scale: isGestureActive ? 1.08 : [1, 1.06, 1],
              opacity: isGestureActive ? 0.8 : [0.35, 0.7, 0.35]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -inset-3 rounded-full blur-xl bg-amber-400/40 pointer-events-none"
          />
        )}

        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Trivia wheel: ${categories.map(category => CATEGORIES[category].name).join(', ')}, and Crown`}
          className="w-full h-full drop-shadow-2xl rounded-full relative z-10 touch-none pointer-events-none"
          style={{ visibility: mediaReady ? 'visible' : 'hidden' }}
        />
        <button type="button" className={`wheel-hub-button ${canSpin && !isSpinning ? 'wheel-hub-ready' : ''}`} aria-label={pending ? 'Starting spin' : isSpinning ? 'Wheel spinning' : 'Spin the wheel'} disabled={!canSpin || isSpinning} onPointerDown={event => event.stopPropagation()} onClick={handleCenterClick}>
          <Zap aria-hidden="true" />
        </button>
      </motion.div>

      <p className="wheel-instruction" role="status">{!mediaReady ? 'Preparing wheel…' : isSpinning ? 'Let the wheel cook...' : pending ? 'Starting your spin...' : landedSlice ? `Landed on ${landedSlice.toLowerCase()}` : canSpin ? 'Tap the glowing center or flick to spin' : 'Waiting for your opponent'}</p>
    </div>
  );
}
