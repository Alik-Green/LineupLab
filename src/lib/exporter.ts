import { zipSync, strToU8 } from "fflate";
import { getAllLineups, getMediaByLineup } from "./indexedDBRepository";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function blobToJpg(blob: Blob): Promise<{ data: Uint8Array; name: string }> {
  // try to convert png to jpg via canvas for smaller size, fallback to original
  if (blob.type === "image/png" || blob.type === "image/webp") {
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const jpgBlob: Blob | null = await new Promise(res => canvas.toBlob(b => res(b), "image/jpeg", 0.85));
        if (jpgBlob) {
          const arr = new Uint8Array(await jpgBlob.arrayBuffer());
          return { data: arr, name: ".jpg" };
        }
      }
      bitmap.close();
    } catch {}
  }
  const arr = new Uint8Array(await blob.arrayBuffer());
  const ext = blob.type.includes("png") ? ".png" : blob.type.includes("webm") ? ".webm" : blob.type.includes("mp4") ? ".mp4" : ".jpg";
  // normalize to jpg extension for new format (keep original if not image)
  return { data: arr, name: ext };
}

export async function exportLineups(lineups: any[], filename = `lineuplab-export-${new Date().toISOString().slice(0,10)}.zip`) {
  if (!lineups || lineups.length === 0) throw new Error("No lineups to export");

  const manifest = {
    formatVersion: 2,
    name: `LineupLab Export ${new Date().toLocaleDateString()}`,
    description: `Exported ${lineups.length} lineup(s) from LineupLab v0.3.0 - supports jpg + annotations v2`,
    createdAt: new Date().toISOString(),
    count: lineups.length,
    exporter: "LineupLab v0.3.0",
    type: "lineuplab-v2",
  };

  const files: Record<string, Uint8Array> = {};
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));

  for (const lineup of lineups) {
    // Prepare lineup JSON for v2: include all fields, media refs point to media/ folder with jpg
    const mediaRefs: string[] = [];
    const records = await getMediaByLineup(lineup.id);
    for (const rec of records) {
      const { data, name: ext } = await blobToJpg(rec.blob);
      // new naming: media/{lineupId}_{assetBase}.jpg
      const base = rec.assetName.split("/").pop()!.replace(/\.[^.]+$/, "");
      const outName = `media/${lineup.id}_${base}${ext}`;
      files[outName] = data;
      mediaRefs.push(outName);
      // update lineup media references if needed (keep original for compat but add v2 field)
    }

    // Build v2 lineup JSON - superset of v1 with extra annotations support
    const v2 = {
      id: lineup.id,
      title: lineup.title,
      mapUuid: lineup.mapUuid,
      agentUuid: lineup.agentUuid,
      abilitySlot: lineup.abilitySlot,
      side: lineup.side,
      site: lineup.site,
      start: lineup.start,
      end: lineup.end,
      bounces: lineup.bounces,
      throwType: lineup.throwType,
      difficulty: lineup.difficulty,
      importance: lineup.importance,
      tags: lineup.tags,
      notes: lineup.notes,
      media: lineup.media,
      slots: lineup.slots,
      throws: lineup.throws,
      steps: lineup.steps,
      attributes: lineup.attributes,
      circles: lineup.circles,
      slotCircles: (lineup as any).slotCircles,
      source: lineup.source,
      status: lineup.status,
      createdAt: lineup.createdAt,
      updatedAt: lineup.updatedAt,
      // v2 extra: keep mediaRefs for importer to resolve jpgs
      mediaRefs,
      formatVersion: 2,
    };
    files[`lineups/${lineup.id}.json`] = strToU8(JSON.stringify(v2, null, 2));
  }

  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped as any], { type: "application/zip" });
  downloadBlob(blob, filename);
  return blob;
}

export async function exportAll() {
  const all = await getAllLineups();
  return exportLineups(all, `lineuplab-all-${new Date().toISOString().slice(0,10)}.zip`);
}

export async function exportFiltered(filtered: any[]) {
  return exportLineups(filtered, `lineuplab-filtered-${filtered.length}-${new Date().toISOString().slice(0,10)}.zip`);
}
