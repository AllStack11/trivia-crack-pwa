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

  // Draw the entire wheel on canvas proportionally to canvas size
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
    const radius = Math.min(centerX, centerY) - 10;
    const sliceCount = SLICE_CONFIGS.length;
    const sliceAngle = (2 * Math.PI) / sliceCount;

    ctx.clearRect(0, 0, width, height);

    // Outer shadow / rim
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#1E1B4B';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fill();
    ctx.restore();

    // Outer Golden Ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 5, 0, 2 * Math.PI);
    const rimGrad = ctx.createLinearGradient(0, 0, width, height);
    rimGrad.addColorStop(0, '#FDE047');
    rimGrad.addColorStop(0.5, '#CA8A04');
    rimGrad.addColorStop(1, '#854D0E');
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = Math.max(5, Math.round(radius * 0.05));
    ctx.stroke();

    // Rotate context for wedges
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngleRad);

    // Font metrics based on radius - optimized to keep text pushed outward away from center hub
    const iconSize = Math.max(14, Math.round(radius * 0.13));
    const labelSize = Math.max(7.5, Math.round(radius * 0.065));
    const iconPos = radius * 0.88;
    const labelEndPos = radius * 0.77;
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
      ctx.lineWidth = 2;
      ctx.stroke();

      // Slice Content (Text & Icon)
      ctx.save();
      const midAngle = startAngle + sliceAngle / 2;
      ctx.rotate(midAngle);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      // Draw Icon near the outer rim
      ctx.font = `${iconSize}px sans-serif`;
      ctx.fillText(config.icon, iconPos, 0);

      // Draw Label pushed out towards the rim (away from center hub)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${labelSize}px system-ui, -apple-system, sans-serif`;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(config.label, labelEndPos, 0);

      ctx.restore();
    }

    // Outer Rim Pegs / Studs (14 studs around rim)
    const pegCount = 14;
    for (let p = 0; p < pegCount; p++) {
      const pegAngle = (p * 2 * Math.PI) / pegCount;
      const px = Math.cos(pegAngle) * (radius + 2);
      const py = Math.sin(pegAngle) * (radius + 2);

      ctx.beginPath();
      ctx.arc(px, py, Math.max(2.5, radius * 0.025), 0, 2 * Math.PI);
      ctx.fillStyle = '#FEF08A';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 2;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, Math.max(1, radius * 0.012), 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    ctx.restore(); // Restore translate & rotate

    // Center Hub Metrics (slightly more compact to leave clear radial room for text)
    const hubOuterRadius = Math.round(radius * 0.24);
    const hubInnerRadius = Math.round(radius * 0.20);
    const spinFontSize = Math.max(10, Math.round(radius * 0.095));

    // Center Hub Rim
    ctx.beginPath();
    ctx.arc(centerX, centerY, hubOuterRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = Math.max(2, Math.round(radius * 0.02));
    ctx.stroke();

    // Center Hub Button
    const hubGrad = ctx.createLinearGradient(
      centerX - hubInnerRadius,
      centerY - hubInnerRadius,
      centerX + hubInnerRadius,
      centerY + hubInnerRadius
    );
    hubGrad.addColorStop(0, '#4F46E5');
    hubGrad.addColorStop(1, '#312E81');
    ctx.beginPath();
    ctx.arc(centerX, centerY, hubInnerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();

    // "SPIN" text in center
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = canSpin && !isSpinning ? '#FFFFFF' : '#94A3B8';
    ctx.font = `bold ${spinFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText('SPIN', centerX, centerY);
  }, [canSpin, isSpinning]);

  // Handle high DPI retina display sizing dynamically
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const size = Math.round(Math.min(rect.width || 260, rect.height || 260));

    if (size > 0) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      drawWheel(currentRotationRef.current);
    }
  }, [drawWheel]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

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

      // Track peg crossing at top pointer
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
    <div className="relative flex flex-col items-center justify-center p-1 select-none touch-manipulation w-full">
      {/* Top Deflector Flapper */}
      <div
        className="absolute top-0 z-20 flex flex-col items-center transition-transform duration-75 origin-top pointer-events-none"
        style={{ transform: `rotate(${flapperDeflection}deg)` }}
      >
        {/* Flapper mount pin */}
        <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-yellow-600 shadow-md flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
        </div>
        {/* Flapper needle */}
        <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[18px] border-t-red-600 drop-shadow-md -mt-1" />
      </div>

      {/* Main Wheel Canvas with responsive constraints */}
      <div
        className="relative cursor-pointer transition-transform active:scale-[0.98] w-[250px] h-[250px] xs:w-[275px] xs:h-[275px] sm:w-[320px] sm:h-[320px] max-w-[80vw] max-h-[46vh] flex items-center justify-center"
        onClick={handleCenterClick}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full drop-shadow-xl rounded-full"
        />

        {/* Contained pulse glow ring when canSpin */}
        {canSpin && !isSpinning && (
          <div className="absolute -inset-1 rounded-full border-2 border-yellow-400/60 shadow-[0_0_20px_rgba(250,204,21,0.35)] pointer-events-none animate-pulse" />
        )}
      </div>

      {/* Helper caption / spin trigger button */}
      <div className="mt-2 text-center">
        {isSpinning ? (
          <p className="text-xs font-semibold text-yellow-400 animate-pulse">Wheel is spinning...</p>
        ) : canSpin ? (
          <button
            onClick={handleCenterClick}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold text-xs sm:text-sm rounded-full shadow-md transition-all transform active:scale-95 flex items-center gap-1.5"
          >
            <span>Tap Center or Here to Spin</span>
            <span>🎲</span>
          </button>
        ) : (
          <p className="text-[11px] text-slate-400">Waiting for opponent's move...</p>
        )}
      </div>
    </div>
  );
}
