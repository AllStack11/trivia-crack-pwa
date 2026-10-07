import { RESULT_REVIEW_MS } from '../components/characters/reactions';

/** Cancelled callbacks stay inert even if already queued by the browser. */
export function createReviewTimer(schedule = (fn: () => void, ms: number) => setTimeout(fn, ms), unschedule = (id: ReturnType<typeof setTimeout>) => clearTimeout(id)) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let finish: (() => void) | undefined;
  const cancel = () => {
    generation++;
    if (timer !== undefined) unschedule(timer);
    timer = undefined;
    finish = undefined;
  };
  return {
    start(callback: () => void) {
      cancel();
      finish = callback;
      const current = generation;
      timer = schedule(() => {
        if (current !== generation) return;
        cancel();
        callback();
      }, RESULT_REVIEW_MS);
    },
    dismiss() { const callback = finish; cancel(); callback?.(); },
    cancel,
  };
}
