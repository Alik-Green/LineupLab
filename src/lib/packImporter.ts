import { z } from "zod";
import { unzipSync, strFromU8 } from "fflate";
import type { Lineup, PackManifest, LineupCircle } from "../types/lineup";
import { getDB, sha256Bytes } from "./db";
import { createThumbnail } from "./indexedDBRepository";

// Tolerant Zod schemas
const ManifestSchema = z.object({
  formatVersion: z.number().optional(),
  version: z.number().optional(),
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  packName: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  desc: z.string().optional(),
  createdAt: z.string().optional(),
  gameVersion: z.string().optional(),
}).passthrough();

const CircleSchema = z.object({
  id: z.string().optional(),
  x: z.number(),
  y: z.number(),
  r: z.number().optional(),
  radius: z.number().optional(),
  color: z.string().optional(),
  label: z.string().optional(),
}).passthrough();

const StepSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  note: z.string().optional(),
  text: z.string().optional(),
  image: z.string().optional(),
  imageRef: z.string().optional(),
  media: z.string().optional(),
  asset: z.string().optional(),
  circles: z.array(CircleSchema).optional(),
  focusCircles: z.array(CircleSchema).optional(),
}).passthrough();

const PackLineupSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  name: z.string().optional(),
  map: z.string().optional(),
  mapUuid: z.string().optional(),
  mapName: z.string().optional(),
  mapId: z.string().optional(),
  agent: z.string().optional(),
  agentUuid: z.string().optional(),
  agentName: z.string().optional(),
  ability: z.string().optional(),
  abilitySlot: z.string().optional(),
  slot: z.string().optional(),
  side: z.string().optional(),
  site: z.string().optional(),
  start: z.any().optional(),
  end: z.any().optional(),
  bounces: z.any().optional(),
  throwType: z.string().optional(),
  difficulty: z.string().optional(),
  importance: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  description: z.string().optional(),
  media: z.any().optional(),
  slots: z.any().optional(),
  throws: z.any().optional(),
  steps: z.array(StepSchema).optional(),
  attributes: z.any().optional(),
  circles: z.array(CircleSchema).optional(),
  projectiles: z.any().optional(),
  status: z.string().optional(),
  isSeedPlaceholder: z.boolean().optional(),
}).passthrough();

export type ParsedPack = {
  manifest: PackManifest & { raw: any };
  lineupsRaw: any[];
  mediaEntries: { name: string; data: Uint8Array }[];
  warnings: string[];
};

const MAX_UNZIP_BYTES = 500 * 1024 * 1024;
const MAX_FILES = 5000;
const MAX_JSON_SIZE = 5 * 1024 * 1024;

function isSafePath(name: string): boolean {
  if (name.includes("..") || name.startsWith("/") || name.startsWith("\\")) return false;
  return true;
}

export async function parsePackZip(file: File | Blob): Promise<ParsedPack> {
  const buf = new Uint8Array(await (file as any).arrayBuffer());
  if (buf.length > MAX_UNZIP_BYTES) throw new Error(`Pack too large: ${buf.length} bytes exceeds ${MAX_UNZIP_BYTES}`);
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(buf);
  } catch (e: any) {
    throw new Error(`Failed to unzip pack: ${String(e.message ?? e)}`);
  }
  const names = Object.keys(unzipped);
  if (names.length === 0) throw new Error("Empty pack");
  if (names.length > MAX_FILES) throw new Error(`Too many files: ${names.length} > ${MAX_FILES}`);
  for (const n of names) {
    if (!isSafePath(n)) throw new Error(`Unsafe path in pack: ${n}`);
    if (unzipped[n].length > MAX_JSON_SIZE && n.endsWith(".json")) {
      throw new Error(`JSON too large: ${n}`);
    }
  }
  let manifestKey = names.find((n) => n.toLowerCase() === "manifest.json" || n.endsWith("/manifest.json"));
  if (!manifestKey) {
    manifestKey = names.find((n) => n.toLowerCase().includes("manifest"));
    if (!manifestKey) throw new Error("Missing manifest.json in pack");
  }
  const manifestText = strFromU8(unzipped[manifestKey]);
  let manifestRaw: any;
  try { manifestRaw = JSON.parse(manifestText); } catch { throw new Error("Invalid manifest.json JSON"); }
  const manifestParsed = ManifestSchema.safeParse(manifestRaw);
  if (!manifestParsed.success) {
  }
  const manifest: PackManifest & { raw: any } = {
    raw: manifestRaw,
    name: manifestRaw.name ?? manifestRaw.title ?? manifestRaw.packName ?? "Unnamed Pack",
    author: manifestRaw.author,
    description: manifestRaw.description ?? manifestRaw.desc,
    createdAt: manifestRaw.createdAt,
    gameVersion: manifestRaw.gameVersion,
    formatVersion: manifestRaw.formatVersion ?? manifestRaw.version,
  };

  const lineupFiles = names.filter((n) => n.startsWith("lineups/") && n.endsWith(".json"));
  const mediaFiles = names.filter((n) => n.startsWith("media/") && (n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".mp4") || n.endsWith(".webm")));
  const mediaEntries = mediaFiles.map((n) => ({ name: n, data: unzipped[n] }));
  const lineupsRaw: any[] = [];
  const warnings: string[] = [];
  for (const lf of lineupFiles) {
    const text = strFromU8(unzipped[lf]);
    let json: any;
    try { json = JSON.parse(text); } catch (e: any) {
      warnings.push(`Invalid JSON in ${lf}: ${String(e)}`);
      continue;
    }
    if (Array.isArray(json)) {
      for (const item of json) lineupsRaw.push(item);
    } else {
      lineupsRaw.push(json);
    }
  }
  if (manifestRaw.lineups && Array.isArray(manifestRaw.lineups) && lineupFiles.length === 0) {
    for (const item of manifestRaw.lineups) lineupsRaw.push(item);
  }
  if (lineupsRaw.length === 0) warnings.push("No lineups found in pack (expected lineups/*.json)");
  return { manifest, lineupsRaw, mediaEntries, warnings };
}

function normalizeSide(v: any): "attack" | "defense" | "both" | undefined {
  if (!v) return undefined;
  const s = String(v).toLowerCase();
  if (s === "attack" || s === "attacking" || s === "attacker") return "attack";
  if (s === "defense" || s === "defence" || s === "defending" || s === "defender") return "defense";
  if (s === "both" || s === "all") return "both";
  return undefined;
}
function normalizeDifficulty(v: any): "easy"|"normal"|"hard"|undefined {
  if (!v) return undefined;
  const s = String(v).toLowerCase();
  if (s === "easy") return "easy";
  if (s === "normal" || s === "medium") return "normal";
  if (s === "hard") return "hard";
  return undefined;
}
function normalizeImportance(v: any): "essential"|"useful"|"optional"|undefined {
  if (!v) return undefined;
  const s = String(v).toLowerCase();
  if (["essential","must","critical"].includes(s)) return "essential";
  if (["useful","recommended","good"].includes(s)) return "useful";
  if (["optional","situational","niche"].includes(s)) return "optional";
  return undefined;
}
function normalizeAbilitySlot(v: any): string | undefined {
  if (!v) return undefined;
  const s = String(v).toLowerCase();
  if (s.includes("ability1") || s === "c" || s === "q") return "Ability1";
  if (s.includes("ability2") || s === "e") return "Ability2";
  if (s.includes("grenade") || s === "q" || s === "c") return "Grenade";
  if (s.includes("ultimate") || s === "x" || s === "ult") return "Ultimate";
  if (["Ability1","Ability2","Grenade","Ultimate"].includes(v)) return v;
  return v;
}

export function mapRawToLineup(raw: any, batchId: string, warnings: string[]): Lineup | null {
  const parsed = PackLineupSchema.safeParse(raw);
  if (!parsed.success) {
    warnings.push(`Skipping lineup without id: ${JSON.stringify(raw).slice(0,120)}`);
    return null;
  }
  const r = parsed.data as any;
  const id = String(r.id);
  const title = r.title ?? r.name ?? `Lineup ${id}`;
  let mapUuid = r.mapUuid ?? r.mapId ?? r.map;
  if (!mapUuid) {
    warnings.push(`Lineup ${id}: missing mapUuid`);
    mapUuid = "unknown-map";
  }
  let agentUuid = r.agentUuid ?? r.agent;
  if (!agentUuid) {
    warnings.push(`Lineup ${id}: missing agentUuid`);
    agentUuid = "unknown-agent";
  }
  let abilitySlot: any = r.abilitySlot ?? r.slot ?? r.ability;
  if (abilitySlot) abilitySlot = normalizeAbilitySlot(abilitySlot) as any;
  abilitySlot = abilitySlot ?? "Ability1";

  const attrs = r.attributes ?? {};
  let side: any = normalizeSide(r.side ?? attrs.side ?? r.attributes?.side) ?? "both";
  let site: string | undefined = r.site ?? attrs.site;
  let difficulty: any = normalizeDifficulty(r.difficulty ?? attrs.difficulty ?? r.attributes?.difficulty) ?? "normal";
  let importance: any = normalizeImportance(r.importance ?? attrs.importance ?? r.attributes?.importance) ?? "useful";

  const toPt = (v: any): {x:number,y:number}|null => {
    if (!v) return null;
    if (Array.isArray(v) && v.length===2) return { x: Number(v[0]), y: Number(v[1]) };
    if (typeof v === "object" && "x" in v && "y" in v) return { x: Number(v.x), y: Number(v.y) };
    return null;
  };
  const start = toPt(r.start ?? attrs.start) ?? { x: 0.5, y: 0.5 };
  const end = toPt(r.end ?? attrs.end) ?? { x: 0.5, y: 0.5 };
  let bounces: {x:number,y:number}[] = [];
  if (Array.isArray(r.bounces)) bounces = r.bounces.map(toPt).filter(Boolean) as any;
  else if (r.bounces) {
    const b = toPt(r.bounces);
    if (b) bounces = [b];
  }
  if (r.projectiles && Array.isArray(r.projectiles)) {
    const p0 = r.projectiles[0];
    if (p0) {
      if (!r.start && p0.start) { const pt=toPt(p0.start); if(pt) (start as any).x=pt.x,(start as any).y=pt.y; }
      if (!r.end && p0.end) { const pt=toPt(p0.end); if(pt) (end as any).x=pt.x,(end as any).y=pt.y; }
      if (p0.bounces) bounces = (p0.bounces as any[]).map(toPt).filter(Boolean) as any;
    }
  }

  let media: any = r.media ?? {};
  let slots: any = r.slots ?? {};
  if (media.stand1 || media.aim1 || media.stand2 || media.aim2 || media.landing) {
    slots = { stand1: media.stand1, aim1: media.aim1, stand2: media.stand2, aim2: media.aim2, landing: media.landing, ...slots };
  }

  let attrProjectiles: any[] = [];
  if (attrs.projectiles && Array.isArray(attrs.projectiles)) attrProjectiles = attrs.projectiles;
  if (r.attributes?.projectiles && Array.isArray(r.attributes.projectiles)) attrProjectiles = r.attributes.projectiles;
  if ((r as any).projectiles && Array.isArray((r as any).projectiles) && attrProjectiles.length===0) attrProjectiles = (r as any).projectiles;

  let throws: any[] = [];
  if (Array.isArray(r.throws)) throws = r.throws;
  else if (attrProjectiles.length > 0) {
    throws = attrProjectiles.map((p:any)=> ({ type: p.throwType ?? r.throwType ?? "stand", label: p.label, chargeBars: p.chargeBars, chargeStage: p.chargeStage, timing: p.timing, bounces: p.bounces }));
  } else if (r.throwType) throws = [{ type: r.throwType }];

  let steps: any[] = [];
  if (Array.isArray(r.steps)) steps = r.steps.map((s:any)=> ({
    id: s.id ?? `step-${s.order ?? Math.random().toString(36).slice(2)}`,
    title: s.title ?? s.label,
    description: s.description ?? s.note ?? s.text,
    image: s.image ?? s.imageRef ?? s.media ?? s.asset,
    circles: s.circles ?? s.focusCircles ?? [],
    order: s.order,
  }));

  let circles: LineupCircle[] = [];
  if (Array.isArray(r.circles)) {
    const byId = new Map<string, LineupCircle>();
    for (const c of r.circles) {
      const idc = c.id ?? `${c.x}-${c.y}`;
      const norm: LineupCircle = { id: String(idc), x: Number(c.x), y: Number(c.y), r: c.r ?? c.radius, color: c.color, label: c.label };
      if (!byId.has(norm.id)) byId.set(norm.id, norm);
    }
    circles = Array.from(byId.values());
  }
  const slotCirclesRaw = attrs.slotCircles ?? r.attributes?.slotCircles;
  let slotCirclesMap: Record<string, LineupCircle[]> = {};
  if (slotCirclesRaw && typeof slotCirclesRaw === "object") {
    for (const key of Object.keys(slotCirclesRaw)) {
      const arr = (slotCirclesRaw as any)[key];
      if (Array.isArray(arr)) {
        slotCirclesMap[key] = arr.map((c: any) => ({
          id: String(c.id ?? `${c.x}-${c.y}`),
          x: Number(c.x), y: Number(c.y),
          r: c.r ?? c.radius,
          color: c.color, label: c.label,
        } as LineupCircle));
      }
    }
  }
  const collectAllCircles = () => {
    const byId = new Map<string, LineupCircle>();
    circles.forEach(c=>byId.set(c.id, c));
    for (const st of steps) {
      if (st.circles) for (const c of st.circles as LineupCircle[]) {
        const idc = (c as any).id ?? `${c.x}-${c.y}`;
        if (!byId.has(String(idc))) byId.set(String(idc), { ...c, id: String(idc)} as LineupCircle);
      }
    }
    if (slotCirclesRaw && typeof slotCirclesRaw === "object") {
      for (const key of Object.keys(slotCirclesRaw)) {
        const arr = (slotCirclesRaw as any)[key];
        if (Array.isArray(arr)) for (const c of arr) {
          const idc = (c as any).id ?? `${c.x}-${c.y}`;
          if (!byId.has(String(idc))) byId.set(String(idc), { id: String(idc), x: Number(c.x), y: Number(c.y), r: (c as any).r ?? (c as any).radius, color: (c as any).color, label: (c as any).label } as LineupCircle);
        }
      }
    }
    for (const p of attrProjectiles) {
      if (p.focusCircles && Array.isArray(p.focusCircles)) for (const c of p.focusCircles) {
        const idc = (c as any).id ?? `${c.x}-${c.y}`;
        if (!byId.has(String(idc))) byId.set(String(idc), { id: String(idc), x: Number(c.x), y: Number(c.y), r: (c as any).r ?? (c as any).radius, color: (c as any).color, label: (c as any).label } as LineupCircle);
      }
    }
    return Array.from(byId.values());
  };
  if (steps.length || attrProjectiles.length || (attrs.slotCircles || r.attributes?.slotCircles)) {
    circles = collectAllCircles();
  }

  const tags: string[] = r.tags ?? attrs.tags ?? [];
  const notes: string | undefined = r.notes ?? r.description ?? r.attributes?.notes;

  const lineup: Lineup = {
    id: String(id),
    title: String(title),
    mapUuid: String(mapUuid),
    agentUuid: String(agentUuid),
    abilitySlot: abilitySlot as any,
    side: side as any,
    site: site ? String(site) : undefined,
    start,
    end,
    bounces,
    throwType: r.throwType ?? throws[0]?.type,
    difficulty: difficulty as any,
    importance: importance as any,
    tags,
    notes,
    media: {
      standImage: media.standImage ?? slots.stand1,
      aimImage: media.aimImage ?? slots.aim1,
      landingImage: media.landingImage ?? slots.landing ?? media.videoThumbnail,
    },
    slots: {
      stand1: slots.stand1 ?? media.stand1 ?? media.standImage,
      aim1: slots.aim1 ?? media.aim1 ?? media.aimImage,
      stand2: slots.stand2 ?? media.stand2,
      aim2: slots.aim2 ?? media.aim2,
      landing: slots.landing ?? media.landing ?? media.landingImage ?? media.videoThumbnail,
    },
    throws,
    steps,
    attributes: { side, site, difficulty, importance, tags, ...attrs },
    circles,
    slotCircles: Object.keys(slotCirclesMap).length ? slotCirclesMap : undefined,
    source: "import",
    importBatchId: batchId,
    legacy: { raw: r, warnings: [] },
    status: (r.status as any) ?? "ok",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSeedPlaceholder: !!r.isSeedPlaceholder,
  };

  const clamp01 = (v:number)=> Math.max(0, Math.min(1, v));
  lineup.start.x = clamp01(lineup.start.x); lineup.start.y = clamp01(lineup.start.y);
  lineup.end.x = clamp01(lineup.end.x); lineup.end.y = clamp01(lineup.end.y);
  lineup.bounces = lineup.bounces.map(b=> ({ x: clamp01(b.x), y: clamp01(b.y)}));
  return lineup;
}

export type ImportPreviewItem = {
  raw: any;
  mapped: Lineup | null;
  existing?: Lineup | null;
  status: "new" | "identical" | "pack_newer" | "local_newer" | "error";
  warnings: string[];
  isSeedPlaceholder?: boolean;
};

export async function buildPreview(lineupsRaw: any[], batchId: string): Promise<ImportPreviewItem[]> {
  const db = await getDB();
  const results: ImportPreviewItem[] = [];
  for (const raw of lineupsRaw) {
    const warnings: string[] = [];
    const mapped = mapRawToLineup(raw, batchId, warnings);
    if (!mapped) {
      results.push({ raw, mapped: null, status: "error", warnings });
      continue;
    }
    const existing = await db.get("lineups", mapped.id) as Lineup | undefined;
    let status: ImportPreviewItem["status"] = "new";
    if (!existing) status = "new";
    else {
      const a = JSON.stringify({ ...mapped, updatedAt: undefined, createdAt: undefined, importBatchId: undefined });
      const b = JSON.stringify({ ...existing, updatedAt: undefined, createdAt: undefined, importBatchId: undefined });
      if (a === b) status = "identical";
      else {
        const packTime = mapped.updatedAt ? new Date(mapped.updatedAt).getTime() : 0;
        const localTime = (existing as any).updatedAt ? new Date((existing as any).updatedAt).getTime() : 0;
        if (packTime > localTime) status = "pack_newer";
        else status = "local_newer";
      }
    }
    results.push({ raw, mapped, existing: existing as any, status, warnings, isSeedPlaceholder: !!mapped.isSeedPlaceholder });
  }
  return results;
}

export async function storeMediaBatch(
  mediaEntries: { name: string; data: Uint8Array }[],
  lineupIdMap: Map<string, string>
): Promise<{ stored: number; deduped: number; warnings: string[] }> {
  const db = await getDB();
  let stored = 0, deduped = 0;
  const warnings: string[] = [];
  for (const entry of mediaEntries) {
    const assetName = entry.name;
    const lineupId = lineupIdMap.get(assetName) ?? lineupIdMap.get(assetName.split("/").pop()!) ?? lineupIdMap.get(assetName.split("/").pop()!.toLowerCase()) ?? "unassigned";
    const mimeType = assetName.endsWith(".mp4") ? "video/mp4" : assetName.endsWith(".png") ? "image/png" : "image/jpeg";
    const blob = new Blob([entry.data as any], { type: mimeType });
    let sha: string;
    try { sha = await sha256Bytes(entry.data); } catch { sha = `${Date.now()}-${assetName}`; warnings.push(`SHA fail for ${assetName}`); }
    const existing = await db.getAllFromIndex("media", "by-sha", sha);
    if (existing.length > 0) { deduped++; continue; }
    let thumb: Blob | undefined;
    try { thumb = await createThumbnail(blob); } catch {}
    const id = `${sha}-${assetName}`;
    const rec = { id, lineupId, assetName, blob, sha256: sha, mimeType, createdAt: new Date().toISOString(), thumbnail: thumb } as any;
    await db.put("media", rec);
    stored++;
  }
  return { stored, deduped, warnings };
}
