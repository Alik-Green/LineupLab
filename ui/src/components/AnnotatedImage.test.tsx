import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AnnotatedImage } from './AnnotatedImage';
import { AnnotationEditor } from './AnnotationEditor';
import type { SlotData } from '../types';
const slot: SlotData = { image: 'hash', circles: [{ id: 'c1', color: 'cyan', x: 0.5, y: 0.5, radius: 0.025, showZoom: true, zoomScale: 3.5, zoomSize: 0.24, zoomX: 0.72, zoomY: 0.04, unknown: { a: 1 } }], lines: [{ id: 'l1', color: 'yellow', width: 0.003, points: [{ x: 0.1, y: 0.9 }, { x: 0.5, y: 0.5 }], style: 'dashed', arrow: 'end', label: 'align' }] };
describe('AnnotatedImage', () => {
  it('renders original image, circles, lens crop and lines non-destructively', () => { const { container } = render(<AnnotatedImage src="data:image/svg+xml,x" slot={slot} />); expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/svg+xml,x'); expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2); expect(container.querySelector('polyline')).toHaveAttribute('stroke-dasharray'); expect(container.querySelector('image')).toHaveAttribute('href', 'data:image/svg+xml,x'); expect(screen.getByText('align')).toBeInTheDocument(); });
  it('adds a circle in edit mode and keeps existing unknown fields', () => { const onChange = vi.fn(); const { getByTestId } = render(<AnnotatedImage src="x" slot={slot} editable tool="circle" color="red" onChange={onChange} />); fireEvent.pointerDown(getByTestId('annotated-image'), { clientX: 800, clientY: 450 }); expect(onChange).toHaveBeenCalledTimes(1); const next = onChange.mock.calls[0][0] as SlotData; expect(next.circles).toHaveLength(2); expect(next.circles[0].unknown).toEqual({ a: 1 }); expect(next.circles[1].color).toBe('red'); expect(next.lines).toEqual(slot.lines); });
});
describe('AnnotationEditor Photoshop-style tools', () => {
  it('records additions and restores them with undo/redo', async () => { const onChange = vi.fn(); const { getByLabelText, getByTestId } = render(<AnnotationEditor src="x" slot={{ image: null, circles: [], lines: [] }} onChange={onChange} />); fireEvent.click(getByLabelText('Circle')); fireEvent.pointerDown(getByTestId('annotated-image'), { clientX: 400, clientY: 300 }); expect(onChange).toHaveBeenCalled(); expect((onChange.mock.calls.at(-1)![0] as SlotData).circles).toHaveLength(1); fireEvent.click(getByLabelText('Undo annotation')); expect((onChange.mock.calls.at(-1)![0] as SlotData).circles).toHaveLength(0); fireEvent.click(getByLabelText('Redo annotation')); expect((onChange.mock.calls.at(-1)![0] as SlotData).circles).toHaveLength(1); });
});

describe('annotation workspace', () => {
  it('uses compact tools, contextual properties and magnet snapping without counters', () => {
    const onChange = vi.fn(); const { getByLabelText, getByTestId, queryByText, container } = render(<AnnotationEditor src="x" slot={{ image: null, circles: [], lines: [] }} onChange={onChange} />);
    expect(queryByText(/circle\(s\)/)).toBeNull(); expect(queryByText(/Click to place/)).toBeNull();
    fireEvent.click(getByLabelText('Snap to grid'));
    fireEvent.click(getByLabelText('Circle'));
    fireEvent.pointerDown(getByTestId('annotated-image'), { clientX: 501, clientY: 302 });
    expect((onChange.mock.calls.at(-1)![0] as SlotData).circles).toHaveLength(1);
    expect(getByLabelText('Tool properties')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'v' }); expect(getByLabelText('Select')).toHaveAttribute('aria-pressed', 'true');
  });
});
