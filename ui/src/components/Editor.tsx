import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Camera, Check, Crosshair, Eraser, Footprints, ImagePlus, MapPin, Pencil, Plus, Redo2, RefreshCw, Save, Settings2, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import clsx from 'clsx';
import type { AbilityMode, Catalog, LibraryAdapter, Lineup, Point, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';
import { newLineup } from '../lib/adapter';
import { useHistory } from '../lib/history';
import { useMediaUrl } from '../lib/hooks';
import { autoTitle, calloutsForMap, isAttributeSpec, modeAttributes, modesFor, validateLineup, visibleSlots, WIZARD_STEPS, type WizardStep } from '../lib/modes';
import { abilityKey, DIFFICULTIES, enabledAbilities, standardMaps, sitesForMap } from '../lib/game';
import { BrowsePicker } from './BrowsePicker';
import { DartControls } from './DartControls';
import { AnnotatedImage } from './AnnotatedImage';
import { AnnotationEditor } from './AnnotationEditor';
import { Minimap, type PinKey } from './Minimap';
import { Button, Card, Chip, EmptyState, IconButton, IconPicker, Input, Kbd, Modal, ProgressBar, Segmented, Select, Stepper, TextArea, Toggle, Tooltip, useToast } from './ui';
import { emit, listen } from '@tauri-apps/api/event';
import type { OverlayDraft } from './OverlayView';

const PIN_TOOLS: { id: PinKey; label: string; required?: boolean }[] = [{ id: 'stand1Pos', label: 'Start', required: true }, { id: 'landPos', label: 'End', required: true }, { id: 'stand2Pos', label: 'Second start' }];
const THROW_TYPES = ['normal', 'run', 'jump', 'jump-throw', 'crouch'];
const DEFAULT_REQUIRED: SlotId[] = ['stand1', 'aim1', 'landing'];

export function Editor({ adapter, lineupId, catalog, modes, lineups = [], onSaved, onCancel }: { adapter: LibraryAdapter; lineupId?: string | null; catalog: Catalog | null; modes: AbilityMode[]; lineups?: Lineup[]; onSaved(next?: boolean): void; onCancel(): void }) {
  const toast = useToast();
  const initial = useMemo(() => newLineup(), []);
  const h = useHistory<Lineup>(initial); const l = h.state;
  const [loaded, setLoaded] = useState(!lineupId); const [step, setStep] = useState<WizardStep>('setup'); const [active, setActive] = useState<SlotId>('stand1');
  const [busy, setBusy] = useState(false); const [annotate, setAnnotate] = useState(false); const [showIssues, setShowIssues] = useState(false);
  const [draftFound, setDraftFound] = useState<Lineup | null>(null); const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved'>('idle'); const [draftAt, setDraftAt] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false); const [keys, setKeys] = useState<Record<string, string>>({});
  const [pinTool, setPinTool] = useState<PinKey | null>('stand1Pos');
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
  const maps = useMemo(() => standardMaps(catalog?.maps ?? []), [catalog]);
  const sites = sitesForMap(map?.displayName);
  const availableModes = useMemo(() => modesFor(agent?.displayName, l.abilitySlot, modes), [agent?.displayName, l.abilitySlot, modes]);
  const mode = availableModes.find(m => m.id === l.mode) ?? availableModes[0];
  const required: SlotId[] = mode?.requiredSlots ?? DEFAULT_REQUIRED;
  const hasSecondThrow = required.includes('aim2') || required.includes('stand2');
  const pinTools = PIN_TOOLS.filter(t => t.id !== 'stand2Pos' || hasSecondThrow);
  const isDart = agent?.displayName === 'Sova' && (l.abilitySlot === 'Grenade' || l.abilitySlot === 'Ability2');
  const visible = visibleSlots(required, l.slots);
  useEffect(() => { if (!visible.includes(active)) setActive(visible.find(s => !l.slots[s].image) ?? visible[0] ?? 'stand1'); }, [visible.join(','), active]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const save = async (saveNext: boolean) => {
    if (issues.length) { setShowIssues(true); setStep(issues[0].step); if (issues[0].slot) setActive(issues[0].slot); toast.push(issues[0].message, 'warning'); return; }
    setBusy(true); try { const persistedThrows = (['aim1', 'aim2'] as SlotId[]).filter(a => visible.includes(a) || l.slots[a].image).map(a => throwSpecFor(l, a)); const saved = await adapter.saveLineup({ ...l, mode: mode?.id ?? l.mode, title: l.title.trim(), throws: persistedThrows }); localStorage.removeItem(draftKey); baseline.current = JSON.stringify(saved); h.reset(saved); setDraftState('idle'); setDraftFound(null); toast.push('Lineup saved.', 'success');
      if (saveNext) { const fresh = { ...newLineup(), mapUuid: l.mapUuid, agentUuid: l.agentUuid, abilitySlot: l.abilitySlot, mode: l.mode, side: l.side, site: l.site, attributes: { ...l.attributes } }; h.reset(fresh); baseline.current = JSON.stringify(fresh); lastCaptured.current = null; setActive('stand1'); setShowIssues(false); setStep('capture'); } else onSaved(false);
    } catch (e) { toast.push(String(e), 'error'); } finally { setBusy(false); }
  };
  const discard = () => { localStorage.removeItem(draftKey); setConfirmDiscard(false); setDraftFound(null); setShowIssues(false); lastCaptured.current = null; if (lineupId) void adapter.getLineup(lineupId).then(x => { const v = x ?? newLineup(); h.reset(v); baseline.current = JSON.stringify(v); }); else { const v = newLineup(); h.reset(v); baseline.current = JSON.stringify(v); } setActive('stand1'); setStep('setup'); setDraftState('idle'); toast.push('Draft discarded.', 'warning'); };
  const hotkeyHandler = useRef<(a: string) => void>(() => {});
  hotkeyHandler.current = (a: string) => {
    if (a === 'capture') { setStep('capture'); void capture(active); } else if (a === 'retake') { setStep('capture'); retake(); } else if (a === 'save') void save(false); else if (a === 'save_next') void save(true); else if (a === 'discard') setConfirmDiscard(true);
    else if (a === 'undo') h.undo(); else if (a === 'redo') h.redo(); else if (a === 'crosshair_circle') addCircle();
    else if (a.startsWith('slot_')) { const s = a.slice(5) as SlotId; if (SLOT_ORDER.includes(s)) { setActive(s); setStep('capture'); } }
    else if (a === 'next_slot' || a === 'prev_slot') { const i = visible.indexOf(active); const n = visible[(i + (a === 'next_slot' ? 1 : visible.length - 1)) % visible.length]; if (n) { setActive(n); setStep('capture'); } }
  };
  useEffect(() => { if (adapter.kind !== 'tauri') return; let live = true; let un: (() => void) | undefined; void listen<string>('lineuplab://hotkey', e => hotkeyHandler.current(e.payload)).then(f => { if (live) un = f; else f(); }); return () => { live = false; un?.(); }; }, [adapter]);
  // UI-only bridge: the overlay window shows the live draft checklist/thumbnails without changing core state or hotkeys.
  const overlaySnapshot = useRef<OverlayDraft>({ editing: false });
  overlaySnapshot.current = loaded ? { editing: true, lineup: l, activeSlot: active, requiredSlots: required } : { editing: false };
  useEffect(() => { if (adapter.kind !== 'tauri') return; let live = true; let un: (() => void) | undefined; const publish = () => { void emit('lineuplab://overlay-draft', overlaySnapshot.current).catch(() => {}); }; void listen('lineuplab://overlay-draft-request', publish).then(f => { if (live) { un = f; publish(); } else f(); }); return () => { live = false; un?.(); void emit('lineuplab://overlay-draft', { editing: false }).catch(() => {}); }; }, [adapter]);
  useEffect(() => { if (adapter.kind !== 'tauri' || !loaded) return; const t = window.setTimeout(() => { void emit('lineuplab://overlay-draft', overlaySnapshot.current).catch(() => {}); }, 150); return () => window.clearTimeout(t); }, [adapter, loaded, l, active, required]);
  const onMapClick = (p: Point) => { if (!pinTool) return; patch({ [pinTool]: p } as Partial<Lineup>); };
  const throwIndex = (slot: SlotId) => slot === 'aim2' ? 2 : 1;
  const throwSpecFor = (lineup: Lineup, slot: SlotId) => { const idx = throwIndex(slot); const existing = lineup.throws.find(t => t.index === idx); const legacyCharge = Number(lineup.attributes.chargeLevel ?? 0) || (Number(lineup.attributes.chargeStage ?? 0) <= 0 ? 1 : Number(lineup.attributes.chargeStage) === 1 ? 2 : 4); return { index: idx, aimImage: lineup.slots[slot].image ?? null, standImage: lineup.slots[slot === 'aim2' ? 'stand2' : 'stand1'].image ?? null, chargeStage: Math.min(2, legacyCharge - 1), chargeBars: legacyCharge, bounces: Number(lineup.attributes.bounces ?? 0), focusCircles: [] as Lineup['throws'][number]['focusCircles'], throwType: lineup.throwType, ...(existing ?? {}), chargeLevel: Number(existing?.chargeLevel ?? legacyCharge) }; };
  const throwTypeFor = (slot: SlotId): string => throwSpecFor(l, slot).throwType;
  const updateThrow = (slot: SlotId, changes: Partial<Lineup['throws'][number]>) => { const idx = throwIndex(slot); h.set(prev => { const spec = { ...throwSpecFor(prev, slot), ...changes, index: idx, aimImage: prev.slots[slot].image ?? null, standImage: prev.slots[slot === 'aim2' ? 'stand2' : 'stand1'].image ?? null }; const throws = [...prev.throws.filter(t => t.index !== idx), spec].sort((a, b) => a.index - b.index); return { ...prev, throws, throwType: idx === 1 ? spec.throwType : prev.throwType }; }); };
  const setThrowType = (slot: SlotId, throwType: string) => updateThrow(slot, { throwType });
  const suggestedTitle = autoTitle(l, catalog);
  useEffect(() => { if (step === 'details' && !l.title.trim() && (l.stand1Pos || l.landPos)) patch({ title: suggestedTitle }); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const previewSlot: SlotId = l.slots.landing.image ? 'landing' : l.slots.aim1.image ? 'aim1' : 'stand1';
  if (!loaded) return <div className="ll-wizard"><EmptyState title="Loading lineup…" /></div>;
  const stageIcons = { setup: <Settings2 size={18} />, capture: <Camera size={18} />, pins: <MapPin size={18} />, details: <Check size={18} /> };
  const isShock = agent?.displayName === 'Sova' && l.abilitySlot === 'Ability2';
  const toggleMode = (id: string, enabled: boolean) => { const single = isShock ? 'single' : id === 'placement' ? 'standard' : 'standard'; setSetup({ mode: enabled ? id : single }); };
  const attrLabel = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
  return <div className="ll-wizard" data-testid="editor" data-step={step}>
    {draftFound && <div className="ll-recovery" role="alert"><RefreshCw size={16} /><span>Unsaved draft: {draftFound.title || new Date(draftFound.updatedAt).toLocaleString()}</span><Button size="md" variant="primary" onClick={() => { h.reset(draftFound); setDraftFound(null); setStep('capture'); }}>Restore</Button><Button size="md" variant="ghost" onClick={() => { localStorage.removeItem(draftKey); setDraftFound(null); }}>Ignore</Button></div>}
    <div className="ll-wizard__workspace">
      <main className="ll-wizard__body">
      {step === 'setup' && <div className="ll-setup" data-testid="wizard-setup">
        <div className="ll-browse__pickers ll-setup__pickers">
          <BrowsePicker square label="Map" kind="map-art" allLabel="Choose map" value={l.mapUuid} onChange={v => setSetup({ mapUuid: v })} options={maps.map(m => ({ id: m.uuid, name: m.displayName, icon: m.splash || m.listViewIcon || m.displayIcon }))} searchable />
          <BrowsePicker square label="Agent" kind="agent" allLabel="Choose agent" value={l.agentUuid} onChange={v => setSetup({ agentUuid: v })} options={(catalog?.agents ?? []).map(a => ({ id: a.uuid, name: a.displayName, icon: a.displayIcon, sublabel: a.role ?? undefined }))} searchable />
          <BrowsePicker square label="Ability" kind="ability" allLabel="Choose ability" value={l.abilitySlot} onChange={v => v && setSetup({ abilitySlot: v })} disabled={!agent} options={abilities.map(a => ({ id: a.slot, name: a.displayName, icon: a.displayIcon, sublabel: abilityKey(a.slot) }))} />
        </div>
        {showIssues && stepIssues('setup').map(i => <p key={i.field} className="ll-inline-error">{i.message}</p>)}
        {agent && l.abilitySlot && <section className="ll-mode-options" aria-label="Throw options">
          {availableModes.some(m => m.id === 'double') && <Toggle label={isShock ? 'Double shock' : 'Follow-up throw'} checked={hasSecondThrow} onChange={v => toggleMode('double', v)} />}
          {availableModes.some(m => m.id === 'placement') && <Toggle label="Placement only" checked={mode?.id === 'placement'} onChange={v => toggleMode('placement', v)} />}
          {mode && Object.entries(mode.attributes).filter(([k]) => !['chargeLevel','chargeStage','chargeBars','bounces','doubleShock','hasSecondStand'].includes(k)).map(([k, spec]) => isAttributeSpec(spec) ? (spec.type === 'boolean' ? <Toggle key={k} label={attrLabel(k)} checked={Boolean(l.attributes[k] ?? spec.default)} onChange={v => patch({ attributes: { ...l.attributes, [k]: v } })} /> : <Input key={k} label={attrLabel(k)} type="number" min={spec.min} max={spec.max} value={Number(l.attributes[k] ?? spec.default ?? 0)} onChange={e => patch({ attributes: { ...l.attributes, [k]: Number(e.target.value) } })} />) : null)}
        </section>}
      </div>}
      {step === 'capture' && <div className={clsx('ll-capture', annotate && 'll-capture--annotating')} data-testid="wizard-capture">
        {!annotate && <aside className="ll-slot-rail" aria-label="Capture slots">{visible.map(sl => { const req = required.includes(sl), has = !!l.slots[sl].image; return <button key={sl} className={clsx('ll-slot', active === sl && 'is-active', has && 'is-done', showIssues && req && !has && 'is-missing')} onClick={() => setActive(sl)} aria-current={active === sl ? 'true' : undefined} aria-label={`${SLOT_LABELS[sl]}${req ? ' required' : ' optional'}`} data-testid={`slot-${sl}`}>
          <span className="ll-slot__thumb">{has ? <AnnotatedImage src={l.slots[sl].image!} slot={l.slots[sl]} alt="" hideLens className="ll-slot__img" /> : <ImagePlus size={20} />}</span><span className="ll-slot__text"><strong>{SLOT_LABELS[sl]}</strong><Kbd>{key(`slot_${sl}`) || `Alt+${SLOT_ORDER.indexOf(sl) + 1}`}</Kbd></span>{has && <Check size={15} className="ll-slot__check" />}</button>; })}
        </aside>}
        <section className="ll-stage-card" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith('image/')) void setSlotImage(active, f); }}>
          <div className="ll-stage-card__head"><h2 className="ll-h2">{SLOT_LABELS[active]}</h2><div className="ll-stage-card__tools">
            <Button variant="primary" icon={<Camera size={16} />} loading={busy} onClick={() => capture(active)}>Capture <Kbd>{key('capture')}</Kbd></Button>
            <Tooltip label="Choose image"><IconButton label="Choose image" onClick={() => fileRef.current?.click()}><ImagePlus size={17} /></IconButton></Tooltip>
            <Tooltip label={`Retake (${key('retake')})`}><IconButton label="Retake" onClick={retake} disabled={!lastCaptured.current && !l.slots[active].image}><RefreshCw size={17} /></IconButton></Tooltip>
            {l.slots[active].image && <><Button variant={annotate ? 'primary' : 'secondary'} icon={annotate ? <Check size={16} /> : <Pencil size={16} />} onClick={() => setAnnotate(a => !a)}>{annotate ? 'Done' : 'Annotate'}</Button><Tooltip label="Clear image"><IconButton label="Clear image" onClick={() => { setImage(active, null); setAnnotate(false); }}><Eraser size={17} /></IconButton></Tooltip></>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void setSlotImage(active, f); e.target.value = ''; }} />
          </div></div>
          {!annotate && (active === 'aim1' || active === 'aim2') && <div className="ll-capture-options"><Select aria-label={`Throw type · ${SLOT_LABELS[active]}`} value={throwTypeFor(active)} onChange={e => setThrowType(active, e.target.value)}>{THROW_TYPES.map(t => <option key={t} value={t}>{t === 'jump-throw' ? 'Jump throw' : attrLabel(t)}</option>)}</Select>{isDart && <DartControls key={active} attributes={throwSpecFor(l, active)} onChange={a => updateThrow(active, { chargeLevel: Number(a.chargeLevel), chargeStage: Number(a.chargeStage), chargeBars: Number(a.chargeBars), bounces: Number(a.bounces) })} />}</div>}
          {showIssues && stepIssues('capture').map(i => <p key={i.field} className="ll-inline-error">{i.message}</p>)}
          <div className={clsx('ll-stage', !slotUrl && 'is-empty')}>
            {slotUrl ? (annotate ? <AnnotationEditor key={`${l.id}-${active}`} src={slotUrl} activeSlot={active} slot={l.slots[active]} onChange={sl => h.set(prev => ({ ...prev, slots: { ...prev.slots, [active]: sl } }))} onCopyTo={(target, circles, lines) => h.set(prev => ({ ...prev, slots: { ...prev.slots, [target]: { ...prev.slots[target], circles: [...prev.slots[target].circles, ...circles.map(c => ({ ...c, id: crypto.randomUUID() }))], lines: [...prev.slots[target].lines, ...lines.map(x => ({ ...x, id: crypto.randomUUID() }))] } } }))} /> : <AnnotatedImage src={slotUrl} slot={l.slots[active]} alt={SLOT_LABELS[active]} className="ll-stage__img" />)
              : <EmptyState icon={<Camera size={26} />} title="No capture yet" action={<div className="ll-btn-row"><Button variant="primary" icon={<Camera size={16} />} loading={busy} onClick={() => capture(active)}>Capture monitor</Button><Button onClick={() => fileRef.current?.click()}>Choose image</Button></div>} />}
          </div>
        </section>
      </div>}
      {step === 'pins' && <div className="ll-pins" data-testid="wizard-pins">
        <div className="ll-pins__palette" role="radiogroup" aria-label="Pin tool">{pinTools.map(t => <Button key={t.id} role="radio" aria-checked={pinTool === t.id} variant={pinTool === t.id ? 'primary' : 'secondary'} icon={t.id === 'landPos' ? <Crosshair size={17} /> : <Footprints size={17} />} onClick={() => setPinTool(t.id)}>{t.label}</Button>)}</div>
        <Minimap src={mapUrl} callouts={calloutsForMap(map)} lineups={[]} contextLineups={contextLineups} editablePins={{ stand1Pos: l.stand1Pos, stand2Pos: hasSecondThrow ? l.stand2Pos : null, landPos: l.landPos }} editableBounces={l.bounces} onPinChange={(k, p) => patch({ [k]: p } as Partial<Lineup>)} activePinTool={pinTool} onMapClick={onMapClick} className="ll-pins__map" emptyMessage={null} />
      </div>}
      {step === 'details' && <div className="ll-finish" data-testid="wizard-details">
        <section className="ll-finish__preview">
          {l.slots[previewSlot].image ? <AnnotatedImage src={l.slots[previewSlot].image!} slot={l.slots[previewSlot]} alt="Lineup preview" className="ll-finish__image" /> : <EmptyState title="No preview yet" />}
          <div className="ll-finish__title"><Input aria-label="Title" placeholder="Lineup title" value={l.title} onChange={e => patch({ title: e.target.value })} /><Tooltip label="Suggest from map callouts"><IconButton label="Suggest title" onClick={() => patch({ title: suggestedTitle })}><Sparkles size={18} /></IconButton></Tooltip></div>
          {showIssues && stepIssues('details').map(i => <p key={i.field} className="ll-inline-error">{i.message}</p>)}
        </section>
        <section className="ll-finish__form">
          <div className="ll-field"><span className="ll-label">Side</span><Segmented ariaLabel="Side" value={l.side} onChange={v => patch({ side: v })} options={[{ value: 'attack', label: 'Attack' }, { value: 'defense', label: 'Defense' }, { value: 'both', label: 'Both' }]} /></div>
          <div className="ll-field"><span className="ll-label">Site</span><div className="ll-site-chips">{sites.map(site => <Chip key={site} selected={l.site === site} onClick={() => patch({ site: l.site === site ? '' : site })}>{site}</Chip>)}</div></div>
          <div className="ll-field"><span className="ll-label">Difficulty</span><Segmented ariaLabel="Difficulty" value={l.difficulty} onChange={v => patch({ difficulty: v })} options={DIFFICULTIES.map(d => ({ value: d, label: attrLabel(d) }))} /></div>
          <Toggle label="Favorite" checked={l.isFavorite} onChange={v => patch({ isFavorite: v })} />
          <details className="ll-finish__steps"><summary>Steps <span>{l.steps.length || ''}</span></summary><div className="ll-finish__steps-body">
            <div className="ll-btn-row"><Button size="md" icon={<Plus size={14} />} onClick={() => patch({ steps: [...l.steps, { order: l.steps.length + 1, text: '', imageRef: null }] })}>Add step</Button><Button size="md" variant="ghost" onClick={() => patch({ steps: [{ order: 1, text: 'Stand on the marked spot', imageRef: l.slots.stand1.image }, { order: 2, text: 'Align the crosshair', imageRef: l.slots.aim1.image }, { order: 3, text: 'Throw and confirm landing', imageRef: l.slots.landing.image }] })}>From captures</Button></div>
            <ol className="ll-step-editor">{l.steps.map((st, i) => <li key={i}><span className="ll-steps__num">{i + 1}</span><div className="ll-step-editor__body"><TextArea aria-label={`Step ${i + 1} text`} rows={2} value={st.text} onChange={e => patch({ steps: l.steps.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} placeholder="What to do…" /><Select aria-label={`Step ${i + 1} image`} value={st.imageRef ?? ''} onChange={e => patch({ steps: l.steps.map((x, j) => j === i ? { ...x, imageRef: e.target.value || null } : x) })}><option value="">No image</option>{visible.filter(k => l.slots[k].image).map(k => <option key={k} value={l.slots[k].image!}>{SLOT_LABELS[k]}</option>)}</Select></div><div className="ll-step-editor__actions"><IconButton label="Move step up" disabled={i === 0} onClick={() => { const arr = [...l.steps]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; patch({ steps: arr.map((x, j) => ({ ...x, order: j + 1 })) }); }}><ArrowUp size={14} /></IconButton><IconButton label="Move step down" disabled={i === l.steps.length - 1} onClick={() => { const arr = [...l.steps]; [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; patch({ steps: arr.map((x, j) => ({ ...x, order: j + 1 })) }); }}><ArrowDown size={14} /></IconButton><IconButton label="Remove step" onClick={() => patch({ steps: l.steps.filter((_, j) => j !== i).map((x, j) => ({ ...x, order: j + 1 })) })}><Trash2 size={14} /></IconButton></div></li>)}</ol>
          </div></details>
        </section>
      </div>}
      </main>
      <aside className="ll-create-rail" aria-label="Create workspace">
        <div className="ll-create-rail__head"><h1>{lineupId ? 'Edit lineup' : 'New lineup'}</h1><IconButton label="Close editor" onClick={onCancel}><X size={17} /></IconButton></div>
        <nav className="ll-create-nav" aria-label="Create sections">{WIZARD_STEPS.map(item => <button key={item.id} type="button" className={clsx(step === item.id && 'is-active')} aria-current={step === item.id ? 'step' : undefined} onClick={() => goStep(item.id)}>{stageIcons[item.id]}<span>{item.label}</span>{stepIssues(item.id).length === 0 && (item.id !== 'setup' || !!l.mapUuid) && <Check size={13} className="ll-create-nav__done" />}</button>)}</nav>
        <div className="ll-create-rail__validation" aria-live="polite">{issues.length ? <details className="ll-create-checks"><summary>{issues.length} check{issues.length === 1 ? '' : 's'} remaining</summary><ul className="ll-issues">{issues.map(i => <li key={`${i.step}-${i.field}`}><button onClick={() => { setShowIssues(true); goStep(i.step); if (i.slot) setActive(i.slot); }}>{i.message}</button></li>)}</ul></details> : <p className="ll-ok"><Check size={15} /> Ready to save</p>}</div>
        <div className="ll-create-rail__save"><Button variant="primary" icon={<Save size={16} />} loading={busy} disabled={issues.length > 0} onClick={() => save(false)}>Save lineup</Button><Button variant="ghost" disabled={issues.length > 0} onClick={() => save(true)}>Save & create another</Button></div>
        <div className="ll-create-rail__foot"><span className="ll-autosave" role="status">{draftState === 'saving' ? 'Saving…' : draftState === 'saved' ? 'Draft saved' : 'Autosave on'}</span><div><IconButton label="Undo" tooltip={`Undo (${key('undo')})`} onClick={h.undo} disabled={!h.canUndo}><Undo2 size={15} /></IconButton><IconButton label="Redo" tooltip={`Redo (${key('redo')})`} onClick={h.redo} disabled={!h.canRedo}><Redo2 size={15} /></IconButton><IconButton label="Discard" onClick={() => setConfirmDiscard(true)}><Trash2 size={15} /></IconButton></div></div>
      </aside>
    </div>
    <Modal open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title="Discard this draft?" footer={<><Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button><Button variant="danger" icon={<Trash2 size={16} />} onClick={discard}>Discard draft</Button></>}><p>This removes the locally autosaved draft{lineupId ? ' and restores the last saved version of the lineup' : ''}. Captured images already stored in the library are not deleted.</p></Modal>
  </div>;
}
