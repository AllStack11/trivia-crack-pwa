import { useEffect, useRef, type RefObject } from 'react';

/** Keeps keyboard and screen-reader navigation in the open dialog. */
export function useDialogFocus(open: boolean, ref: RefObject<HTMLElement | null>) {
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) {
      const remember = () => {
        const element = document.activeElement;
        if (element instanceof HTMLElement && !element.closest('[role="dialog"], [role="alertdialog"]')) opener.current = element;
      };
      remember();
      document.addEventListener('focusin', remember);
      return () => document.removeEventListener('focusin', remember);
    }
    const panel = ref.current;
    if (!panel) return;
    const siblings: Array<{ element: HTMLElement; inert: boolean }> = [];
    let branch: HTMLElement = panel;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement && sibling.getAttribute("aria-hidden") !== "true" && !sibling.contains(panel)) {
          siblings.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]'))
      .filter(element => !element.matches(':disabled, [tabindex="-1"]') && !element.closest('[inert]') && element.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => {
      if (!panel.contains(document.activeElement)) (panel.querySelector<HTMLElement>('input:not(:disabled)') ?? controls()[0] ?? panel).focus();
    });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) { event.preventDefault(); panel.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', trap);
      for (const item of siblings) item.element.inert = item.inert;
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, [open, ref]);
}
