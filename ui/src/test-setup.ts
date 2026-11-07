import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
afterEach(() => cleanup());
if (!globalThis.crypto?.randomUUID) { Object.defineProperty(globalThis.crypto, 'randomUUID', { value: () => `test-${Math.random().toString(16).slice(2)}` }); }
Element.prototype.getBoundingClientRect = function () { return { x: 0, y: 0, width: 1600, height: 900, top: 0, left: 0, bottom: 900, right: 1600, toJSON: () => ({}) } as DOMRect; };
class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverMock as unknown as typeof ResizeObserver);
vi.stubGlobal('scrollTo', () => {});
