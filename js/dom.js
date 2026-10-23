// Small DOM utilities shared by all pages.
export const safe = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(message, detail = '') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${safe(message)}${detail ? ` <span>${safe(detail)}</span>` : ''}`;
  $('#toastStack').append(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 300);
  }, 2800);
}
