import { describe, it, expect } from "vitest";
import { filterLineups, hasLineupsForAgent, buildPathPoints, coordToPixel, pixelToNorm } from "../src/lib/filtering";
import type { Lineup } from "../src/types/lineup";

const mockLineups: Lineup[] = [
  {
    id: "1",
    title: "A smoke",
    mapUuid: "map1",
    agentUuid: "agent1",
    abilitySlot: "Ability1",
    side: "attack",
    site: "A",
    start: { x: 0.2, y: 0.2 },
    end: { x: 0.7, y: 0.7 },
    bounces: [],
    difficulty: "easy",
    importance: "essential",
    tags: [],
    media: {},
  },
  {
    id: "2",
    title: "B flash",
    mapUuid: "map1",
    agentUuid: "agent2",
    abilitySlot: "Grenade",
    side: "defense",
    site: "B",
    start: { x: 0.1, y: 0.1 },
    end: { x: 0.6, y: 0.6 },
    bounces: [{ x: 0.3, y: 0.3 }],
    difficulty: "hard",
    importance: "optional",
    tags: [],
    media: {},
  },
  {
    id: "3",
    title: "Both side",
    mapUuid: "map2",
    agentUuid: "agent1",
    abilitySlot: "Ultimate",
    side: "both",
    site: "A",
    start: { x: 0.5, y: 0.5 },
    end: { x: 0.8, y: 0.8 },
    bounces: [],
    difficulty: "normal",
    importance: "useful",
    tags: [],
    media: {},
  },
];

describe("filterLineups", () => {
  it("filters by map", () => {
    const res = filterLineups(mockLineups, {
      mapUuid: "map1",
      side: "attack",
      agentUuid: null,
      abilitySlots: new Set(["Ability1", "Grenade", "Ultimate", "Ability2"]),
      importance: new Set(["essential", "useful", "optional"]),
      difficulty: new Set(["easy", "normal", "hard"]),
    });
    expect(res.map((l) => l.id)).toEqual(["1"]); // only map1+attack, both doesn't match map2
  });

  it("filters by side including both", () => {
    const res = filterLineups(mockLineups, {
      mapUuid: "map2",
      side: "attack",
      agentUuid: null,
      abilitySlots: new Set(["Ultimate", "Ability1"]),
      importance: new Set(["essential", "useful", "optional"]),
      difficulty: new Set(["easy", "normal", "hard"]),
    });
    // map2, side attack, both side lineup should match
    expect(res.find((l) => l.id === "3")).toBeTruthy();
  });

  it("filters by agent", () => {
    const res = filterLineups(mockLineups, {
      mapUuid: null,
      side: "attack",
      agentUuid: "agent1",
      abilitySlots: new Set(["Ability1", "Ultimate"]),
      importance: new Set(["essential", "useful", "optional"]),
      difficulty: new Set(["easy", "normal", "hard"]),
    });
    expect(res.length).toBe(2);
    expect(res.every((l) => l.agentUuid === "agent1")).toBe(true);
  });

  it("filters by abilitySlot", () => {
    const res = filterLineups(mockLineups, {
      mapUuid: null,
      side: "attack",
      agentUuid: null,
      abilitySlots: new Set(["Ability1"]),
      importance: new Set(["essential", "useful", "optional"]),
      difficulty: new Set(["easy", "normal", "hard"]),
    });
    expect(res.map((l) => l.id)).toEqual(["1"]);
  });

  it("filters by importance", () => {
    const res = filterLineups(mockLineups, {
      mapUuid: null,
      side: "attack",
      agentUuid: null,
      abilitySlots: new Set(["Ability1", "Ultimate"]),
      importance: new Set(["essential"]),
      difficulty: new Set(["easy", "normal", "hard"]),
    });
    expect(res.map((l) => l.id)).toEqual(["1"]);
  });

  it("filters by difficulty with medium alias", () => {
    const withMedium: Lineup = {
      ...mockLineups[0],
      id: "4",
      difficulty: "medium" as any,
    };
    const res = filterLineups([...mockLineups, withMedium], {
      mapUuid: null,
      side: "attack",
      agentUuid: null,
      abilitySlots: new Set(["Ability1"]),
      importance: new Set(["essential", "useful", "optional"]),
      difficulty: new Set(["normal"]),
    });
    expect(res.find((l) => l.id === "4")).toBeTruthy();
  });

  it("empty importance/difficulty = no results", () => {
    const res = filterLineups(mockLineups, {
      mapUuid: null,
      side: "attack",
      agentUuid: null,
      abilitySlots: new Set(["Ability1"]),
      importance: new Set([]),
      difficulty: new Set(["easy"]),
    });
    expect(res.length).toBe(0);
  });
});

describe("hasLineupsForAgent", () => {
  it("returns true if agent has lineups for map+side", () => {
    expect(hasLineupsForAgent(mockLineups, "agent1", "map1", "attack")).toBe(true);
    expect(hasLineupsForAgent(mockLineups, "agent2", "map1", "attack")).toBe(false); // defense only
    expect(hasLineupsForAgent(mockLineups, "agent2", "map1", "defense")).toBe(true);
  });
  it("handles both side", () => {
    expect(hasLineupsForAgent(mockLineups, "agent1", "map2", "attack")).toBe(true);
    expect(hasLineupsForAgent(mockLineups, "agent1", "map2", "defense")).toBe(true);
  });
});

describe("coordToPixel / pixelToNorm", () => {
  it("maps normalized to pixel and back", () => {
    const rect = { width: 1000, height: 1000 };
    const pan = { x: 0, y: 0 };
    const zoom = 1;
    const pt = { x: 0.5, y: 0.5 };
    const pix = coordToPixel(pt, rect, pan, zoom);
    expect(pix).toEqual({ x: 500, y: 500 });
    const back = pixelToNorm(pix, rect, pan, zoom);
    expect(back.x).toBeCloseTo(0.5);
    expect(back.y).toBeCloseTo(0.5);
  });
  it("handles zoom and pan", () => {
    const rect = { width: 600, height: 600 };
    const pan = { x: 100, y: -50 };
    const zoom = 1.5;
    const norm = { x: 0.2, y: 0.8 };
    const pix = coordToPixel(norm, rect, pan, zoom);
    expect(pix.x).toBeCloseTo(0.2 * 600 * 1.5 + 100);
    const back = pixelToNorm(pix, rect, pan, zoom);
    expect(back.x).toBeCloseTo(norm.x);
    expect(back.y).toBeCloseTo(norm.y);
  });
});

describe("buildPathPoints", () => {
  it("returns start->bounces->end", () => {
    const pts = buildPathPoints(mockLineups[1]);
    expect(pts.length).toBe(3); // start + 1 bounce + end
    expect(pts[0]).toEqual(mockLineups[1].start);
    expect(pts[1]).toEqual({ x: 0.3, y: 0.3 });
  });
  it("without bounces returns start->end", () => {
    const pts = buildPathPoints(mockLineups[0]);
    expect(pts.length).toBe(2);
  });
});
