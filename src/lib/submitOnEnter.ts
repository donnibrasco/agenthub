import type { KeyboardEvent } from 'react';

/** True on phones and tablets, where Enter should keep inserting a new line. */
function isTouchKeyboard() {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
}

/**
 * Chat-style textarea keys: Enter sends the surrounding form, Shift+Enter adds a new line.
 * Ignores Enter while an input method editor is composing text.
 */
export function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
  if (isTouchKeyboard()) return;
  event.preventDefault();
  if (event.currentTarget.value.trim()) event.currentTarget.form?.requestSubmit();
}
