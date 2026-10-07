import { useState } from 'react';
import { apiUrl } from '../utils/api';
import { useToast } from './ui/Toast';

export default function PackCreator({ onBack, token }: { onBack: () => void; token?: string }) {
  const { showToast } = useToast();
  const [question, setQuestion] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [answers, setAnswers] = useState(['', '', '', '']);
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !token) return;
    setSaving(true);
    try {
      const response = await fetch(apiUrl('/api/questions/custom'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, imageUrl: imageUrl || undefined, correctAnswer: answers[0], incorrectAnswers: answers.slice(1) }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not add question');
      setQuestion(''); setImageUrl(''); setAnswers(['', '', '', '']);
      showToast('Question added to the shared Custom pool!', 'success');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not add question', 'error'); }
    finally { setSaving(false); }
  }
  const inputClass = 'w-full rounded-xl p-3 bg-slate-900 border border-slate-600 text-white';
  return <section className="max-w-lg mx-auto p-5 text-white">
    <button onClick={onBack} className="mb-5">Back to lobby</button>
    <h1 className="text-2xl font-bold">Add to Custom</h1>
    <p className="my-4 text-slate-300">Share a question with everyone. All contributions join the Custom category and are available in every match.</p>
    {!token && <p>Sign in to contribute a question.</p>}
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label>Question<textarea required maxLength={1000} className={inputClass} value={question} onChange={e => setQuestion(e.target.value)} /></label>
      <label>Image URL (optional)<input type="url" maxLength={2000} className={inputClass} value={imageUrl} onChange={e => setImageUrl(e.target.value)} /></label>
      {answers.map((answer, index) => <label key={index}>{index === 0 ? 'Correct answer' : `Incorrect answer ${index}`}<input required maxLength={200} className={inputClass} value={answer} onChange={e => setAnswers(answers.map((a, i) => i === index ? e.target.value : a))} /></label>)}
      <button disabled={saving || !token} className="rounded-xl bg-teal-600 p-3 font-bold disabled:opacity-50">{saving ? 'Adding...' : 'Add to shared pool'}</button>
    </form>
  </section>;
}
