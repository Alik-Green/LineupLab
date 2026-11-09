import { useState } from "react";
import { parsePackZip, buildPreview, storeMediaBatch, type ImportPreviewItem } from "../lib/packImporter";
import { getDB } from "../lib/db";
import { getImportHistory, addImportHistory } from "../lib/indexedDBRepository";
import type { ConflictResolution } from "../lib/indexedDBRepository";

export default function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<any>(null);
  const [preview, setPreview] = useState<ImportPreviewItem[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [mediaEntries, setMediaEntries] = useState<{ name: string; data: Uint8Array }[]>([]);
  const [conflictMode, setConflictMode] = useState<ConflictResolution>("skip");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; overwritten: number; copied: number; warnings: string[] } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    setParsing(true);
    setParseError(null);
    setResult(null);
    try {
      const parsed = await parsePackZip(f);
      setManifest(parsed.manifest);
      let extraWarnings = [...parsed.warnings];
      const mediaNames = new Set(parsed.mediaEntries.map(e => e.name.split("/").pop()!.toLowerCase()));
      const mediaFull = new Set(parsed.mediaEntries.map(e => e.name.toLowerCase()));
      for (const raw of parsed.lineupsRaw) {
        const refs: string[] = [];
        const collect = (obj: any) => {
          if (!obj) return;
          if (typeof obj === "string" && (obj.includes("media/") || obj.endsWith(".jpg") || obj.endsWith(".png") || obj.endsWith(".mp4"))) refs.push(obj);
          if (typeof obj === "object") {
            for (const v of Object.values(obj)) {
              if (typeof v === "string" && v.startsWith("media/")) refs.push(v);
              else if (Array.isArray(v)) v.forEach(collect);
              else if (typeof v === "object" && v) collect(v);
            }
          }
        };
        collect(raw);
        const extraRefs = [raw.media?.standImage, raw.media?.aimImage, raw.media?.landingImage, raw.media?.videoClip, raw.slots?.stand1, raw.slots?.aim1, raw.slots?.stand2, raw.slots?.aim2, raw.slots?.landing, ...(raw.steps ?? []).map((s: any) => s.imageRef ?? s.image), ...(raw.attributes?.projectiles ?? []).map((p: any) => p.standImage ?? p.aimImage)].filter(Boolean);
        extraRefs.forEach((r: string) => refs.push(r));
        for (const ref of refs) {
          const short = ref.split("/").pop()!.toLowerCase();
          if (!mediaNames.has(short) && !mediaFull.has(ref.toLowerCase())) {
            if (!extraWarnings.some(w => w.includes(ref))) {
              extraWarnings.push(`Missing media for ${raw.id ?? "lineup"}: ${ref} not in pack — will show placeholder`);
            }
          }
        }
      }
      setWarnings(extraWarnings);
      setMediaEntries(parsed.mediaEntries);
      const batchId = `batch-${Date.now().toString(36)}`;
      const prev = await buildPreview(parsed.lineupsRaw, batchId);
      const history = await getImportHistory();
      const dup = history.find(h => h.packName === parsed.manifest.name);
      if (dup) setDuplicateWarning(`Pack "${parsed.manifest.name}" was already imported on ${dup.importedAt}.`);
      else setDuplicateWarning(null);
      setPreview(prev);
      const sel = new Set<string>();
      prev.forEach(p => {
        if (p.status === "identical") return;
        if (p.isSeedPlaceholder) return;
        if (p.mapped) sel.add(p.mapped.id);
      });
      setSelectedIds(sel);
      (window as any).__importBatchId = batchId;
      (window as any).__importManifest = parsed.manifest;
    } catch (e: any) {
      setParseError(String(e.message ?? e));
    } finally {
      setParsing(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const doImport = async () => {
    if (!preview) return;
    const batchId: string = (window as any).__importBatchId ?? `batch-${Date.now().toString(36)}`;
    const db = await getDB();
    let imported = 0, skipped = 0, overwritten = 0, copied = 0;
    const allWarnings: string[] = [...warnings];
    const toImport = preview.filter(p => p.mapped && selectedIds.has(p.mapped.id));
    setProgress({ done: 0, total: toImport.length || 1 });
    const mediaMap = new Map<string, string>();
    for (const entry of mediaEntries) {
      const short = entry.name.split("/").pop()!;
      const owner = toImport.find(p => {
        const m = p.mapped!;
        const refs = [m.slots?.stand1, m.slots?.aim1, m.slots?.stand2, m.slots?.aim2, m.slots?.landing, m.media.standImage, m.media.aimImage, m.media.landingImage, ...(m.steps ?? []).map(s=>s.image)];
        return refs.some(r => r && (r as string).toLowerCase().includes(short.toLowerCase()));
      });
      mediaMap.set(entry.name, owner?.mapped?.id ?? toImport[0]?.mapped?.id ?? batchId);
      mediaMap.set(short, owner?.mapped?.id ?? toImport[0]?.mapped?.id ?? batchId);
      mediaMap.set(short.toLowerCase(), owner?.mapped?.id ?? toImport[0]?.mapped?.id ?? batchId);
    }
    // Use individual puts to avoid long-transaction inactivity timeout (stuck at 1/48)
    const insertedIds: string[] = [];
    for (let i = 0; i < toImport.length; i++) {
      const p = toImport[i];
      const lineup = p.mapped!;
      const existing = p.existing;
      try {
        if (existing) {
          if (conflictMode === "skip" && p.status !== "new") { skipped++; } 
          else if (conflictMode === "copy") {
            const copyId = `${lineup.id}-copy-${Date.now().toString(36)}-${i}`;
            const copy = { ...lineup, id: copyId };
            await db.put("lineups", copy as any);
            insertedIds.push(copyId);
            copied++;
          } else if (conflictMode === "overwrite") {
            await db.put("lineups", lineup as any);
            insertedIds.push(lineup.id);
            overwritten++;
          } else {
            skipped++;
          }
        } else {
          await db.put("lineups", lineup as any);
          insertedIds.push(lineup.id);
          imported++;
        }
      } catch (err: any) {
        allWarnings.push(`Failed to save ${lineup.id}: ${String(err?.message ?? err)}`);
        skipped++;
      }
      setProgress({ done: i + 1, total: toImport.length });
      // yield to keep UI responsive, without breaking IDB tx
      await new Promise(r => setTimeout(r, 0));
    }
    if (mediaEntries.length > 0) {
      const mediaResult = await storeMediaBatch(mediaEntries, mediaMap);
      if (mediaResult.warnings.length) allWarnings.push(...mediaResult.warnings);
      if (mediaResult.deduped > 0) allWarnings.push(`${mediaResult.deduped} media files were duplicates (SHA match) and were deduped.`);
    }
    await addImportHistory({ batchId, packName: manifest?.name ?? "Unnamed Pack", importedAt: new Date().toISOString(), counts: { total: preview.length, imported: imported + overwritten + copied, skipped, overwritten }, undoAvailable: true });
    (window as any).__lastImport = { batchId, insertedIds };
    setResult({ imported, skipped, overwritten, copied, warnings: allWarnings });
    setProgress(null);
    onImported();
  };

  const doUndo = async () => {
    const last: { batchId: string; insertedIds: string[] } | undefined = (window as any).__lastImport;
    if (!last) return;
    const db = await getDB();
    const tx = db.transaction("lineups", "readwrite");
    for (const id of last.insertedIds) await tx.store.delete(id);
    await tx.done;
    setResult(null);
    setPreview(null);
    setFile(null);
    onImported();
  };

  const counts = preview ? { total: preview.length, new: preview.filter(p => p.status === "new").length, identical: preview.filter(p => p.status === "identical").length, packNewer: preview.filter(p => p.status === "pack_newer").length, localNewer: preview.filter(p => p.status === "local_newer").length, error: preview.filter(p => p.status === "error").length } : null;
  const chipColor = (s: string) => {
    if (s === "new") return "bg-essential/20 border-essential text-essential";
    if (s === "identical") return "bg-tile border-borderSubtle text-muted";
    if (s === "pack_newer") return "bg-accent/20 border-accent text-accent";
    if (s === "local_newer") return "bg-[#EAB308]/20 border-[#EAB308] text-[#EAB308]";
    return "bg-accent/20 border-accent text-accent";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-panel border border-borderSubtle rounded-card w-full max-w-3xl max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-borderSubtle flex items-center justify-between shrink-0">
          <h3 className="text-textPrimary font-bold text-lg">Import Pack</h3>
          <button onClick={onClose} className="w-10 h-10 rounded bg-tile hover:bg-tileHover text-muted min-h-[40px] min-w-[40px]">✕</button>
        </div>
        <div className="p-4 space-y-4 overflow-auto overscroll-contain min-h-0 flex-1 thin-scrollbar">
          {!preview && !parsing && !parseError && (
            <div>
              <p className="text-sm text-muted mb-2">Select a .zip pack containing <code className="bg-tile px-1 rounded">manifest.json</code> + <code className="bg-tile px-1 rounded">lineups/*.json</code> + <code className="bg-tile px-1 rounded">media/asset_*.jpg|.mp4</code></p>
              <label className="block w-full rounded-md border-2 border-dashed border-borderSubtle bg-tile p-6 text-center cursor-pointer hover:bg-tileHover">
                <input type="file" accept=".zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <span className="text-accent font-semibold">Choose .zip file</span>
                <p className="text-xs text-muted mt-1">or drag and drop here (up to 500MB)</p>
              </label>
              {file && <p className="text-xs text-muted mt-2">Selected: {file.name}</p>}
            </div>
          )}
          {parsing && <div className="p-4 text-center text-muted">Parsing pack…</div>}
          {parseError && (
            <div className="p-3 rounded bg-accent/20 border border-accent text-accent text-sm">
              {parseError}
              <button onClick={() => { setParseError(null); setFile(null); }} className="ml-3 underline">Try again</button>
            </div>
          )}
          {manifest && preview && !result && (
            <>
              <div className="rounded-md bg-tile border border-borderSubtle p-3">
                <h4 className="font-bold text-textPrimary">{manifest.name}</h4>
                {manifest.author && <p className="text-sm text-muted">by {manifest.author}</p>}
                {manifest.description && <p className="text-sm text-muted mt-1">{manifest.description}</p>}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="px-2 py-1 bg-panel border border-borderSubtle rounded text-xs text-textPrimary">Total: {counts?.total}</span>
                  <span className="px-2 py-1 bg-essential/20 border border-essential rounded text-xs text-essential">New: {counts?.new}</span>
                  <span className="px-2 py-1 bg-tile border border-borderSubtle rounded text-xs text-muted">Identical: {counts?.identical}</span>
                  <span className="px-2 py-1 bg-accent/20 border border-accent rounded text-xs text-accent">Pack newer: {counts?.packNewer}</span>
                  <span className="px-2 py-1 bg-[#EAB308]/20 border border-[#EAB308] rounded text-xs text-[#EAB308]">Local newer: {counts?.localNewer}</span>
                  {counts?.error ? <span className="px-2 py-1 bg-accent/20 border border-accent rounded text-xs text-accent">Errors: {counts.error}</span> : null}
                </div>
              </div>
              {duplicateWarning && <div className="p-2 rounded bg-[#EAB308]/20 border border-[#EAB308] text-[#EAB308] text-xs">{duplicateWarning}</div>}
              {warnings.length > 0 && <div className="p-2 rounded bg-accent/10 border border-accent text-accent text-xs max-h-[100px] overflow-auto thin-scrollbar">{warnings.map((w,i)=><div key={i}>⚠ {w}</div>)}</div>}
              {preview.some(p=>p.isSeedPlaceholder) && <div className="p-2 rounded bg-tile border border-borderSubtle text-xs text-muted">Seed placeholders (incomplete seeds) are unchecked by default — review before importing.</div>}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted">Conflict:</span>
                <button onClick={()=>setConflictMode("skip")} className={`px-3 py-1 rounded-md border min-h-[40px] ${conflictMode==="skip"?"bg-accent text-white border-accent":"bg-tile text-muted border-borderSubtle"}`}>Skip</button>
                <button onClick={()=>setConflictMode("overwrite")} className={`px-3 py-1 rounded-md border min-h-[40px] ${conflictMode==="overwrite"?"bg-accent text-white border-accent":"bg-tile text-muted border-borderSubtle"}`}>Overwrite</button>
                <button onClick={()=>setConflictMode("copy")} className={`px-3 py-1 rounded-md border min-h-[40px] ${conflictMode==="copy"?"bg-accent text-white border-accent":"bg-tile text-muted border-borderSubtle"}`}>Copy</button>
              </div>
              <div className="rounded-md border border-borderSubtle overflow-auto thin-scrollbar" style={{ maxHeight: "40vh" }}>
                <table className="w-full text-xs">
                  <thead className="bg-tile text-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left"><input type="checkbox" checked={selectedIds.size === preview.filter(p=>p.mapped).length && preview.filter(p=>p.mapped).length>0} onChange={(e)=>{ if(e.target.checked){ const s=new Set<string>(); preview.forEach(p=> p.mapped && s.add(p.mapped.id)); setSelectedIds(s);} else setSelectedIds(new Set());}} /></th>
                      <th className="p-2 text-left">Title</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p, idx)=> (
                      <tr key={idx} className={`border-t border-borderSubtle ${p.isSeedPlaceholder?"bg-tile/50":""}`}>
                        <td className="p-2">
                          {p.mapped ? <input type="checkbox" checked={selectedIds.has(p.mapped.id)} onChange={()=>toggleSelect(p.mapped!.id)} /> : <span className="text-muted">—</span>}
                          {p.isSeedPlaceholder && <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-500 px-1 rounded">placeholder</span>}
                        </td>
                        <td className="p-2 text-textPrimary">{p.mapped?.title ?? p.raw?.id ?? "—"}</td>
                        <td className="p-2"><span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${chipColor(p.status)}`}>{p.status === "new" ? "New" : p.status === "identical" ? "Identical" : p.status === "pack_newer" ? "Pack newer" : p.status === "local_newer" ? "Local newer" : "Error"}</span></td>
                        <td className="p-2 text-muted">{p.warnings.join("; ") || (p.status==="error"?"Failed to map":"")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {result && (
            <div className="space-y-3">
              <h4 className="font-bold text-textPrimary">Import complete</h4>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-tile rounded p-2 border border-borderSubtle text-center"><div className="text-lg font-bold text-essential">{result.imported}</div><div className="text-muted">Imported</div></div>
                <div className="bg-tile rounded p-2 border border-borderSubtle text-center"><div className="text-lg font-bold text-accent">{result.overwritten}</div><div className="text-muted">Overwritten</div></div>
                <div className="bg-tile rounded p-2 border border-borderSubtle text-center"><div className="text-lg font-bold text-[#EAB308]">{result.copied}</div><div className="text-muted">Copied</div></div>
                <div className="bg-tile rounded p-2 border border-borderSubtle text-center"><div className="text-lg font-bold text-muted">{result.skipped}</div><div className="text-muted">Skipped</div></div>
              </div>
              {result.warnings.length>0 && <div className="p-2 rounded bg-tile border border-borderSubtle text-xs text-muted max-h-[120px] overflow-auto thin-scrollbar">{result.warnings.map((w,i)=><div key={i}>{w}</div>)}</div>}
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-borderSubtle p-3 bg-panel flex flex-col gap-2">
          {progress && (
            <div className="w-full">
              <div className="flex justify-between text-xs text-muted mb-1"><span>Importing… {progress.done}/{progress.total}</span><span>{Math.round((progress.done/progress.total)*100)}%</span></div>
              <div className="w-full bg-tile rounded-full h-2.5 overflow-hidden"><div className="bg-accent h-2.5 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%`}} /></div>
            </div>
          )}
          {manifest && preview && !result && (
            <div className="flex gap-2 justify-end">
              <button onClick={()=>{ setPreview(null); setFile(null); setWarnings([]); }} className="px-4 py-2 rounded bg-tile text-textPrimary border border-borderSubtle min-h-[40px]">Back</button>
              <button onClick={doImport} disabled={selectedIds.size===0 || !!progress} className="px-5 py-2 rounded bg-accent text-white font-bold disabled:opacity-40 min-h-[40px]">Import {selectedIds.size} lineups</button>
            </div>
          )}
          {result && (
            <div className="flex gap-2">
              <button onClick={doUndo} className="px-4 py-2 rounded bg-tile text-textPrimary border border-borderSubtle min-h-[40px]">Undo</button>
              <button onClick={onClose} className="ml-auto px-5 py-2 rounded bg-accent text-white font-bold min-h-[40px]">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
