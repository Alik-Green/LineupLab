import fs from "fs";
import { zipSync, strToU8 } from "fflate";

const manifest = {
  formatVersion: 1,
  name: "Sample Pack",
  author: "LineupLab",
  description: "Minimal 2-lineup sample for import tests (covers New + isSeedPlaceholder + media)",
  createdAt: new Date().toISOString(),
  gameVersion: "10.00.00",
};

// Use real UUIDs from fallback for plausibility if available
let sampleMaps, sampleAgents;
try {
  sampleMaps = JSON.parse(fs.readFileSync("src/data/fallbackMaps.json","utf-8"));
  sampleAgents = JSON.parse(fs.readFileSync("src/data/fallbackAgents.json","utf-8"));
} catch {
  sampleMaps = [{ uuid: "2bee0dc9-4ffe-519b-1cbd-7fbe763a6047", displayName: "Bind" }, { uuid: "2a09d3b4-4d60-7a96-7f9c-2d2f1a7e0e1a", displayName: "Haven"}];
  sampleAgents = [{ uuid: "6f2a04ca-43e0-be17-7f6d-68ff6d606ff5", displayName: "Jett" }, { uuid: "117ed9e3-49f3-6512-3ccf-0cada7e3823b", displayName: "Cypher"}];
}

const lineups = [
  {
    id: "sample-001",
    title: "Sample Sova dart for A",
    mapUuid: sampleMaps[0]?.uuid ?? "map1",
    agentUuid: sampleAgents[0]?.uuid ?? "agent1",
    abilitySlot: "Ability1",
    side: "attack",
    site: "A",
    start: { x: 0.31, y: 0.42 },
    end: { x: 0.62, y: 0.71 },
    bounces: [{ x: 0.45, y: 0.55 }],
    difficulty: "easy",
    importance: "essential",
    tags: ["sample"],
    notes: "Aim at tower corner, jump throw.",
    media: { stand1: "media/asset_001.jpg", aim1: "media/asset_002.jpg", landing: "media/asset_001.jpg" },
    slots: { stand1: "media/asset_001.jpg", aim1: "media/asset_002.jpg", landing: "media/asset_001.jpg" },
    circles: [{ id: "c1", x: 0.5, y: 0.5, r: 0.04, color: "#E04050", label: "aim" }],
    steps: [{ title: "Stand", description: "Stand on box", image: "media/asset_001.jpg", circles: [{ id: "c1", x: 0.5, y: 0.5, r: 0.04 }] }],
    attributes: { side: "attack", site: "A", difficulty: "easy", importance: "essential" },
  },
  {
    id: "sample-002",
    title: "Seed placeholder — incomplete",
    mapUuid: sampleMaps[1]?.uuid ?? "map2",
    agentUuid: sampleAgents[1]?.uuid ?? "agent2",
    abilitySlot: "Grenade",
    side: "defense",
    site: "B",
    start: { x: 0.5, y: 0.5 },
    end: { x: 0.25, y: 0.8 },
    bounces: [],
    difficulty: "normal",
    importance: "optional",
    tags: ["sample"],
    notes: "Seed entry — should be unchecked in preview.",
    isSeedPlaceholder: true,
    status: "incomplete",
  }
];

// Tiny valid JPG (1x1 white) and PNG placeholder for asset_002
const jpegB64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAQABADAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=";
const jpegBuf = Buffer.from(jpegB64, "base64");
const pngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const pngBuf = Buffer.from(pngB64, "base64");

const toZip = {
  "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
  "lineups/lineup-001.json": strToU8(JSON.stringify(lineups[0], null, 2)),
  "lineups/lineup-002.json": strToU8(JSON.stringify(lineups[1], null, 2)),
  "media/asset_001.jpg": jpegBuf,
  "media/asset_002.jpg": jpegBuf,
  // asset_003 as PNG variant to test dedup?
  // keep same content for dedup test: two entries same bytes but different names will be deduped by SHA? Actually different name same SHA will be considered duplicate and skipped second.
};

const zipped = zipSync(toZip, { level: 6 });
fs.writeFileSync("sample-pack.zip", zipped);
console.log("Wrote sample-pack.zip", zipped.length, "bytes with", Object.keys(toZip).length, "entries");
