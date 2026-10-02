import BottomSheet from './BottomSheet';
import { Share, PlusSquare, CheckCircle2, Smartphone } from 'lucide-react';
import { playButtonPop } from '../../utils/audio';

export interface IOSInstallSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IOSInstallSheet({ isOpen, onClose }: IOSInstallSheetProps) {
  const steps = [
    {
      step: '1',
      icon: <Share className="w-5 h-5 text-indigo-400" />,
      title: 'Tap the Share Button',
      desc: 'At the bottom of your Safari browser, tap the Share icon (square with arrow).',
    },
    {
      step: '2',
      icon: <PlusSquare className="w-5 h-5 text-indigo-400" />,
      title: 'Select "Add to Home Screen"',
      desc: 'Scroll down the options list and tap "Add to Home Screen".',
    },
    {
      step: '3',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      title: 'Tap "Add"',
      desc: 'Tap "Add" in the top-right corner to place Trivia Clash on your home screen.',
    },
  ];

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Install on iPhone / iPad"
      subtitle="Play in full-screen standalone app mode"
      icon={<Smartphone className="w-5 h-5" />}
    >
      <div className="flex flex-col gap-4 py-2">
        <p className="text-xs text-slate-300 leading-relaxed">
          Install Trivia Clash to your home screen to enjoy edge-to-edge gameplay, quick turn alerts, and faster launch times.
        </p>

        <div className="flex flex-col gap-3">
          {steps.map((item) => (
            <div
              key={item.step}
              className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-700/80 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">
                {item.step}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1 rounded-lg bg-indigo-500/10">
                    {item.icon}
                  </div>
                  <h4 className="text-sm font-semibold text-white truncate">
                    {item.title}
                  </h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            playButtonPop();
            onClose();
          }}
          className="mt-2 w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-sm shadow-lg shadow-indigo-900/30 active:scale-98 transition-all"
        >
          Got it
        </button>
      </div>
    </BottomSheet>
  );
}
