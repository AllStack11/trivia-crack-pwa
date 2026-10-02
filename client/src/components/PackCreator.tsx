import { apiUrl } from '../utils/api';
import { useState, useEffect } from 'react';
import type { Category, QuestionPackExport, QuestionPackMeta } from '../../../shared/src/index';
import { CATEGORIES } from '../../../shared/src/index';
import { playButtonPop } from '../utils/audio';

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
  'HISTORY'
];

export default function PackCreator({ onBack }: PackCreatorProps) {
  const [packs, setPacks] = useState<QuestionPackMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  // Import JSON state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);

  const fetchPacks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/packs'));
      if (res.ok) {
        const data = (await res.json()) as QuestionPackMeta[];
        setPacks(data);
      } else {
        setError('Failed to load packs');
      }
    } catch {
      setError('Network error loading packs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPacks();
  }, []);

  const handleAddQuestionToDraft = () => {
    if (!curQuestion.trim()) {
      alert('Please enter a question prompt.');
      return;
    }
    if (!curCorrectAnswer.trim()) {
      alert('Please enter the correct answer.');
      return;
    }
    if (!curIncorrect1.trim() || !curIncorrect2.trim() || !curIncorrect3.trim()) {
      alert('Please provide 3 incorrect answer choices.');
      return;
    }

    const newQ: NewQuestionItem = {
      category: curCategory,
      question: curQuestion.trim(),
      imageUrl: curImageUrl.trim() || undefined,
      correctAnswer: curCorrectAnswer.trim(),
      incorrectAnswers: [curIncorrect1.trim(), curIncorrect2.trim(), curIncorrect3.trim()]
    };

    setQuestions([...questions, newQ]);
    playButtonPop();

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
    setQuestions(questions.filter((_, idx) => idx !== index));
    playButtonPop();
  };

  const handleSavePack = async () => {
    if (!title.trim()) {
      alert('Please provide a pack title.');
      return;
    }
    if (questions.length === 0) {
      alert('Please add at least one question to the pack before saving.');
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
          difficulty: 'medium'
        }))
      };

      const res = await fetch(apiUrl('/api/packs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        playButtonPop();
        setIsCreating(false);
        setTitle('');
        setDescription('');
        setQuestions([]);
        fetchPacks();
      } else {
        const errData = (await res.json()) as { error?: string };
        alert(errData.error || 'Failed to save pack');
      }
    } catch {
      alert('Network error while saving pack');
    }
  };

  const handleDeletePack = async (packId: string) => {
    if (!confirm('Are you sure you want to delete this custom pack?')) return;
    try {
      const res = await fetch(apiUrl(`/api/packs/${packId}`), { method: 'DELETE' });
      if (res.ok) {
        playButtonPop();
        fetchPacks();
      } else {
        const err = (await res.json()) as { error?: string };
        alert(err.error || 'Could not delete pack');
      }
    } catch {
      alert('Error deleting pack');
    }
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
      }
    } catch {
      alert('Failed to export pack');
    }
  };

  const handleImportJson = async () => {
    setImportError(null);
    if (!importJsonText.trim()) {
      setImportError('Please paste valid JSON or select a file');
      return;
    }

    try {
      const parsed = JSON.parse(importJsonText) as QuestionPackExport;
      const res = await fetch(apiUrl('/api/packs/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });

      if (res.ok) {
        playButtonPop();
        setIsImportModalOpen(false);
        setImportJsonText('');
        fetchPacks();
      } else {
        const data = (await res.json()) as { error?: string };
        setImportError(data.error || 'Import failed');
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid JSON format');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportJsonText(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900/85 backdrop-blur-2xl border border-slate-700/80 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition"
        >
          <span>← Back</span>
        </button>
        <h2 className="text-base font-extrabold text-white">Question Pack Manager</h2>
        <div className="w-12" />
      </div>

      {/* Main Content: List vs Creator */}
      {!isCreating ? (
        <div className="flex flex-col gap-3">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsCreating(true);
                playButtonPop();
              }}
              className="flex-1 py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-2xl shadow flex items-center justify-center gap-1.5"
            >
              <span>➕</span>
              <span>New Pack</span>
            </button>
            <button
              onClick={() => {
                setIsImportModalOpen(true);
                playButtonPop();
              }}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-2xl border border-slate-700/60 flex items-center justify-center gap-1.5"
            >
              <span>📥</span>
              <span>Import JSON</span>
            </button>
          </div>

          {/* Pack List */}
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
              Loading question packs...
            </div>
          ) : error ? (
            <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-2xl text-xs text-red-300 text-center">
              {error}
            </div>
          ) : packs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No question packs found.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {packs.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 bg-slate-850/80 border border-slate-800 rounded-2xl flex flex-col gap-1.5 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{p.title}</span>
                        {p.isDefault ? (
                          <span className="bg-amber-400/20 text-yellow-300 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-yellow-400/30">
                            OFFICIAL
                          </span>
                        ) : (
                          <span className="bg-indigo-400/20 text-indigo-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full border border-indigo-400/30">
                            CUSTOM
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                        {p.description || 'No description provided'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">
                      📝 {p.questionCount} Questions
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExportPack(p.id, p.title)}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition"
                        title="Download Pack JSON"
                      >
                        Export 📤
                      </button>
                      {!p.isDefault && (
                        <button
                          onClick={() => handleDeletePack(p.id)}
                          className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition"
                          title="Delete Custom Pack"
                        >
                          Delete 🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Pack Creator Screen */
        <div className="flex flex-col gap-3 max-h-[75vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400">Step 1: Pack Information</span>
            <button
              onClick={() => setIsCreating(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <input
            type="text"
            placeholder="Pack Title (e.g. 90s Pop Culture)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />

          <input
            type="text"
            placeholder="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />

          {/* Question Draft Form */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-2.5 mt-1">
            <span className="text-xs font-bold text-amber-400">
              Step 2: Add Question ({questions.length} added)
            </span>

            {/* Category Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Category:</label>
              <select
                value={curCategory}
                onChange={(e) => setCurCategory(e.target.value as Category)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {CATEGORY_LIST.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIES[c].name} ({CATEGORIES[c].characterName})
                  </option>
                ))}
              </select>
            </div>

            {/* Question Text */}
            <textarea
              placeholder="Question text..."
              value={curQuestion}
              onChange={(e) => setCurQuestion(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />

            {/* Optional Image URL & Live Preview */}
            <div className="flex flex-col gap-1">
              <input
                type="url"
                placeholder="Optional Image URL (https://...)"
                value={curImageUrl}
                onChange={(e) => {
                  setCurImageUrl(e.target.value);
                  setImagePreviewError(false);
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {curImageUrl.trim() && (
                <div className="mt-1 relative max-h-24 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center p-1">
                  {!imagePreviewError ? (
                    <img
                      src={curImageUrl.trim()}
                      alt="Thumbnail Preview"
                      onError={() => setImagePreviewError(true)}
                      className="max-h-20 w-auto object-contain rounded"
                    />
                  ) : (
                    <span className="text-[10px] text-rose-400">Invalid or unreadable image URL</span>
                  )}
                </div>
              )}
            </div>

            {/* Answers */}
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                placeholder="✓ Correct Answer"
                value={curCorrectAnswer}
                onChange={(e) => setCurCorrectAnswer(e.target.value)}
                className="w-full bg-emerald-950/30 border border-emerald-700/50 rounded-xl px-3 py-2 text-xs text-emerald-200 placeholder-emerald-600 focus:outline-none focus:border-emerald-500 font-semibold"
              />
              <input
                type="text"
                placeholder="✗ Incorrect Answer 1"
                value={curIncorrect1}
                onChange={(e) => setCurIncorrect1(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="✗ Incorrect Answer 2"
                value={curIncorrect2}
                onChange={(e) => setCurIncorrect2(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="✗ Incorrect Answer 3"
                value={curIncorrect3}
                onChange={(e) => setCurIncorrect3(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleAddQuestionToDraft}
              className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl border border-slate-700/80 transition"
            >
              + Add This Question
            </button>
          </div>

          {/* List of Questions Added */}
          {questions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400">
                Questions in Pack ({questions.length}):
              </span>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="truncate flex-1 pr-2">
                      <span className="font-bold text-indigo-400">[{q.category}] </span>
                      <span className="text-slate-300">{q.question}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveQuestionFromDraft(idx)}
                      className="text-rose-400 hover:text-rose-300 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save Pack Button */}
          <button
            onClick={handleSavePack}
            disabled={!title.trim() || questions.length === 0}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm rounded-2xl shadow-lg transition disabled:opacity-40"
          >
            Save & Publish Custom Pack
          </button>
        </div>
      )}

      {/* JSON Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Import Question Pack JSON</h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Upload a .json file or paste formatted JSON matching the Trivia Clash pack schema.
            </p>

            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
            />

            <textarea
              placeholder="Or paste JSON here..."
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              rows={6}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 font-mono text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none"
            />

            {importError && (
              <p className="text-xs text-red-400 font-medium">{importError}</p>
            )}

            <button
              onClick={handleImportJson}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition"
            >
              Validate & Import Pack
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
