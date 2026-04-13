import "@testing-library/jest-dom";

// Polyfill scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = function () { /* noop */ };

// Polyfill ResizeObserver for CodeMirror
if (typeof ResizeObserver === 'undefined') {
  (globalThis as typeof globalThis & { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
    observe() { /* noop */ }
    unobserve() { /* noop */ }
    disconnect() { /* noop */ }
  };
}
