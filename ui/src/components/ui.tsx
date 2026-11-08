import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';
import { ValImage } from '../lib/images';

/* Buttons */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'lg'; loading?: boolean; icon?: ReactNode }
export function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest }: ButtonProps) {
  return <button className={clsx('ll-btn', `ll-btn--${variant}`, `ll-btn--${size}`, className)} disabled={disabled || loading} {...rest}>{loading ? <span className="ll-spinner" aria-hidden /> : icon}{children}</button>;
}
export function IconButton({ label, tooltip, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tooltip?: string }) {
  const btn = <button aria-label={label} title={tooltip ?? label} className={clsx('ll-icon-btn', className)} {...rest}>{children}</button>;
  return tooltip ? <Tooltip label={tooltip}>{btn}</Tooltip> : btn;
}
/* Chips / segmented */
export function Chip({ selected, tone = 'neutral', className, children, onClick, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; tone?: 'neutral' | 'attack' | 'defense' | 'success' | 'warning' }) {
  const cls = clsx('ll-chip', selected && 'is-selected', `ll-chip--${tone}`, className);
  if (!onClick) return <span className={cls} data-selected={selected || undefined}>{children}</span>;
  return <button type="button" aria-pressed={selected} className={cls} onClick={onClick} {...rest}>{children}</button>;
}
export interface SegmentOption<T extends string> { value: T; label: string; icon?: ReactNode; description?: string; ariaLabel?: string }
export function Segmented<T extends string>({ options, value, onChange, ariaLabel, className }: { options: SegmentOption<T>[]; value: T; onChange(v: T): void; ariaLabel: string; className?: string }) {
  return <div role="group" aria-label={ariaLabel} className={clsx('ll-segmented', className)}>{options.map(o => <button key={o.value} type="button" aria-label={o.ariaLabel ?? (o.label || undefined)} aria-pressed={value === o.value} className={clsx('ll-segmented__item', value === o.value && 'is-selected')} onClick={() => onChange(o.value)}>{o.icon}<span>{o.label}</span>{o.description && <small>{o.description}</small>}</button>)}</div>;
}
/* Icon picker grid (maps/agents/abilities) */
export interface PickerOption { id: string; name: string; icon?: string | null; sublabel?: string; badge?: ReactNode; disabled?: boolean }
export function IconPicker({ options, value, onChange, ariaLabel, allLabel, kind = 'picker', columns, size = 'md', className }: { options: PickerOption[]; value: string; onChange(id: string): void; ariaLabel: string; allLabel?: string; kind?: string; columns?: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return <div role="listbox" aria-label={ariaLabel} className={clsx('ll-icon-picker', `ll-icon-picker--${size}`, className)} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` } : undefined}>
    {allLabel && <button type="button" role="option" aria-selected={value === ''} className={clsx('ll-picker-tile ll-picker-tile--all', value === '' && 'is-selected')} onClick={() => onChange('')}><span>{allLabel}</span></button>}
    {options.map(o => <button key={o.id} type="button" role="option" aria-selected={value === o.id} disabled={o.disabled} title={o.name} className={clsx('ll-picker-tile', value === o.id && 'is-selected')} onClick={() => onChange(o.id)}>
      <ValImage src={o.icon} alt={o.name} kind={kind} className="ll-picker-tile__img" imgClassName="ll-picker-tile__img" fallbackLabel={o.name.slice(0, 2)} />
      <span className="ll-picker-tile__label">{o.name}</span>{o.sublabel && <small>{o.sublabel}</small>}{o.badge}
    </button>)}
  </div>;
}
/* Surfaces */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) { return <section className={clsx('ll-card', className)} {...rest}>{children}</section>; }
export function PageHeader({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children?: ReactNode }) { return <div className="ll-page-header"><div><h1 className="ll-h1">{title}</h1>{subtitle && <p className="ll-muted">{subtitle}</p>}{children}</div>{actions && <div className="ll-page-header__actions">{actions}</div>}</div>; }
/* Modal / Drawer */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const prev = document.activeElement as HTMLElement | null; const el = ref.current; el?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } if (e.key === 'Tab' && el) { const items = Array.from(el.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')); if (!items.length) return; const first = items[0], last = items[items.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } };
    document.addEventListener('keydown', onKey); return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  return ref;
}
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose(): void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useDialog(open, onClose); const id = useId();
  if (!open) return null;
  return createPortal(<div className="ll-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className={clsx('ll-modal', wide && 'll-modal--wide')}><header className="ll-modal__head"><h2 id={id} className="ll-h2">{title}</h2><IconButton label="Close" onClick={onClose}><X size={18} /></IconButton></header><div className="ll-modal__body">{children}</div>{footer && <footer className="ll-modal__foot">{footer}</footer>}</div></div>, document.body);
}
export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose(): void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useDialog(open, onClose); const id = useId();
  if (!open) return null;
  return createPortal(<div className="ll-overlay ll-overlay--drawer" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className="ll-drawer"><header className="ll-modal__head"><h2 id={id} className="ll-h2">{title}</h2><IconButton label="Close" onClick={onClose}><X size={18} /></IconButton></header><div className="ll-drawer__body">{children}</div>{footer && <footer className="ll-modal__foot">{footer}</footer>}</div></div>, document.body);
}
export function Popup({ open, onClose, title, children, footer }: { open: boolean; onClose(): void; title: string; children: ReactNode; footer?: ReactNode }) {
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const ref = useDialog(open, onClose); const id = useId();
  useEffect(() => { if (!open) return; const onPop = () => closeRef.current(); window.addEventListener('popstate', onPop); window.history.pushState({ llPopup: true }, ''); return () => { window.removeEventListener('popstate', onPop); }; }, [open]);
  if (!open) return null;
  return createPortal(<div className="ll-overlay ll-overlay--popup" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className="ll-popup" data-testid="lineup-popup"><header className="ll-modal__head"><h2 id={id} className="ll-h2">{title}</h2><IconButton label="Close" onClick={onClose}><X size={18} /></IconButton></header><div className="ll-popup__body">{children}</div>{footer && <footer className="ll-modal__foot">{footer}</footer>}</div></div>, document.body);
}
/* Toasts */
interface Toast { id: number; message: string; tone: 'info' | 'success' | 'warning' | 'error' }
const ToastContext = createContext<{ push(message: string, tone?: Toast['tone']): void }>({ push: () => {} });
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]); const next = useRef(1);
  const push = useCallback((message: string, tone: Toast['tone'] = 'info') => { const id = next.current++; setToasts(t => [...t.slice(-3), { id, message, tone }]); window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500); }, []);
  return <ToastContext.Provider value={{ push }}>{children}<div className="ll-toasts" aria-live="polite">{toasts.map(t => <div key={t.id} role="status" className={clsx('ll-toast', `ll-toast--${t.tone}`)}>{t.message}<button aria-label="Dismiss" onClick={() => setToasts(x => x.filter(y => y.id !== t.id))}><X size={14} /></button></div>)}</div></ToastContext.Provider>;
}
export function useToast() { return useContext(ToastContext); }
/* Tooltip */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null); const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const show = () => { const r = ref.current?.getBoundingClientRect(); if (!r) return; const w = Math.min(240, window.innerWidth - 16); const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8); const below = r.top < 44; setPos({ x, y: below ? r.bottom + 8 : r.top - 8, below }); };
  const hide = () => setPos(null);
  return <span ref={ref} className="ll-tooltip-wrap" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>{children}{pos && createPortal(<span role="tooltip" className="ll-tooltip" style={{ left: pos.x, top: pos.y, transform: pos.below ? 'none' : 'translateY(-100%)' }}>{label}</span>, document.body)}</span>;
}
/* Tabs / stepper */
export function Tabs<T extends string>({ tabs, value, onChange, ariaLabel }: { tabs: { value: T; label: string; icon?: ReactNode }[]; value: T; onChange(v: T): void; ariaLabel: string }) {
  return <div role="tablist" aria-label={ariaLabel} className="ll-tabs">{tabs.map(t => <button key={t.value} role="tab" aria-selected={value === t.value} className={clsx('ll-tab', value === t.value && 'is-active')} onClick={() => onChange(t.value)}>{t.icon}{t.label}</button>)}</div>;
}
export function Stepper({ steps, current, onStep }: { steps: { id: string; label: string; done?: boolean; reachable?: boolean }[]; current: string; onStep(id: string): void }) {
  return <ol className="ll-stepper">{steps.map((s, i) => <li key={s.id} className={clsx(s.id === current && 'is-current', s.done && 'is-done')}><button type="button" disabled={s.reachable === false} onClick={() => onStep(s.id)} aria-current={s.id === current ? 'step' : undefined}><span className="ll-stepper__num">{s.done ? <Check size={16} /> : i + 1}</span><span className="ll-stepper__label">{s.label}</span></button>{i < steps.length - 1 && <ChevronRight className="ll-stepper__sep" size={16} aria-hidden />}</li>)}</ol>;
}
/* Small primitives */
export function Kbd({ children }: { children: string }) { return <kbd className="ll-kbd">{children.split('+').map((k, i) => <span key={i}>{k}</span>)}</kbd>; }
export function Skeleton({ className }: { className?: string }) { return <div className={clsx('ll-skeleton', className)} aria-hidden />; }
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) { return <div className="ll-empty">{icon && <div className="ll-empty__icon">{icon}</div>}<h3 className="ll-h3">{title}</h3>{description && <p className="ll-muted">{description}</p>}{action}</div>; }
export function ProgressBar({ value, max = 100, label }: { value: number; max?: number; label?: string }) { if (!max) return <div className="ll-progress is-indeterminate" role="progressbar" aria-label={label}><div /></div>; const pct = Math.min(100, Math.round(value / max * 100)); return <div className="ll-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}><div style={{ width: `${pct}%` }} /></div>; }
export function Slider({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange(v: number): void; format?(v: number): string }) { const id = useId(); return <div className="ll-field"><label htmlFor={id} className="ll-label">{label} <span className="ll-muted">{format ? format(value) : value}</span></label><input id={id} type="range" className="ll-range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></div>; }
export function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange(v: boolean): void; description?: string }) { return <label className="ll-toggle"><button type="button" role="switch" aria-checked={checked} aria-label={label} className={clsx('ll-switch', checked && 'is-on')} onClick={() => onChange(!checked)}><span /></button><span><span className="ll-toggle__label">{label}</span>{description && <small className="ll-muted">{description}</small>}</span></label>; }
export function Input({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) { const id = useId(); return <div className="ll-field">{label && <label htmlFor={id} className="ll-label">{label}</label>}<input id={id} className={clsx('ll-input', className)} {...rest} /></div>; }
/** Numeric field that permits empty/in-progress text; clamps only on blur/Enter. */
export function NumberInput({ label, value, onCommit, min, max, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max'> & { label?: string; value: number; onCommit(n: number): void; min?: number; max?: number }) {
  const id = useId(); const [text, setText] = useState(String(value)); const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(String(value)); }, [value]);
  const commit = () => { focused.current = false; const n = Number(text); const next = text.trim() === '' || !Number.isFinite(n) ? (min ?? value) : Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)); setText(String(next)); onCommit(next); };
  return <div className="ll-field">{label && <label htmlFor={id} className="ll-label">{label}</label>}<input id={id} className={clsx('ll-input', className)} type="number" inputMode="numeric" min={min} max={max} value={text} onFocus={() => { focused.current = true; }} onChange={e => setText(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} {...rest} /></div>;
}
export function TextArea({ label, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) { const id = useId(); return <div className="ll-field">{label && <label htmlFor={id} className="ll-label">{label}</label>}<textarea id={id} className={clsx('ll-input ll-textarea', className)} {...rest} /></div>; }
export function Select({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) { const id = useId(); return <div className="ll-field">{label && <label htmlFor={id} className="ll-label">{label}</label>}<select id={id} className={clsx('ll-input ll-select', className)} {...rest}>{children}</select></div>; }
export function StatusDot({ tone = 'success' }: { tone?: 'success' | 'warning' | 'error' | 'muted' }) { return <span className={clsx('ll-status-dot', `ll-status-dot--${tone}`)} aria-hidden />; }
