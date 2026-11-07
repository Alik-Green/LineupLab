import { Chip } from './ui';
const CHARGES = [{ level: 1, label: '1st' }, { level: 2, label: '2nd' }, { level: 3, label: '3rd' }, { level: 4, label: 'Full' }];
export function chargeLevel(attributes: Record<string, unknown>): number {
  const explicit = Number(attributes.chargeLevel);
  if (Number.isFinite(explicit) && explicit >= 1 && explicit <= 4) return explicit;
  const legacy = Number(attributes.chargeStage ?? 0);
  return legacy <= 0 ? 1 : legacy === 1 ? 2 : 4;
}
/** Valorant-style dart charge bars + bounce diamonds; writes legacy fields too. */
export function DartControls({ attributes, onChange }: { attributes: Record<string, unknown>; onChange(next: Record<string, unknown>): void }) {
  const level = chargeLevel(attributes); const bounces = Math.min(2, Math.max(0, Number(attributes.bounces ?? 0)));
  const setCharge = (n: number) => onChange({ ...attributes, chargeLevel: n, chargeStage: Math.min(2, n - 1), chargeBars: n });
  const setBounces = (n: number) => onChange({ ...attributes, bounces: n });
  return <div className="ll-dart-controls" data-testid="dart-controls">
    <div className="ll-field"><span className="ll-label">Charge</span><div className="ll-charge-bars" role="radiogroup" aria-label="Dart charge">{CHARGES.map(c => <button key={c.level} type="button" role="radio" aria-checked={level === c.level} className={level >= c.level ? 'is-filled' : ''} onClick={() => setCharge(c.level)}><span className="ll-charge-bars__bar" /><small>{c.label}</small></button>)}</div></div>
    <div className="ll-field"><span className="ll-label">Bounces</span><div className="ll-bounce-diamonds" role="radiogroup" aria-label="Dart bounces">{[0, 1, 2].map(n => <Chip key={n} role="radio" aria-checked={bounces === n} selected={bounces === n} onClick={() => setBounces(n)}><span className="ll-diamond" aria-hidden />{n}</Chip>)}</div></div>
  </div>;
}
