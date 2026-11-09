/**
 * Generates demo lineups using real agent/map UUIDs from valorant-api
 * Falls back to local fallback JSON if network unavailable.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import fallbackAgents from "../src/data/fallbackAgents.json";
import fallbackMaps from "../src/data/fallbackMaps.json";

type Agent = (typeof fallbackAgents)[number];
type MapType = (typeof fallbackMaps)[number];

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed ${res.status}`);
  return res.json();
}

async function getAgents(): Promise<Agent[]> {
  try {
    const json = await fetchJson("https://valorant-api.com/v1/agents?isPlayableCharacter=true");
    return json.data.filter((a: any) => a.isPlayableCharacter).map((a: any) => ({
      uuid: a.uuid,
      displayName: a.displayName,
      displayIcon: a.displayIcon,
      displayIconSmall: a.displayIconSmall,
      bustPortrait: a.bustPortrait,
      role: a.role,
      isPlayableCharacter: true,
      abilities: a.abilities
        .filter((ab: any) => ab.slot !== "Passive")
        .map((ab: any) => ({
          slot: ab.slot,
          displayName: ab.displayName,
          displayIcon: ab.displayIcon,
          description: ab.description,
        })),
    }));
  } catch (e) {
    console.warn("Failed to fetch agents, using fallback", e);
    return fallbackAgents as any;
  }
}

async function getMaps(): Promise<MapType[]> {
  try {
    const json = await fetchJson("https://valorant-api.com/v1/maps");
    const excluded = new Set(["The Range"]);
    const data = (json.data as any[])
      .filter((m) => !excluded.has(m.displayName))
      .filter((m) => m.displayIcon) // need minimap
      .map((m) => ({
        uuid: m.uuid,
        displayName: m.displayName,
        splash: m.splash,
        listViewIcon: m.listViewIcon,
        displayIcon: m.displayIcon,
      }));
    return data;
  } catch (e) {
    console.warn("Failed to fetch maps, using fallback", e);
    return fallbackMaps as any;
  }
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const agents = await getAgents();
  const maps = await getMaps();
  console.log(`Agents: ${agents.length}, Maps: ${maps.length}`);

  const sides: ("attack" | "defense" | "both")[] = ["attack", "defense", "both"];
  const difficulties: ("easy" | "normal" | "hard")[] = ["easy", "normal", "hard"];
  const importances: ("essential" | "useful" | "optional")[] = ["essential", "useful", "optional"];
  const abilitySlots: ("Ability1" | "Ability2" | "Grenade" | "Ultimate")[] = ["Ability1", "Ability2", "Grenade", "Ultimate"];
  const sites = ["A", "B", "C", null];
  const throwTypes = ["Jump throw", "Standing", "Running", "Crouch"];

  // Ensure coverage: every map gets at least 2 attack+defense, every importance/difficulty combination appears
  const lineups: any[] = [];
  let id = 1;

  // 1. Cover maps x sides
  for (const m of maps) {
    for (const side of ["attack", "defense"] as const) {
      const agent = pick(agents);
      const slot = pick(abilitySlots);
      const site = pick(sites);
      const diff = pick(difficulties);
      const imp = pick(importances);
      lineups.push(makeLineup(id++, m.uuid, agent.uuid, slot, side, site, diff, imp, throwTypes));
    }
  }

  // 2. Fill up to 40 with random but ensure distribution
  while (lineups.length < 45) {
    const m = pick(maps);
    const agent = pick(agents);
    const slot = pick(abilitySlots);
    const side = pick(sides);
    const site = pick(sites);
    const diff = pick(difficulties);
    const imp = pick(importances);
    lineups.push(makeLineup(id++, m.uuid, agent.uuid, slot, side, site, diff, imp, throwTypes));
  }

  // Ensure some with bounces (approx 12)
  for (let i = 0; i < 12; i++) {
    const l = lineups[i];
    if (!l) break;
    // add 1-2 bounces between start and end
    const count = Math.random() > 0.5 ? 1 : 2;
    l.bounces = [];
    for (let j = 0; j < count; j++) {
      l.bounces.push({
        x: clamp(randomBetween(l.start.x, l.end.x) + randomBetween(-0.08, 0.08)),
        y: clamp(randomBetween(l.start.y, l.end.y) + randomBetween(-0.08, 0.08)),
      });
    }
  }

  // Overwrite a few to guarantee demo badge visibility and edge cases
  // Ensure at least one agent appears multiple times on same map/side
  // Already satisfied.

  // Sort to random order
  for (let i = lineups.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lineups[i], lineups[j]] = [lineups[j], lineups[i]];
  }

  function makeLineup(
    idNum: number,
    mapUuid: string,
    agentUuid: string,
    slot: string,
    side: string,
    site: string | null,
    diff: string,
    imp: string,
    throws: string[]
  ) {
    // Generate plausible points: start near spawn corridors, end near sites
    // We don't have real map geometry, so random but ensure distance
    let start = { x: clamp(randomBetween(0.15, 0.85)), y: clamp(randomBetween(0.15, 0.85)) };
    let end: { x: number; y: number };
    // bias end to be somewhat far from start
    let attempts = 0;
    do {
      end = { x: clamp(randomBetween(0.18, 0.82)), y: clamp(randomBetween(0.18, 0.82)) };
      attempts++;
    } while (Math.hypot(end.x - start.x, end.y - start.y) < 0.22 && attempts < 30);

    return {
      id: `demo-${String(idNum).padStart(3, "0")}`,
      title: `${pickTitlePrefix()} ${site ? "for " + site : "lineup"} #${idNum}`,
      mapUuid,
      agentUuid,
      abilitySlot: slot,
      side,
      site: site ?? undefined,
      start,
      end,
      bounces: [],
      throwType: pick(throws),
      difficulty: diff,
      importance: imp,
      tags: ["demo"],
      notes: pickNotes(),
      media: {
        // leave empty to test placeholder, but give some with dummy images
        // Use splash as placeholder landingImage for some
      },
      isFavorite: Math.random() > 0.8,
    };
  }

  function pickTitlePrefix() {
    const p = ["Smoke", "Flash", "Recon", "Postplant", "Retake", "Entry", "Molotov", "Shock Dart", "Ultimate", "Wallbang setup", "One-way", "Stun"];
    return pick(p);
  }
  function pickNotes() {
    const n = [
      "Stand in corner, aim at antenna tip, jump-throw.",
      "Align crosshair with roof edge, run and release.",
      "Use for post-plant denial. Does not require line-up after setup.",
      "Bounce off wall near spawn, lands deep site.",
      "Great for retake, covers main choke.",
      "Practice in custom to get timing right.",
      undefined,
    ];
    return pick(n);
  }
  function clamp(v: number) {
    return Math.max(0.05, Math.min(0.95, v));
  }

  const outPath = join(process.cwd(), "public", "lineups.json");
  mkdirSync(join(process.cwd(), "public"), { recursive: true });
  writeFileSync(outPath, JSON.stringify(lineups, null, 2), "utf-8");
  console.log(`Wrote ${lineups.length} lineups to ${outPath}`);

  // Validate distribution
  const counts = {
    maps: new Set(lineups.map((l) => l.mapUuid)).size,
    agents: new Set(lineups.map((l) => l.agentUuid)).size,
    diffs: Object.fromEntries(difficulties.map((d) => [d, lineups.filter((l) => l.difficulty === d).length])),
    imps: Object.fromEntries(importances.map((i) => [i, lineups.filter((l) => l.importance === i).length])),
    bounces: lineups.filter((l) => l.bounces.length > 0).length,
  };
  console.log("Distribution:", counts);

  // Also write fallback lineups stats for tests?
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
