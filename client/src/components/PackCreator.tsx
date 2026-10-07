import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Plus,
  Download,
  Trash2,
  FileUp,
  BookOpen,
  Check,
  X,
  Sparkles,
  Layers,
  ArrowUp,
} from 'lucide-react';
import { apiUrl } from '../utils/api';
import type {
  Category,
  QuestionPackExport,
  QuestionPackMeta
} from '../../../shared/src/index';
import { CATEGORIES } from '../../../shared/src/index';
import { playButtonPop, triggerHaptic } from '../utils/audio';
import { useToast } from './ui/Toast';
import BottomSheet from './ui/BottomSheet';
import CategoryCharacter from './characters/CategoryCharacter';

interface PackCreatorProps {
  onBack: () => void;
}

interface NewQuestionItem {
  category: Category;
  question: string;
  imageUrl?: string;
  correctAnswer: string;
  incorrectAnswers: [string, string, string];
}

const CATEGORY_LIST: Category[] = [
  'ART',
  'SCIENCE',
  'SPORTS',
  'ENTERTAINMENT',
  'GEOGRAPHY',
  'HISTORY',
];

export default function PackCreator({ onBack }: PackCreatorProps) {
  const { showToast, showConfirm } = useToast();

  const [packs, setPacks] = useState<QuestionPackMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pack Creation Form State
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [questions, setQuestions] = useState<NewQuestionItem[]>([]);

  // Current Question draft state
  const [curCategory, setCurCategory] = useState<Category>('GEOGRAPHY');
  const [curQuestion, setCurQuestion] = useState<string>('');
  const [curImageUrl, setCurImageUrl] = useState<string>('');
  const [curCorrectAnswer, setCurCorrectAnswer] = useState<string>('');
  const [curIncorrect1, setCurIncorrect1] = useState<string>('');
  const [curIncorrect2, setCurIncorrect2] = useState<string>('');
  const [curIncorrect3, setCurIncorrect3] = useState<string>('');
  const [imagePreviewError, setImagePreviewError] = useState<boolean>(false);

  // Import JSON bottom sheet state
  const [isImportSheetOpen, setIsImportSheetOpen] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fetchPacks = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/packs'));
      if (res.ok) {
        const data = (await res.json()) as QuestionPackMeta[];
        setPacks(data);
      } else {
        showToast('Failed to load packs', 'error');
      }
    } catch {
      showToast('Network error loading packs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPacks();
  }, []);

  const handleAddQuestionToDraft = () => {
    if (!curQuestion.trim()) {
      showToast('Please enter a question prompt', 'error');
      return;
    }
    if (!curCorrectAnswer.trim()) {
      showToast('Please enter the correct answer', 'error');
      return;
    }
    if (!curIncorrect1.trim() || !curIncorrect2.trim() || !curIncorrect3.trim()) {
      showToast('Please provide 3 incorrect answer choices', 'error');
      return;
    }

    const newQ: NewQuestionItem = {
      category: curCategory,
      question: curQuestion.trim(),
      imageUrl: curImageUrl.trim() || undefined,
      correctAnswer: curCorrectAnswer.trim(),
      incorrectAnswers: [curIncorrect1.trim(), curIncorrect2.trim(), curIncorrect3.trim()],
    };

    setQuestions([...questions, newQ]);
    playButtonPop();
    triggerHaptic('success');
    showToast(`Question #${questions.length + 1} added!`, 'success');

    // Reset draft fields
    setCurQuestion('');
    setCurImageUrl('');
    setCurCorrectAnswer('');
    setCurIncorrect1('');
    setCurIncorrect2('');
    setCurIncorrect3('');
    setImagePreviewError(false);
  };

  const handleRemoveQuestionFromDraft = (index: number) => {
    playButtonPop();
    triggerHaptic('medium');
    setQuestions(questions.filter((_, idx) => idx !== index));
    showToast('Question removed', 'info');
  };

  const handleMoveQuestionUp = (index: number) => {
    if (index === 0) return;
    playButtonPop();
    const updated = [...questions];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setQuestions(updated);
  };

  const handleSavePack = async () => {
    if (!title.trim()) {
      showToast('Please provide a pack title', 'error');
      return;
    }
    if (questions.length === 0) {
      showToast('Please add at least one question before saving', 'error');
      return;
    }

    try {
      const payload: QuestionPackExport = {
        title: title.trim(),
        description: description.trim(),
        questions: questions.map((q) => ({
          category: q.category,
          question: q.question,
          imageUrl: q.imageUrl,
          correctAnswer: q.correctAnswer,
          incorrectAnswers: q.incorrectAnswers,
          difficulty: 'medium',
        })),
      };

      const res = await fetch(apiUrl('/api/packs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        playButtonPop();
        triggerHaptic('success');
        showToast('Pack published successfully!', 'success');
        setIsCreating(false);
        setTitle('');
        setDescription('');
        setQuestions([]);
        void fetchPacks();
      } else {
        const errData = (await res.json()) as { error?: string };
        showToast(errData.error || 'Failed to save pack', 'error');
      }
    } catch {
      showToast('Network error while saving pack', 'error');
    }
  };

  const handleDeletePack = (packId: string, packTitle: string) => {
    showConfirm({
      title: 'Delete Question Pack?',
      message: `Are you sure you want to permanently delete "${packTitle}"? This cannot be undone.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(apiUrl(`/api/packs/${packId}`), { method: 'DELETE' });
          if (res.ok) {
            playButtonPop();
            triggerHaptic('medium');
            showToast('Pack deleted', 'info');
            void fetchPacks();
          } else {
            const err = (await res.json()) as { error?: string };
            showToast(err.error || 'Could not delete pack', 'error');
          }
        } catch {
          showToast('Error deleting pack', 'error');
        }
      },
    });
  };

  const handleExportPack = async (packId: string, packTitle: string) => {
    try {
      const res = await fetch(apiUrl(`/api/packs/${packId}/export`));
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${packTitle.toLowerCase().replace(/\s+/g, '-')}-pack.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        playButtonPop();
        triggerHaptic('success');
        showToast('Pack JSON downloaded', 'success');
      } else {
        showToast('Failed to export pack', 'error');
      }
    } catch {
      showToast('Failed to export pack', 'error');
    }
  };

  const handleImportJson = async () => {
    if (!importJsonText.trim()) {
      showToast('Please paste valid JSON or select a file', 'error');
      return;
    }

    setIsImporting(true);
    try {
      const parsed = JSON.parse(importJsonText) as QuestionPackExport;
      const res = await fetch(apiUrl('/api/packs/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        playButtonPop();
        triggerHaptic('success');
        showToast('Pack imported successfully!', 'success');
        setIsImportSheetOpen(false);
        setImportJsonText('');
        void fetchPacks();
      } else {
        const data = (await res.json()) as { error?: string };
        showToast(data.error || 'Import failed', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Invalid JSON format', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportJsonText(text);
      showToast(`Loaded ${file.name}`, 'info');
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 flex flex-col w-full max-w-lg mx-auto h-full relative select-none pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
      {/* Top Studio Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => {
            playButtonPop();
            onBack();
          }}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Lobby</span>
        </button>
        <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span>Pack Studio</span>
        </h2>
        <div className="w-10" />
      </div>

      {/* Main Studio View: Pack List vs Builder */}
      <div className="flex-1 overflow-y-auto scroll-touch px-4 py-4 overscroll-contain">
        {!isCreating ? (
          <div className="flex flex-col gap-4">
            {/* Top Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  playButtonPop();
                  triggerHaptic('selection');
                  setIsCreating(true);
                }}
                className="py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create New Pack</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playButtonPop();
                  triggerHaptic('selection');
                  setIsImportSheetOpen(true);
                }}
                className="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs border border-slate-700/80 shadow flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <FileUp className="w-4 h-4 text-indigo-400" />
                <span>Import JSON</span>
              </button>
            </div>

            {/* Pack List Header */}
            <div className="flex items-center justify-between pt-1">
              <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                Installed Question Packs ({packs.length})
              </h3>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400">Loading packs...</span>
              </div>
            ) : packs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No question packs found. Create or import one above!
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {packs.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800/90 shadow-xl flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-white truncate">{p.title}</h4>
                          {p.isDefault && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-400/30">
                              Official
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                            {p.description}
                          </p>
                        )}
                        <span className="text-[11px] font-semibold text-slate-500 mt-1 inline-block">
                          {p.questionCount} Questions &bull;{' '}
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleExportPack(p.id, p.title)}
                          title="Export Pack JSON"
                          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {!p.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDeletePack(p.id, p.title)}
                            title="Delete Pack"
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 transition-colors border border-slate-700/60"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Pack Builder Screen */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pack Builder</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  playButtonPop();
                  setIsCreating(false);
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* Pack Title & Description */}
            <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Pack Title</label>
                <input
                  type="text"
                  placeholder="e.g. 90s Pop Culture, Anime Heroes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Brief description of the pack theme"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            {/* Question Draft Card */}
            <div className="p-4 rounded-3xl bg-slate-900/95 border border-indigo-500/40 shadow-xl flex flex-col gap-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wide">
                  Compose Question ({questions.length} in pack)
                </span>
              </div>

              {/* Category Selector Chips */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-2">
                  Category & Guardian
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORY_LIST.map((c) => {
                    const info = CATEGORIES[c];
                    const isSelected = curCategory === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          playButtonPop();
                          setCurCategory(c);
                        }}
                        className={`
                          p-2 rounded-2xl border text-left flex items-center gap-2 transition-all
                          ${
                            isSelected
                              ? 'ring-2 ring-indigo-400 shadow-md text-white'
                              : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                          }
                        `}
                        style={{
                          backgroundColor: isSelected ? `${info.color}25` : undefined,
                          borderColor: isSelected ? info.color : undefined,
                        }}
                      >
                        <CategoryCharacter category={c} size="xs" />
                        <span className="text-[11px] font-bold truncate">{info.characterName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question Textarea */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Question Prompt
                </label>
                <textarea
                  placeholder="Type your trivia question prompt here..."
                  value={curQuestion}
                  onChange={(e) => setCurQuestion(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 resize-none leading-relaxed"
                />
              </div>

              {/* Optional Image URL */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Image Clue URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={curImageUrl}
                  onChange={(e) => {
                    setCurImageUrl(e.target.value);
                    setImagePreviewError(false);
                  }}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                />
                {curImageUrl.trim() && (
                  <div className="mt-2 relative max-h-28 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center p-1">
                    {!imagePreviewError ? (
                      <img
                        src={curImageUrl.trim()}
                        alt="Clue Preview"
                        onError={() => setImagePreviewError(true)}
                        className="max-h-24 w-auto object-contain rounded-xl"
                      />
                    ) : (
                      <span className="text-[10px] text-rose-400">Invalid image URL</span>
                    )}
                  </div>
                )}
              </div>

              {/* 4 Answer Inputs (1 Green Correct + 3 Slate Incorrect) */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 block">Answer Choices</label>

                {/* Correct Answer */}
                <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 shadow-sm">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <input
                    type="text"
                    placeholder="Correct Answer"
                    value={curCorrectAnswer}
                    onChange={(e) => setCurCorrectAnswer(e.target.value)}
                    className="flex-1 bg-transparent text-xs sm:text-sm font-bold text-emerald-200 placeholder-emerald-600 focus:outline-none px-1"
                  />
                </div>

                {/* Incorrect 1 */}
                <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-sm">
                  <div className="w-7 h-7 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center font-black text-xs shrink-0">
                    <X className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Incorrect Choice 1"
                    value={curIncorrect1}
                    onChange={(e) => setCurIncorrect1(e.target.value)}
                    className="flex-1 bg-transparent text-xs sm:text-sm text-slate-300 placeholder-slate-600 focus:outline-none px-1"
                  />
                </div>

                {/* Incorrect 2 */}
                <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-sm">
                  <div className="w-7 h-7 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center font-black text-xs shrink-0">
                    <X className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Incorrect Choice 2"
                    value={curIncorrect2}
                    onChange={(e) => setCurIncorrect2(e.target.value)}
                    className="flex-1 bg-transparent text-xs sm:text-sm text-slate-300 placeholder-slate-600 focus:outline-none px-1"
                  />
                </div>

                {/* Incorrect 3 */}
                <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-sm">
                  <div className="w-7 h-7 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center font-black text-xs shrink-0">
                    <X className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Incorrect Choice 3"
                    value={curIncorrect3}
                    onChange={(e) => setCurIncorrect3(e.target.value)}
                    className="flex-1 bg-transparent text-xs sm:text-sm text-slate-300 placeholder-slate-600 focus:outline-none px-1"
                  />
                </div>
              </div>

              {/* Add Question Button */}
              <button
                type="button"
                onClick={handleAddQuestionToDraft}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question to Deck</span>
              </button>
            </div>

            {/* Added Questions Card Deck */}
            {questions.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Card Deck ({questions.length} questions)</span>
                </span>

                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-extrabold text-indigo-400">#{idx + 1}</span>
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded-full text-white"
                            style={{ backgroundColor: CATEGORIES[q.category].color }}
                          >
                            {q.category}
                          </span>
                        </div>
                        <p className="text-white font-medium truncate">{q.question}</p>
                        <p className="text-emerald-400 text-[10px] truncate mt-0.5">
                          ✓ {q.correctAnswer}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveQuestionUp(idx)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestionFromDraft(idx)}
                          className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-950 transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save Pack Action Button */}
            <button
              type="button"
              onClick={handleSavePack}
              disabled={questions.length === 0 || !title.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 font-extrabold text-sm text-white shadow-xl shadow-emerald-950/40 active:scale-98 transition-all disabled:opacity-40 flex items-center justify-center gap-2 mt-2"
            >
              <Check className="w-5 h-5 stroke-[3]" />
              <span>Save & Publish Pack ({questions.length} Qs)</span>
            </button>
          </div>
        )}
      </div>

      {/* Import JSON Bottom Sheet */}
      <BottomSheet
        isOpen={isImportSheetOpen}
        onClose={() => setIsImportSheetOpen(false)}
        title="Import Trivia Pack JSON"
        subtitle="Upload a .json file or paste pack JSON schema"
        icon={<FileUp className="w-5 h-5 text-indigo-400" />}
      >
        <div className="flex flex-col gap-4 py-2">
          {/* File Upload Dropzone */}
          <div className="p-4 rounded-2xl border-2 border-dashed border-slate-700/80 bg-slate-950/60 text-center flex flex-col items-center justify-center gap-2 hover:border-indigo-400 transition-colors">
            <FileUp className="w-8 h-8 text-indigo-400" />
            <span className="text-xs font-bold text-white">Select JSON File</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[10px] text-slate-500 uppercase font-bold">OR PASTE JSON</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Paste JSON Textarea */}
          <textarea
            placeholder='{"title": "My Pack", "questions": [...]}'
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            rows={6}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-400 resize-none"
          />

          <button
            type="button"
            disabled={isImporting || !importJsonText.trim()}
            onClick={handleImportJson}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white shadow-xl shadow-indigo-950/40 active:scale-98 transition-all disabled:opacity-40"
          >
            {isImporting ? 'Importing...' : 'Validate & Import Pack'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
