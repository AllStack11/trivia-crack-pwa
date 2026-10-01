import { useEffect, useRef, useState, useCallback } from 'react';
import type { WheelSlice } from '../../../shared/src/index';
import { playButtonPop, playWheelTick } from '../utils/audio';

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
  const currentRotationRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastPegCrossedRef = useRef<number>(-1);
  const [flapperDeflection, setFlapperDeflection] = useState<number>(0);

  // Draw the entire wheel on canvas
  const drawWheel = useCallback((rotationAngleRad: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 16;
    const sliceCount = SLICE_CONFIGS.length;
    const sliceAngle = (2 * Math.PI) / sliceCount;

    ctx.clearRect(0, 0, width, height);

    // Outer shadow / rim
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI);
    ctx.fillStyle = '#1E1B4B';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fill();
    ctx.restore();

    // Outer Golden Ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
    const rimGrad = ctx.createLinearGradient(0, 0, width, height);
    rimGrad.addColorStop(0, '#FDE047');
    rimGrad.addColorStop(0.5, '#CA8A04');
    rimGrad.addColorStop(1, '#854D0E');
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 10;
    ctx.stroke();

    // Rotate context for wedges
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngleRad);

    // Draw Slices
    for (let i = 0; i < sliceCount; i++) {
      const config = SLICE_CONFIGS[i];
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      // Wedge radial gradient
      const wedgeGrad = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
      wedgeGrad.addColorStop(0, config.color);
      wedgeGrad.addColorStop(1, config.accentColor);
      ctx.fillStyle = wedgeGrad;
      ctx.fill();

      // Wedge divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Slice Content (Text & Icon)
      ctx.save();
      const midAngle = startAngle + sliceAngle / 2;
      ctx.rotate(midAngle);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      // Draw Icon
      ctx.font = '28px sans-serif';
      ctx.fillText(config.icon, radius - 22, 0);

      // Draw Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 4;
      ctx.fillText(config.label, radius - 58, 0);

      ctx.restore();
    }

    // Outer Rim Pegs / Studs (14 studs around rim)
    const pegCount = 14;
    for (let p = 0; p < pegCount; p++) {
      const pegAngle = (p * 2 * Math.PI) / pegCount;
      const px = Math.cos(pegAngle) * (radius + 2);
      const py = Math.sin(pegAngle) * (radius + 2);

      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#FEF08A';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    ctx.restore(); // Restore translate & rotate

    // Center Hub Rim
    ctx.beginPath();
    ctx.arc(centerX, centerY, 52, 0, 2 * Math.PI);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Center Hub Button
    const hubGrad = ctx.createLinearGradient(centerX - 42, centerY - 42, centerX + 42, centerY + 42);
    hubGrad.addColorStop(0, '#4F46E5');
    hubGrad.addColorStop(1, '#312E81');
    ctx.beginPath();
    ctx.arc(centerX, centerY, 44, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();

    // "SPIN" text in center
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = canSpin && !isSpinning ? '#FFFFFF' : '#94A3B8';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText('SPIN', centerX, centerY);
  }, [canSpin, isSpinning]);

  // Handle high DPI retina display sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width || 340, rect.height || 340, 380);

    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    drawWheel(currentRotationRef.current);
  }, [drawWheel]);

  // Run spin physics animation when targetDegrees is provided
  useEffect(() => {
    if (!isSpinning || targetDegrees === undefined) return;

    const startAngle = currentRotationRef.current;
    const targetRad = (targetDegrees * Math.PI) / 180;
    const deltaAngle = targetRad - startAngle;
    const duration = 4400; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Quintic ease out for realistic decelerating spin
      const easeOut = 1 - Math.pow(1 - progress, 4);
      const currentAngle = startAngle + deltaAngle * easeOut;
      currentRotationRef.current = currentAngle;

      // Track peg crossing at top pointer (angle = 3 * PI / 2 or top pointer)
      const currentDeg = ((currentAngle * 180) / Math.PI) % 360;
      const pegIndex = Math.floor((currentDeg * 14) / 360);

      if (pegIndex !== lastPegCrossedRef.current) {
        lastPegCrossedRef.current = pegIndex;
        playWheelTick((14 - (pegIndex % 14)) * 0.1);
        setFlapperDeflection(-16);
        setTimeout(() => setFlapperDeflection(0), 40);

        if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate(8);
        }
      }

      drawWheel(currentAngle);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation finished
        const normalizedDeg = (360 - ((currentAngle * 180) / Math.PI) % 360) % 360;
        const sliceArc = 360 / SLICE_CONFIGS.length;
        const landedIndex = Math.floor(normalizedDeg / sliceArc) % SLICE_CONFIGS.length;
        const landedSlice = SLICE_CONFIGS[landedIndex].slice;
        onSpinComplete(landedSlice);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSpinning, targetDegrees, drawWheel, onSpinComplete]);

  const handleCenterClick = () => {
    if (!canSpin || isSpinning) return;
    playButtonPop();
    onSpinStart();
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-2 select-none touch-manipulation">
      {/* Top Deflector Flapper */}
      <div
        className="absolute top-0 z-20 flex flex-col items-center transition-transform duration-75 origin-top pointer-events-none"
        style={{ transform: `rotate(${flapperDeflection}deg)` }}
      >
        {/* Flapper mount pin */}
        <div className="w-5 h-5 rounded-full bg-yellow-400 border-2 border-yellow-600 shadow-md flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-slate-900" />
        </div>
        {/* Flapper needle */}
        <div
          className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[22px] border-t-red-600 drop-shadow-md -mt-1"
        />
      </div>

      {/* Main Wheel Canvas */}
      <div
        className="relative cursor-pointer transition-transform active:scale-[0.98]"
        onClick={handleCenterClick}
      >
        <canvas
          ref={canvasRef}
          className="w-[330px] h-[330px] sm:w-[360px] sm:h-[360px] max-w-full drop-shadow-2xl"
          style={{ width: '340px', height: '340px' }}
        />

        {/* Pulse ring when canSpin */}
        {canSpin && !isSpinning && (
          <div className="absolute inset-0 rounded-full border-4 border-yellow-400/40 animate-ping pointer-events-none" />
        )}
      </div>

      {/* Helper caption */}
      <div className="mt-3 text-center">
        {isSpinning ? (
          <p className="text-sm font-semibold text-yellow-400 animate-pulse">Wheel is spinning...</p>
        ) : canSpin ? (
          <button
            onClick={handleCenterClick}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold text-base rounded-full shadow-lg hover:shadow-yellow-500/25 transition-all transform active:scale-95 flex items-center gap-2"
          >
            <span>Tap Center or Here to Spin</span>
            <span>🎲</span>
          </button>
        ) : (
          <p className="text-xs text-slate-400">Waiting for opponent's move...</p>
        )}
      </div>
    </div>
  );
}
