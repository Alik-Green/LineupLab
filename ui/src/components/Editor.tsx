import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Check, ClipboardPaste, Eraser, ImagePlus, Pencil, Plus, Redo2, RefreshCw, Save, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import clsx from 'clsx';
import type { AbilityMode, Catalog, LibraryAdapter, Lineup, Point, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';
import { newLineup } from '../lib/adapter';
import { useHistory } from '../lib/history';
import { useMediaUrl } from '../lib/hooks';
import { autoTitle, isAttributeSpec, modeAttributes, modesFor, validateLineup, visibleSlots, WIZARD_STEPS, type WizardStep } from '../lib/modes';
import { abilityKey, DIFFICULTIES, enabledAbilities, SITES } from '../lib/game';
import { AnnotatedImage } from './AnnotatedImage';
import { AnnotationEditor } from './AnnotationEditor';
import { Minimap, type PinKey } from './Minimap';
import { Button, Card, Chip, EmptyState, IconButton, IconPicker, Input, Kbd, Modal, ProgressBar, Segmented, Select, Stepper, TextArea, Toggle, Tooltip, useToast } from './ui';
import { listen } from '@tauri-apps/api/event';

const PIN_TOOLS: { id: PinKey | 'bounces'; label: string; required?: boolean }[] = [{ id: 'stand1Pos', label: 'Stand', required: true }, { id: 'aim1Pos', label: 'Aim' }, { id: 'stand2Pos', label: '2nd stand' }, { id: 'aim2Pos', label: '2nd aim' }, { id: 'landPos', label: 'Landing', required: true }, { id: 'bounces', label: 'Bounce' }];
const THROW_TYPES = ['normal', 'run', 'jump', 'jump-throw', 'crouch'];

export function Editor({ adapter, lineupId, catalog, modes, lineups = [], onSaved, onCancel }: { adapter: LibraryAdapter; lineupId?: string | null; catalog: Catalog | null; modes: AbilityMode[]; lineups?: Lineup[]; onSaved(next?: boolean): void; onCancel(): void }) {
  const toast = useToast();
  const initial = useMemo(() => newLineup(), []);
  const h = useHistory<Lineup>(initial); const l = h.state;
  const [loaded, setLoaded] = useState(!lineupId); const [step, setStep] = useState<WizardStep>('setup'); const [active, setActive] = useState<SlotId>('stand1');
  const [busy, setBusy] = useState(false); const [annotate, setAnnotate] = useState(false); const [showIssues, setShowIssues] = useState(false);
  const [draftFound, setDraftFound] = useState<Lineup | null>(null); const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved'>('idle'); const [draftAt, setDraftAt] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false); const [keys, setKeys] = useState<Record<string, string>>({});
  const [pinTool, setPinTool] = useState<PinKey | 'bounces' | null>('stand1Pos');
  const lastCaptured = useRef<SlotId | null>(null); const baseline = useRef(JSON.stringify(initial)); const fileRef = useRef<HTMLInputElement>(null);
  const draftKey = `lineuplab.draft.${lineupId ?? 'new'}`;
  const key = (action: string) => keys[action] ?? ({ capture: 'Alt+C', retake: 'Alt+R', save: 'Alt+S', save_next: 'Alt+Shift+S', discard: 'Alt+D', undo: 'Alt+Z', redo: 'Alt+Y', crosshair_circle: 'Alt+X', next_slot: 'Alt+N', prev_slot: 'Alt+P' } as Record<string, string>)[action] ?? '';
  useEffect(() => { void adapter.getHotkeys().then(bs => setKeys(Object.fromEntries(bs.map(b => [b.action, b.keys])))).catch(() => {}); }, [adapter]);
  useEffect(() => { let live = true; (async () => {
    let existing: Lineup | null = null;
    if (lineupId) { existing = await adapter.getLineup(lineupId); if (live && existing) { h.reset(existing); baseline.current = JSON.stringify(existing); setStep('capture'); } }
    try { const raw = localStorage.getItem(draftKey); if (raw && live) { const d = JSON.parse(raw) as Lineup; if (!existing || d.updatedAt > existing.updatedAt) setDraftFound(d); } } catch { /* ignore corrupt draft */ }
    if (live) setLoaded(true);
  })(); return () => { live = false; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineupId]);
  const dirty = JSON.stringify(l) !== baseline.current;
  useEffect(() => { if (!loaded || !dirty) return; setDraftState('saving'); const t = setTimeout(() => { try { localStorage.setItem(draftKey, JSON.stringify({ ...l, draft: true, updatedAt: new Date().toISOString() })); setDraftState('saved'); setDraftAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); } catch { setDraftState('idle'); } }, 400); return () => clearTimeout(t); }, [l, loaded, dirty, draftKey]);

  const agent = catalog?.agents.find(a => a.uuid === l.agentUuid); const map = catalog?.maps.find(m => m.uuid === l.mapUuid);
  const abilities = enabledAbilities(agent);
  const availableModes = useMemo(() => modesFor(agent?.displayName, l.abilitySlot, modes), [agent?.displayName, l.abilitySlot, modes]);
  const mode = availableModes.find(m => m.id === l.mode) ?? availableModes[0];
  const required: SlotId[] = mode?.requiredSlots ?? ['stand1', 'aim1', 'landing'];
  const visible = visibleSlots(required, l.slots);
  const issues = validateLineup(l, required); const stepIssues = (s: WizardStep) => issues.filter(i => i.step === s);
  const mapUrl = map?.displayIcon; const slotUrl = useMediaUrl(adapter, l.slots[active].image);
  const capturedRequired = required.filter(s => l.slots[s].image).length;
  const contextLineups = useMemo(() => lineups.filter(x => x.id !== l.id && !x.deleted && x.mapUuid === l.mapUuid && x.agentUuid === l.agentUuid && x.abilitySlot === l.abilitySlot), [lineups, l.id, l.mapUuid, l.agentUuid, l.abilitySlot]);

  const patch = (p: Partial<Lineup>) => h.set(prev => ({ ...prev, ...p }));
  const withSetup = (prev: Lineup, p: Partial<Lineup>): Lineup => {
    let next = { ...prev, ...p };
    const ag = catalog?.agents.find(a => a.uuid === next.agentUuid); const ab = enabledAbilities(ag);
    if (next.agentUuid && !ab.some(a => a.slot === next.abilitySlot)) next.abilitySlot = ab[0]?.slot ?? '';
    const ms = modesFor(ag?.displayName, next.abilitySlot, modes); const m = ms.find(x => x.id === next.mode) ?? ms[0];
    if (m && (m.id !== next.mode || p.mode)) next = { ...next, mode: m.id, attributes: { ...next.attributes, ...modeAttributes(m) }, extensions: { ...next.extensions, attribute_forms: {} } };
    return next;
  };
  const setSetup = (p: Partial<Lineup>) => h.set(prev => withSetup(prev, p));
  const setImage = (slot: SlotId, hash: string | null) => { h.set(prev => ({ ...prev, slots: { ...prev.slots, [slot]: { ...prev.slots[slot], image: hash } } })); if (hash) lastCaptured.current = slot; };
  const afterImage = (slot: SlotId, hash: string) => { const slots = { ...l.slots, [slot]: { ...l.slots[slot], image: hash } }; const n = visibleSlots(required, slots).find(s => !slots[s].image); if (n) setActive(n); };
  const capture = async (slot: SlotId) => { setBusy(true); try { const t = performance.now(); const r = await adapter.captureMonitor(); const ms = Math.round(performance.now() - t); setImage(slot, r.hash); afterImage(slot, r.hash); toast.push(`Captured ${SLOT_LABELS[slot]} · ${r.width}×${r.height} in ${r.elapsedMs || ms} ms`, 'success'); } catch (e) { toast.push(String(e), 'error'); } finally { setBusy(false); } };
  const retake = () => { const target = lastCaptured.current ?? active; setActive(target); void capture(target); };
  const setSlotImage = useCallback(async (slot: SlotId, file: File) => { setBusy(true); try { const hash = await adapter.putImage(new Uint8Array(await file.arrayBuffer()), file.type || 'image/png'); h.set(prev => ({ ...prev, slots: { ...prev.slots, [slot]: { ...prev.slots[slot], image: hash } } })); lastCaptured.current = slot; toast.push(`${SLOT_LABELS[slot]} image added`, 'success'); } catch (e) { toast.push(String(e), 'error'); } finally { setBusy(false); } }, [adapter, h, toast]);
  useEffect(() => { const onPaste = (e: ClipboardEvent) => { const tag = (e.target as HTMLElement)?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return; const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/')); const file = item?.getAsFile(); if (file) { e.preventDefault(); setStep('capture'); void setSlotImage(active, file); } }; window.addEventListener('paste', onPaste); return () => window.removeEventListener('paste', onPaste); }, [active, setSlotImage]);
  const addCircle = () => { const last = lastCaptured.current; const target: SlotId = last === 'aim1' || last === 'aim2' ? last : active; if (!l.slots[target].image) { toast.push('Capture an aim image first.', 'warning'); return; } setStep('capture'); setActive(target); h.set(prev => ({ ...prev, slots: { ...prev.slots, [target]: { ...prev.slots[target], circles: [...prev.slots[target].circles, { id: crypto.randomUUID(), color: 'cyan', x: 0.5, y: 0.5, radius: 0.025, showZoom: false, zoomScale: 3.5, zoomSize: 0.24, zoomX: 0.72, zoomY: 0.04 }] } } })); toast.push(`Crosshair circle added to ${SLOT_LABELS[target]}`, 'success'); };
  const goStep = (s: WizardStep) => { if (s === 'details' && !l.title.trim()) { const t = autoTitle(l, catalog); if (t) patch({ title: t }); } setStep(s); };
  const next = () => { const i = WIZARD_STEPS.findIndex(s => s.id === step); if (step === 'setup' && stepIssues('setup').length) { setShowIssues(true); toast.push(stepIssues('setup')[0].message, 'warning'); return; } const n = WIZARD_STEPS[Math.min(WIZARD_STEPS.length - 1, i + 1)]; goStep(n.id); };
  const back = () => { const i = WIZARD_STEPS.findIndex(s => s.id === step); goStep(WIZARD_STEPS[Math.max(0, i - 1)].id); };
  const save = async (saveNext: boolean) => {
    if (issues.length) { setShowIssues(true); setStep(issues[0].step); if (issues[0].slot) setActive(issues[0].slot); toast.push(issues[0].message, 'warning'); return; }
    setBusy(true); try { const saved = await adapter.saveLineup({ ...l, title: l.title.trim() }); localStorage.removeItem(draftKey); baseline.current = JSON.stringify(saved); h.reset(saved); setDraftState('idle'); setDraftFound(null); toast.push('Lineup saved.', 'success');
      if (saveNext) { const fresh = { ...newLineup(), mapUuid: l.mapUuid, agentUuid: l.agentUuid, abilitySlot: l.abilitySlot, mode: l.mode, side: l.side, site: l.site, attributes: { ...l.attributes } }; h.reset(fresh); baseline.current = JSON.stringify(fresh); lastCaptured.current = null; setActive('stand1'); setShowIssues(false); setStep('capture'); } else onSaved(false);
    } catch (e) { toast.push(String(e), 'error'); } finally { setBusy(false); }
  };
  const saveDraft = () => { try { localStorage.setItem(draftKey, JSON.stringify({ ...l, draft: true, updatedAt: new Date().toISOString() })); setDraftState('saved'); setDraftAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); toast.push('Draft saved on this device. Reopen Create to restore it.', 'success'); } catch (e) { toast.push(String(e), 'error'); } };
  const discard = () => { localStorage.removeItem(draftKey); setConfirmDiscard(false); setDraftFound(null); setShowIssues(false); lastCaptured.current = null; if (lineupId) void adapter.getLineup(lineupId).then(x => { const v = x ?? newLineup(); h.reset(v); baseline.current = JSON.stringify(v); }); else { const v = newLineup(); h.reset(v); baseline.current = JSON.stringify(v); } setActive('stand1'); setStep('setup'); setDraftState('idle'); toast.push('Draft discarded.', 'warning'); };
  const hotkeyHandler = useRef<(a: string) => void>(() => {});
  hotkeyHandler.current = (a: string) => {
    if (a === 'capture') { setStep('capture'); void capture(active); } else if (a === 'retake') { setStep('capture'); retake(); } else if (a === 'save') void save(false); else if (a === 'save_next') void save(true); else if (a === 'discard') setConfirmDiscard(true);
    else if (a === 'undo') h.undo(); else if (a === 'redo') h.redo(); else if (a === 'crosshair_circle') addCircle();
    else if (a.startsWith('slot_')) { const s = a.slice(5) as SlotId; if (SLOT_ORDER.includes(s)) { setActive(s); setStep('capture'); } }
    else if (a === 'next_slot' || a === 'prev_slot') { const i = visible.indexOf(active); const n = visible[(i + (a === 'next_slot' ? 1 : visible.length - 1)) % visible.length]; if (n) { setActive(n); setStep('capture'); } }
  };
  useEffect(() => { if (adapter.kind !== 'tauri') return; let live = true; let un: (() => void) | undefined; void listen<string>('lineuplab://hotkey', e => hotkeyHandler.current(e.payload)).then(f => { if (live) un = f; else f(); }); return () => { live = false; un?.(); }; }, [adapter]);
  const onMapClick = (p: Point) => { if (!pinTool) return; if (pinTool === 'bounces') patch({ bounces: [...l.bounces, p] }); else patch({ [pinTool]: p } as Partial<Lineup>); };
  const previewSlot: SlotId = l.slots.landing.image ? 'landing' : l.slots.aim1.image ? 'aim1' : 'stand1';
  if (!loaded) return <div className="ll-wizard"><EmptyState title="Loading lineup…" /></div>;
  const stepperSteps = WIZARD_STEPS.map(s => ({ id: s.id, label: s.label, done: s.id === 'review' ? issues.length === 0 : stepIssues(s.id).length === 0 && (s.id !== 'setup' || !!l.mapUuid) }));
  return <div className="ll-wizard" data-testid="editor" data-step={step}>
    <div className="ll-wizard__top">
      <Stepper steps={stepperSteps} current={step} onStep={id => goStep(id as WizardStep)} />
      <div className="ll-wizard__status"><span className={clsx('ll-autosave', draftState === 'saving' && 'is-saving')} role="status">{draftState === 'saving' ? 'Saving draft…' : draftState === 'saved' ? `Draft saved ${draftAt}` : dirty ? 'Unsaved changes' : 'Draft autosaves as you work'}</span>
        <Tooltip label={`Undo (${key('undo')})`}><IconButton label="Undo" onClick={h.undo} disabled={!h.canUndo}><Undo2 size={16} /></IconButton></Tooltip><Tooltip label={`Redo (${key('redo')})`}><IconButton label="Redo" onClick={h.redo} disabled={!h.canRedo}><Redo2 size={16} /></IconButton></Tooltip>
        <Button variant="ghost" icon={<Save size={16} />} onClick={saveDraft}>Save draft</Button><Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setConfirmDiscard(true)}>Discard</Button><Button variant="ghost" icon={<X size={16} />} onClick={onCancel}>Close</Button></div>
    </div>
    {draftFound && <div className="ll-recovery" role="alert"><RefreshCw size={16} /><span>An unsaved draft from {new Date(draftFound.updatedAt).toLocaleString()} is available{draftFound.title ? `: “${draftFound.title}”` : ''}.</span><Button size="md" variant="primary" onClick={() => { h.reset(draftFound); setDraftFound(null); setStep('capture'); toast.push('Draft restored.', 'success'); }}>Restore draft</Button><Button size="md" variant="ghost" onClick={() => { localStorage.removeItem(draftKey); setDraftFound(null); }}>Ignore</Button></div>}
    <div className="ll-wizard__body">
      {step === 'setup' && <div className="ll-setup" data-testid="wizard-setup">
        <Card><div className="ll-selector-head"><h2 className="ll-h2">Map</h2>{showIssues && stepIssues('setup').filter(i => i.field === 'map').map(i => <span key={i.field} className="ll-inline-error">{i.message}</span>)}</div><IconPicker ariaLabel="Map" kind="map" size="lg" value={l.mapUuid} onChange={v => setSetup({ mapUuid: v })} options={(catalog?.maps ?? []).map(m => ({ id: m.uuid, name: m.displayName + (m.isArchived ? ' (archived)' : ''), icon: m.listViewIcon || m.splash || m.displayIcon }))} /></Card>
        <Card><div className="ll-selector-head"><h2 className="ll-h2">Agent</h2>{showIssues && stepIssues('setup').filter(i => i.field === 'agent').map(i => <span key={i.field} className="ll-inline-error">{i.message}</span>)}</div><IconPicker ariaLabel="Agent" kind="agent" value={l.agentUuid} onChange={v => setSetup({ agentUuid: v })} options={(catalog?.agents ?? []).map(a => ({ id: a.uuid, name: a.displayName + (a.isArchived ? ' (archived)' : ''), icon: a.displayIcon, sublabel: a.role ?? undefined }))} /></Card>
        <div className="ll-setup__row"><Card><div className="ll-selector-head"><h2 className="ll-h2">Ability</h2>{!agent && <span className="ll-muted">Choose an agent first</span>}</div><IconPicker ariaLabel="Ability" kind="ability" size="lg" value={l.abilitySlot} onChange={v => v && setSetup({ abilitySlot: v })} options={abilities.map(a => ({ id: a.slot, name: a.displayName, icon: a.displayIcon, sublabel: abilityKey(a.slot) }))} />{abilities.length === 0 && agent && <p className="ll-muted">No lineup-able abilities for {agent.displayName}.</p>}</Card>
          <Card><h2 className="ll-h2 mb-2">Mode</h2><div className="ll-mode-list" role="radiogroup" aria-label="Mode">{availableModes.map(m => <button key={m.id} role="radio" aria-checked={mode?.id === m.id} className={clsx('ll-mode', mode?.id === m.id && 'is-selected')} onClick={() => setSetup({ mode: m.id })}><strong>{m.label}</strong><small>{m.requiredSlots.map(s => SLOT_LABELS[s]).join(' · ')}{m.optionalSlots?.length ? ` · optional: ${m.optionalSlots.map(s => SLOT_LABELS[s]).join(', ')}` : ''}</small></button>)}</div>
            {mode && Object.keys(mode.attributes).length > 0 && <div className="ll-attrs">{Object.entries(mode.attributes).map(([k, spec]) => isAttributeSpec(spec) ? (spec.type === 'boolean' ? <Toggle key={k} label={k} checked={Boolean(l.attributes[k] ?? spec.default)} onChange={v => patch({ attributes: { ...l.attributes, [k]: v } })} /> : <Input key={k} label={k} type="number" min={spec.min} max={spec.max} value={Number(l.attributes[k] ?? spec.default ?? 0)} onChange={e => patch({ attributes: { ...l.attributes, [k]: Number(e.target.value) } })} />) : <Chip key={k} selected>{k}: {String(l.attributes[k] ?? spec)}</Chip>)}</div>}
          </Card></div>
      </div>}
      {step === 'capture' && <div className="ll-capture" data-testid="wizard-capture">
        <aside className="ll-slot-rail" aria-label="Capture slots">{SLOT_ORDER.map((s, i) => { const req = required.includes(s); const has = !!l.slots[s].image; const opt = !req && !visible.includes(s); return <button key={s} className={clsx('ll-slot', active === s && 'is-active', has && 'is-done', showIssues && req && !has && 'is-missing')} onClick={() => setActive(s)} aria-current={active === s ? 'true' : undefined} data-testid={`slot-${s}`}>
          <span className="ll-slot__thumb">{has ? <AnnotatedImage src={l.slots[s].image!} slot={l.slots[s]} alt="" hideLens className="ll-slot__img" /> : <ImagePlus size={20} />}</span><span className="ll-slot__text"><strong>{SLOT_LABELS[s]}{req && <em aria-label="required">*</em>}{opt && <small> optional</small>}</strong><Kbd>{key(`slot_${s}`) || `Alt+${i + 1}`}</Kbd></span>{has && <Check size={16} className="ll-slot__check" />}</button>; })}
          <div className="ll-slot-progress"><span>{capturedRequired}/{required.length} required</span><ProgressBar value={capturedRequired} max={required.length} label="Required captures" /></div>
          <p className="ll-muted ll-slot-hint"><Kbd>{key('next_slot')}</Kbd> <Kbd>{key('prev_slot')}</Kbd> switch slots · hotkeys work on every step</p>
        </aside>
        <section className="ll-stage-card" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith('image/')) void setSlotImage(active, f); }}>
          <div className="ll-stage-card__head"><div><h2 className="ll-h2">{SLOT_LABELS[active]}{required.includes(active) && <span className="ll-req"> required</span>}</h2><p className="ll-muted">{mode?.label} · {agent?.displayName ?? 'No agent'} · {map?.displayName ?? 'No map'}</p></div>
            <div className="ll-stage-card__tools"><Button variant="primary" icon={<Camera size={16} />} loading={busy} onClick={() => capture(active)}>Capture <Kbd>{key('capture')}</Kbd></Button><Button icon={<ImagePlus size={16} />} onClick={() => fileRef.current?.click()}>Choose image</Button><Tooltip label="Paste an image from the clipboard (Ctrl+V)"><Button icon={<ClipboardPaste size={16} />} onClick={() => toast.push('Press Ctrl+V to paste a copied image into this slot.', 'info')}>Paste</Button></Tooltip><Button icon={<RefreshCw size={16} />} onClick={retake} disabled={!lastCaptured.current && !l.slots[active].image}>Retake <Kbd>{key('retake')}</Kbd></Button>{l.slots[active].image && <><Button variant={annotate ? 'primary' : 'secondary'} icon={<Pencil size={16} />} onClick={() => setAnnotate(a => !a)}>{annotate ? 'Done annotating' : 'Annotate'}</Button><Button variant="danger" icon={<Eraser size={16} />} onClick={() => { setImage(active, null); setAnnotate(false); }}>Clear</Button></>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void setSlotImage(active, f); e.target.value = ''; }} /></div></div>
          {showIssues && stepIssues('capture').map(i => <p key={i.field} className="ll-inline-error">{i.message}</p>)}
          <div className={clsx('ll-stage', !slotUrl && 'is-empty')}>
            {slotUrl ? (annotate ? <AnnotationEditor key={`${l.id}-${active}`} src={slotUrl} activeSlot={active} slot={l.slots[active]} onChange={s => h.set(prev => ({ ...prev, slots: { ...prev.slots, [active]: s } }))} onCopyTo={(target, circles, lines) => h.set(prev => ({ ...prev, slots: { ...prev.slots, [target]: { ...prev.slots[target], circles: [...prev.slots[target].circles, ...circles.map(c => ({ ...c, id: crypto.randomUUID() }))], lines: [...prev.slots[target].lines, ...lines.map(x => ({ ...x, id: crypto.randomUUID() }))] } } }))} /> : <AnnotatedImage src={slotUrl} slot={l.slots[active]} alt={SLOT_LABELS[active]} className="ll-stage__img" />)
              : <EmptyState icon={<Camera size={28} />} title={`Capture the ${SLOT_LABELS[active].toLowerCase()} view`} description={`Press ${key('capture')} while Valorant is visible, or drop / paste / choose an image. The overlay is excluded from capture automatically.`} action={<Button variant="primary" icon={<Camera size={16} />} loading={busy} onClick={() => capture(active)}>Capture monitor</Button>} />}
          </div>
          {!annotate && l.slots[active].image && <p className="ll-muted ll-stage-hint">Circles: {l.slots[active].circles.length} · Lines: {l.slots[active].lines.length} · <Kbd>{key('crosshair_circle')}</Kbd> adds a crosshair circle to the last aim capture · originals are never modified</p>}
        </section>
      </div>}
      {step === 'pins' && <div className="ll-pins" data-testid="wizard-pins">
        <div className="ll-pins__tools"><h2 className="ll-h2">Minimap pins</h2><p className="ll-muted">Pick a tool, click the map to place, drag markers to fine-tune. Stand and landing pins are required.</p><div className="ll-pins__palette" role="radiogroup" aria-label="Pin tool">{PIN_TOOLS.map(t => <Chip key={t.id} role="radio" aria-checked={pinTool === t.id} selected={pinTool === t.id} onClick={() => setPinTool(t.id)} tone={t.id === 'landPos' ? 'attack' : t.id.startsWith('stand') ? 'defense' : 'neutral'}>{t.label}{t.required ? ' *' : ''}</Chip>)}<Chip selected={pinTool === null} onClick={() => setPinTool(null)}>Pan / zoom</Chip></div>
          {showIssues && stepIssues('pins').map(i => <p key={i.field} className="ll-inline-error">{i.message}</p>)}
          <ul className="ll-pin-list">{PIN_TOOLS.filter(t => t.id !== 'bounces').map(t => { const p = l[t.id as PinKey]; return <li key={t.id}><span>{t.label}{t.required ? ' *' : ''}</span>{p ? <code>{p.x.toFixed(3)}, {p.y.toFixed(3)}</code> : <span className="ll-muted">not placed</span>}<IconButton label={`Remove ${t.label} pin`} disabled={!p} onClick={() => patch({ [t.id]: null } as Partial<Lineup>)}><X size={14} /></IconButton></li>; })}<li><span>Bounces</span><code>{l.bounces.length}</code><IconButton label="Remove last bounce" disabled={!l.bounces.length} onClick={() => patch({ bounces: l.bounces.slice(0, -1) })}><X size={14} /></IconButton></li></ul>
          <Button variant="ghost" icon={<Eraser size={16} />} onClick={() => patch({ stand1Pos: null, aim1Pos: null, stand2Pos: null, aim2Pos: null, landPos: null, bounces: [] })}>Clear all pins</Button>
          {contextLineups.length > 0 && <p className="ll-muted">Faint rings show {contextLineups.length} existing {agent?.displayName} lineup{contextLineups.length === 1 ? '' : 's'} on this map.</p>}
        </div>
        <Minimap src={mapUrl} lineups={[]} contextLineups={contextLineups} editablePins={{ stand1Pos: l.stand1Pos, aim1Pos: l.aim1Pos, stand2Pos: l.stand2Pos, aim2Pos: l.aim2Pos, landPos: l.landPos }} editableBounces={l.bounces} onPinChange={(k, p) => patch({ [k]: p } as Partial<Lineup>)} activePinTool={pinTool} onMapClick={onMapClick} className="ll-pins__map" emptyMessage={null} />
      </div>}
      {step === 'details' && <div className="ll-details" data-testid="wizard-details">
        <Card className="ll-details__main"><div className="ll-selector-head"><h2 className="ll-h2">Title</h2><Button size="md" variant="ghost" icon={<Sparkles size={14} />} onClick={() => patch({ title: autoTitle(l, catalog) })}>Suggest title</Button></div><Input aria-label="Title" placeholder="e.g. Sova Recon Bolt · Abyss B (Attack)" value={l.title} onChange={e => patch({ title: e.target.value })} className="ll-title-input" />{showIssues && stepIssues('details').map(i => <p key={i.field} className="ll-inline-error">{i.message}</p>)}
          <div className="ll-form-grid"><div className="ll-field"><span className="ll-label">Side</span><Segmented ariaLabel="Side" value={l.side} onChange={v => patch({ side: v })} options={[{ value: 'attack', label: 'Attack' }, { value: 'defense', label: 'Defense' }, { value: 'both', label: 'Both' }]} /></div>
            <div className="ll-field"><span className="ll-label">Site</span><div className="ll-site-chips">{SITES.map(s => <Chip key={s} selected={l.site === s} onClick={() => patch({ site: l.site === s ? '' : s })}>{s}</Chip>)}<Input aria-label="Custom site" placeholder="Custom…" value={SITES.includes(l.site) ? '' : l.site} onChange={e => patch({ site: e.target.value })} /></div></div>
            <div className="ll-field"><span className="ll-label">Difficulty</span><Segmented ariaLabel="Difficulty" value={l.difficulty} onChange={v => patch({ difficulty: v })} options={DIFFICULTIES.map(d => ({ value: d, label: d }))} /></div>
            <Select label="Throw type" value={l.throwType} onChange={e => patch({ throwType: e.target.value })}>{THROW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</Select>
            <Input label="Tags (comma-separated)" value={l.tags.join(', ')} onChange={e => patch({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} placeholder="recon, post-plant" />
            <Input label="Author" value={l.author} onChange={e => patch({ author: e.target.value })} placeholder="Your name" />
          </div><div className="ll-tag-preview">{l.tags.map(t => <Chip key={t}>{t}</Chip>)}</div><Toggle label="Favorite" checked={l.isFavorite} onChange={v => patch({ isFavorite: v })} description="Pin this lineup to the top of Favorites sort." />
          <TextArea label="Notes" rows={5} value={l.notes} onChange={e => patch({ notes: e.target.value })} placeholder="Anything worth remembering: timing, callouts, alternatives…" /></Card>
        <Card className="ll-details__steps"><div className="ll-selector-head"><h2 className="ll-h2">Steps</h2><Button size="md" icon={<Plus size={14} />} onClick={() => patch({ steps: [...l.steps, { order: l.steps.length + 1, text: '' }] })}>Add step</Button></div>
          {l.steps.length === 0 && <p className="ll-muted">No steps yet. The overlay checklist can show these one by one.</p>}
          <ol className="ll-step-editor">{l.steps.map((s, i) => <li key={i}><span className="ll-steps__num">{i + 1}</span><div className="ll-step-editor__body"><TextArea aria-label={`Step ${i + 1} text`} rows={2} value={s.text} onChange={e => patch({ steps: l.steps.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} placeholder="Stand on the marked corner…" /><div className="ll-step-editor__img"><span className="ll-muted">Image:</span><Chip selected={!s.imageRef} onClick={() => patch({ steps: l.steps.map((x, j) => j === i ? { ...x, imageRef: null } : x) })}>None</Chip>{SLOT_ORDER.filter(k => l.slots[k].image).map(k => <Chip key={k} selected={s.imageRef === l.slots[k].image} onClick={() => patch({ steps: l.steps.map((x, j) => j === i ? { ...x, imageRef: l.slots[k].image } : x) })}>{SLOT_LABELS[k]}</Chip>)}</div></div>
            <div className="ll-step-editor__actions"><IconButton label="Move step up" disabled={i === 0} onClick={() => { const arr = [...l.steps]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; patch({ steps: arr.map((x, j) => ({ ...x, order: j + 1 })) }); }}><ArrowUp size={14} /></IconButton><IconButton label="Move step down" disabled={i === l.steps.length - 1} onClick={() => { const arr = [...l.steps]; [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; patch({ steps: arr.map((x, j) => ({ ...x, order: j + 1 })) }); }}><ArrowDown size={14} /></IconButton><IconButton label="Remove step" onClick={() => patch({ steps: l.steps.filter((_, j) => j !== i).map((x, j) => ({ ...x, order: j + 1 })) })}><Trash2 size={14} /></IconButton></div></li>)}</ol>
          <Button variant="ghost" size="md" onClick={() => patch({ steps: [{ order: 1, text: 'Stand on the marked spot', imageRef: l.slots.stand1.image }, { order: 2, text: 'Align the crosshair with the circle', imageRef: l.slots.aim1.image }, { order: 3, text: 'Throw and confirm the landing', imageRef: l.slots.landing.image }].filter(s => s.text) })}>Generate from captures</Button></Card>
      </div>}
      {step === 'review' && <div className="ll-review" data-testid="wizard-review">
        <Card className="ll-review__preview"><h2 className="ll-h2 mb-2">{l.title || 'Untitled lineup'}</h2><div className="ll-detail__badges"><Chip selected tone={l.side === 'attack' ? 'attack' : l.side === 'defense' ? 'defense' : 'neutral'}>{l.side}</Chip><Chip selected>{l.site || '—'}</Chip><Chip>{map?.displayName ?? 'No map'}</Chip><Chip>{agent?.displayName ?? 'No agent'}</Chip><Chip>{mode?.label}</Chip><Chip>{l.throwType}</Chip><Chip>{l.difficulty}</Chip></div>
          {l.slots[previewSlot].image ? <AnnotatedImage src={l.slots[previewSlot].image!} slot={l.slots[previewSlot]} alt="Preview" className="ll-review__img" /> : <EmptyState title="No preview image yet" description="Capture at least one slot to see a preview." />}<p className="ll-muted">{SLOT_LABELS[previewSlot]} preview · {l.steps.length} steps · {l.tags.length} tags</p></Card>
        <div className="ll-review__side"><Minimap src={mapUrl} lineups={[{ ...l, id: 'draft-preview' }]} selectedId="draft-preview" showToolbar={false} className="ll-review__map" />
          <Card><h2 className="ll-h2 mb-2">Validation</h2>{issues.length === 0 ? <p className="ll-ok"><Check size={16} /> Ready to save. All required images, pins and details are in place.</p> : <ul className="ll-issues">{issues.map(i => <li key={`${i.step}-${i.field}`}><span>{i.message}</span><Button size="md" variant="ghost" onClick={() => { setShowIssues(true); setStep(i.step); if (i.slot) setActive(i.slot); }}>Fix</Button></li>)}</ul>}
            <div className="ll-review__actions"><Button variant="primary" size="lg" icon={<Save size={18} />} loading={busy} onClick={() => save(false)} disabled={issues.length > 0}>Save lineup <Kbd>{key('save')}</Kbd></Button><Button size="lg" icon={<ArrowRight size={18} />} onClick={() => save(true)} disabled={issues.length > 0}>Save & next <Kbd>{key('save_next')}</Kbd></Button></div><p className="ll-muted">Save & next keeps map, agent, ability, mode, side and site for a quick series.</p></Card></div>
      </div>}
    </div>
    <footer className="ll-wizard__foot"><Button icon={<ArrowLeft size={16} />} onClick={back} disabled={step === 'setup'}>Back</Button><span className="ll-muted">{WIZARD_STEPS.findIndex(s => s.id === step) + 1} / {WIZARD_STEPS.length} · {WIZARD_STEPS.find(s => s.id === step)?.label}</span>{step !== 'review' ? <Button variant="primary" onClick={next}>Next <ArrowRight size={16} /></Button> : <Button variant="primary" icon={<Save size={16} />} loading={busy} disabled={issues.length > 0} onClick={() => save(false)}>Save lineup</Button>}</footer>
    <Modal open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title="Discard this draft?" footer={<><Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button><Button variant="danger" icon={<Trash2 size={16} />} onClick={discard}>Discard draft</Button></>}><p>This removes the locally autosaved draft{lineupId ? ' and restores the last saved version of the lineup' : ''}. Captured images already stored in the library are not deleted.</p></Modal>
  </div>;
}
