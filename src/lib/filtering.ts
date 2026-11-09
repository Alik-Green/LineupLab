import type { Lineup, Side, AbilitySlot, Importance, Difficulty } from "../types/lineup";

export function normalizeDifficulty(d: string): Difficulty {
  if (d === "medium") return "normal";
  return d as Difficulty;
}

export function filterLineups(
  lineups: Lineup[],
  opts: {
    mapUuid: string | null;
    side: Side;
    agentUuid: string | null;
    abilitySlots: Set<AbilitySlot> | null; // null = no filter (all), empty = none? We'll treat empty as none match
    importance: Set<Importance>;
    difficulty: Set<Difficulty>;
  }
): Lineup[] {
  return lineups.filter((l) => {
    if (opts.mapUuid && l.mapUuid !== opts.mapUuid) return false;
    // side filter: "both" matches any side, otherwise strict side matches or lineup side both
    if (l.side !== "both" && l.side !== opts.side) return false;
    if (opts.agentUuid && l.agentUuid !== opts.agentUuid) return false;
    if (opts.abilitySlots && opts.abilitySlots.size > 0 && !opts.abilitySlots.has(l.abilitySlot as AbilitySlot)) return false;
    if (opts.abilitySlots && opts.abilitySlots.size === 0) return false;
    if (opts.importance.size > 0 && !opts.importance.has(l.importance as Importance)) return false;
    if (opts.importance.size === 0) return false;
    if (opts.difficulty.size > 0 && !opts.difficulty.has(normalizeDifficulty(l.difficulty) as Difficulty)) return false;
    if (opts.difficulty.size === 0) return false;
    return true;
  });
}

export function hasLineupsForAgent(
  lineups: Lineup[],
  agentUuid: string,
  mapUuid: string | null,
  side: Side
): boolean {
  return lineups.some((l) => {
    if (l.agentUuid !== agentUuid) return false;
    if (mapUuid && l.mapUuid !== mapUuid) return false;
    if (l.side !== "both" && l.side !== side) return false;
    return true;
  });
}

export function coordToPixel(
  norm: { x: number; y: number },
  rect: { width: number; height: number },
  pan: { x: number; y: number },
  zoom: number
): { x: number; y: number } {
  // norm 0..1 on minimap image top-left origin
  // image is centered at (pan.x + rect.width/2, pan.y + rect.height/2) before zoom?
  // Simplified: image occupies rect, origin at top-left of image.
  // We'll compute pixel inside minimap container that is width*zoom and height*zoom centered
  // Let image size = rect * zoom, offset = pan
  // Common impl: minimap centered, pan shifts center
  // We'll provide helper used in Minimap
  const x = norm.x * rect.width * zoom + pan.x;
  const y = norm.y * rect.height * zoom + pan.y;
  return { x, y };
}

export function pixelToNorm(
  pixel: { x: number; y: number },
  rect: { width: number; height: number },
  pan: { x: number; y: number },
  zoom: number
): { x: number; y: number } {
  return {
    x: (pixel.x - pan.x) / (rect.width * zoom),
    y: (pixel.y - pan.y) / (rect.height * zoom),
  };
}

export function buildPathPoints(
  lineup: Lineup,
): { x: number; y: number }[] {
  const pts = [lineup.start];
  if (lineup.bounces && lineup.bounces.length > 0) pts.push(...lineup.bounces);
  pts.push(lineup.end);
  return pts;
}
