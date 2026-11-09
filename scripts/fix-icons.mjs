import { Jimp } from "jimp";
import path from "path";

const ACCENT = 0xE8404FFF;
async function createIcon(size, out){
  const img = new Jimp({ width: size, height: size, color: ACCENT });
  // Add simple LL text via drawing border?
  await img.write(out);
  console.log(`created ${out} ${size}x${size}`);
}
await createIcon(32, "src-tauri/icons/32x32.png");
await createIcon(128, "src-tauri/icons/128x128.png");
await createIcon(256, "src-tauri/icons/128x128@2x.png");
await createIcon(512, "src-tauri/icons/icon.png");
// ico needs to be png converted? We'll just copy 32x32 as ico placeholder but need valid ico header
// Create a simple ico by copying png data (tauri will accept png as ico fallback? Better to create real ico via Jimp? Jimp can write ico? Use png as ico for now)
import { readFileSync, writeFileSync } from "fs";
writeFileSync("src-tauri/icons/icon.ico", readFileSync("src-tauri/icons/32x32.png"));
console.log("done icons");
