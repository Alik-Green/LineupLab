import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { mkdirSync, readFileSync } from "fs";
import path from "path";

const outDir = "docs/screenshots";
mkdirSync(outDir, { recursive: true });
const executablePath = "/tmp/chromium";
process.env.LD_LIBRARY_PATH = "/tmp/chromium-libs/lib:" + (process.env.LD_LIBRARY_PATH || "");

// Use larger icon as placeholder for all media
import { readFileSync as readFile } from "fs";
let placeholderPng;
try {
  placeholderPng = readFile("src-tauri/icons/icon.png");
} catch {
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
  placeholderPng = Buffer.from(b64, "base64");
}

// Fallback agents/maps JSON - read from our fallback files to serve via interception so app gets data quickly
const fallbackAgents = JSON.parse(readFileSync("src/data/fallbackAgents.json","utf-8"));
const fallbackMaps = JSON.parse(readFileSync("src/data/fallbackMaps.json","utf-8"));

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function main(){
  const browser = await puppeteer.launch({
    executablePath,
    headless: chromium.headless || "shell",
    args: [...chromium.args, "--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu","--window-size=1440,900"],
    env: { ...process.env, LD_LIBRARY_PATH: "/tmp/chromium-libs/lib" },
  });
  console.log("browser launched");

  // Helper to create page with interception
  async function newPageWithInterception(delayValorantApi=false){
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', req=>{
      const url = req.url();
      if(url.includes("media.valorant-api.com")){
        console.log("intercept media", url.slice(0,120));
        req.respond({
          status: 200,
          contentType: "image/png",
          body: placeholderPng,
          headers: { "Access-Control-Allow-Origin": "*" },
        }).catch(()=>{});
        return;
      }
      if(url.includes("valorant-api.com") && url.includes(".png")){
        console.log("intercept valorant png", url.slice(0,120));
        req.respond({
          status: 200,
          contentType: "image/png",
          body: placeholderPng,
          headers: { "Access-Control-Allow-Origin": "*" },
        }).catch(()=>{});
        return;
      }
      if(url.includes("valorant-api.com/v1/version")){
        req.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { riotClientVersion: "10.00.00" }}),
        });
        return;
      }
      if(url.includes("valorant-api.com/v1/agents")){
        if(delayValorantApi){
          // hang to simulate loading
          return; // do not respond
        }
        req.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: 200, data: fallbackAgents }),
        });
        return;
      }
      if(url.includes("valorant-api.com/v1/maps")){
        if(delayValorantApi){
          return;
        }
        req.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: 200, data: fallbackMaps.map(m=>({ ...m, tacticalDescription: "", callouts: [] })) }),
        });
        return;
      }
      req.continue().catch(()=>{});
    });
    return page;
  }

  // 1. Desktop default 1440x900
  {
    const page = await newPageWithInterception(false);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(2500);
    const broken = await page.evaluate(()=> Array.from(document.querySelectorAll("img")).filter(i=> i.complete && i.naturalWidth===0).length);
    console.log("default broken after intercept:", broken);
    await page.screenshot({ path: path.join(outDir, "desktop-default.png") });
    console.log("wrote desktop-default");
    await page.close();
  }

  // 2. Agent selected
  {
    const page = await newPageWithInterception(false);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    await page.evaluate(()=>{
      const btns = Array.from(document.querySelectorAll('aside button'));
      const agentBtns = Array.from(document.querySelectorAll('aside button')).filter(b=> b.querySelector('img') && b.textContent.trim().length<12);
      const target = agentBtns[2] || agentBtns[0];
      if(target) target.click();
    });
    await sleep(800);
    await page.screenshot({ path: path.join(outDir, "desktop-agent-selected.png") });
    console.log("wrote agent-selected");
    await page.close();
  }

  // 3. Hover marker
  {
    const page = await newPageWithInterception(false);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    const markers = await page.$$("button[aria-label]");
    console.log("markers hover", markers.length);
    if(markers.length>0){
      const box = await markers[0].boundingBox();
      if(box){
        await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
        await sleep(700);
        await page.screenshot({ path: path.join(outDir, "desktop-hover.png") });
        console.log("wrote hover");
      }
    }
    await page.close();
  }

  // 4. Detail panel
  {
    const page = await newPageWithInterception(false);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    const markers = await page.$$("button[aria-label]");
    if(markers.length>0){
      await markers[0].click();
      await sleep(900);
      await page.screenshot({ path: path.join(outDir, "desktop-detail.png") });
      console.log("wrote detail");
    }
    await page.close();
  }

  // 5. Filters partially deselected
  {
    const page = await newPageWithInterception(false);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    await page.evaluate(()=>{
      const btns = Array.from(document.querySelectorAll("button"));
      const useful = btns.find(b=> b.textContent.trim()==="Useful");
      const hard = btns.find(b=> b.textContent.trim()==="Hard");
      if(useful) useful.click();
      if(hard) hard.click();
    });
    await sleep(600);
    await page.screenshot({ path: path.join(outDir, "desktop-filters-deselected.png") });
    console.log("wrote filters-deselected");
    await page.close();
  }

  // 6. Map dropdown
  {
    const page = await newPageWithInterception(false);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    await page.evaluate(()=>{
      const banner = document.querySelector('button[aria-haspopup="dialog"]');
      if(banner) banner.click();
    });
    await sleep(800);
    await page.screenshot({ path: path.join(outDir, "desktop-map-dropdown.png") });
    console.log("wrote map-dropdown");
    await page.close();
  }

  // 7. Loading
  {
    const page = await newPageWithInterception(true);
    await page.setViewport({ width: 1440, height: 900 });
    await page.evaluateOnNewDocument(()=>{
      try{ localStorage.clear(); }catch{}
    });
    page.goto("http://localhost:5173").catch(()=>{});
    await sleep(1500);
    // Should be in loading state
    await page.screenshot({ path: path.join(outDir, "loading.png") });
    console.log("wrote loading");
    await page.close();
  }

  // 8. Empty
  {
    const page = await newPageWithInterception(false);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    await page.evaluate(()=>{
      const prefs = JSON.parse(localStorage.getItem("lineuplab_prefs_v1")||"{}");
      prefs.importance = [];
      prefs.difficulty = [];
      prefs.selectedAbilities = [];
      localStorage.setItem("lineuplab_prefs_v1", JSON.stringify(prefs));
      location.reload();
    });
    await sleep(1500);
    // wait a bit for reload
    await page.waitForNetworkIdle({ idleTime: 500 }).catch(()=>{});
    await sleep(500);
    await page.screenshot({ path: path.join(outDir, "empty.png") });
    console.log("wrote empty");
    await page.close();
  }

  // 9. Mobile 390
  {
    const page = await newPageWithInterception(false);
    await page.setViewport({ width: 390, height: 844 });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    await page.screenshot({ path: path.join(outDir, "mobile-390.png") });
    console.log("wrote mobile");
    await page.close();
  }

  // Automated checks
  {
    const page = await newPageWithInterception(false);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    const checks = await page.evaluate(()=>{
      const imgs = Array.from(document.querySelectorAll("img"));
      const broken = imgs.filter(i=> i.complete && i.naturalWidth===0).map(i=>({src:i.src, w:i.naturalWidth, complete:i.complete}));
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      const buttons = Array.from(document.querySelectorAll("button"));
      const visibleButtons = buttons.filter(b=> b.offsetParent !== null && b.getBoundingClientRect().width>0);
      const small = visibleButtons.filter(b=>{
        const r = b.getBoundingClientRect();
        return r.width < 40 || r.height < 40;
      });
      const smallDetails = small.slice(0,5).map(b=> ({text: b.textContent.trim().slice(0,20), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height, cls: b.className.slice(0,80)}));
      return { brokenCount: broken.length, broken, overflow, smallButtons: small.length, smallDetails, buttonCount: buttons.length, visibleCount: visibleButtons.length, width: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
    });
    console.log("automated checks:", JSON.stringify(checks,null,2));
    if(checks.brokenCount>0) console.warn("WARN: broken images", checks.broken);
    if(checks.overflow) console.warn("WARN: horizontal overflow", checks);
    console.log(`buttons ${checks.buttonCount} visible ${checks.visibleCount}, small ${checks.smallButtons}`, checks.smallDetails);
    await page.close();
  }

  await browser.close();
  console.log("All done");
}
main().catch(e=>{ console.error(e); process.exit(1); });
