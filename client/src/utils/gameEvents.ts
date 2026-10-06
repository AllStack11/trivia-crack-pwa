/** Parse fetch-based SSE, including frames split across network chunks. */
export async function readGameEvents(response: Response, onEvent: (event: string, data: string) => void, signal?: AbortSignal): Promise<void> {
  if (!response.body) throw new Error('Missing event stream');
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(pending))) {
        const frame = pending.slice(0, match.index);
        pending = pending.slice(match.index + match[0].length);
        let event = 'message';
        const data: string[] = [];
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trimStart();
          if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        }
        if (data.length && !signal?.aborted) onEvent(event, data.join('\n'));
      }
      if (done) return;
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
