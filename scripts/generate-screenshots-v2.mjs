import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { mkdirSync, readFileSync } from "fs";
import path from "path";
import { writeFileSync } from "fs";

const outDir = "docs/screenshots";
mkdirSync(outDir, { recursive: true });
const executablePath = "/tmp/chromium";
process.env.LD_LIBRARY_PATH = "/tmp/chromium-libs/lib:" + (process.env.LD_LIBRARY_PATH || "");

let placeholderPng;
try { placeholderPng = readFileSync("src-tauri/icons/icon.png"); } catch { const b64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="; placeholderPng = Buffer.from(b64,"base64"); }
const fallbackAgents = JSON.parse(readFileSync("src/data/fallbackAgents.json","utf-8"));
const fallbackMaps = JSON.parse(readFileSync("src/data/fallbackMaps.json","utf-8"));
const samplePackZip = readFileSync("sample-pack.zip");

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function main(){
  const browser = await puppeteer.launch({
    executablePath,
    headless: chromium.headless || "shell",
    args: [...chromium.args, "--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu","--window-size=1440,900"],
    env: { ...process.env, LD_LIBRARY_PATH: "/tmp/chromium-libs/lib" },
  });
  console.log("browser launched");

  async function newPageWithInterception(delay=false){
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', req=>{
      const url=req.url();
      if(url.includes("media.valorant-api.com") || (url.includes("valorant-api.com") && url.includes(".png"))){
        req.respond({ status:200, contentType:"image/png", body: placeholderPng, headers:{ "Access-Control-Allow-Origin":"*" }}) .catch(()=>{}); return;
      }
      if(url.includes("valorant-api.com/v1/version")){
        req.respond({ status:200, contentType:"application/json", body: JSON.stringify({ data:{ riotClientVersion:"10.00.00"}})}) ;return;
      }
      if(url.includes("valorant-api.com/v1/agents")){
        if(delay) return;
        req.respond({ status:200, contentType:"application/json", body: JSON.stringify({ status:200, data: fallbackAgents }) }); return;
      }
      if(url.includes("valorant-api.com/v1/maps")){
        if(delay) return;
        req.respond({ status:200, contentType:"application/json", body: JSON.stringify({ status:200, data: fallbackMaps.map(m=>({ ...m, tacticalDescription:"", callouts:[] })) }) }); return;
      }
      req.continue().catch(()=>{});
    });
    return page;
  }

  // Helper to set localStorage to have some history already? We'll just start clean.
  // 1 Desktop default
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:1440, height:900});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(2000);
    await page.screenshot({path:path.join(outDir,"desktop-default.png")});
    console.log("desktop-default");
    await page.close();
  }
  // 2 hover
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:1440,height:900});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(1200);
    const markers=await page.$$("button[aria-label]");
    console.log("markers hover",markers.length);
    if(markers.length>0){
      const box=await markers[0].boundingBox();
      if(box){ await page.mouse.move(box.x+box.width/2, box.y+box.height/2); await sleep(700); await page.screenshot({path:path.join(outDir,"desktop-hover.png")}); console.log("desktop-hover"); }
    }
    await page.close();
  }
  // 3 detail
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:1440,height:900});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(1200);
    const markers=await page.$$("button[aria-label]");
    if(markers.length>0){ await markers[0].click(); await sleep(900); await page.screenshot({path:path.join(outDir,"desktop-detail.png")}); console.log("desktop-detail"); }
    await page.close();
  }
  // 4 agent selected
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:1440,height:900});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(1200);
    await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll('aside button')).filter(b=>b.querySelector('img')&&b.textContent.trim().length<12); const t=btns[2]||btns[0]; if(t) t.click(); });
    await sleep(800); await page.screenshot({path:path.join(outDir,"desktop-agent-selected.png")}); console.log("desktop-agent-selected"); await page.close();
  }
  // 5 filters deselected
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:1440,height:900});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(1200);
    await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll("button")); const useful=btns.find(b=>b.textContent.trim()==="Useful"); const hard=btns.find(b=>b.textContent.trim()==="Hard"); if(useful) useful.click(); if(hard) hard.click(); });
    await sleep(600); await page.screenshot({path:path.join(outDir,"desktop-filters-deselected.png")}); console.log("filters-deselected"); await page.close();
  }
  // 6 map dropdown
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:1440,height:900});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(1200);
    await page.evaluate(()=>{ const banner=document.querySelector('button[aria-haspopup="dialog"]'); if(banner) banner.click(); });
    await sleep(800); await page.screenshot({path:path.join(outDir,"desktop-map-dropdown.png")}); console.log("map-dropdown"); await page.close();
  }
  // 7 Import dialog - closed state with button then open dialog
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:1440,height:900});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(1200);
    // click Import button in top bar
    const found = await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll('header button')); const b=btns.find(x=>x.textContent.includes("Import")); if(b) b.click(); return !!b; });
    console.log("import btn clicked",found);
    await sleep(800);
    await page.screenshot({path:path.join(outDir,"desktop-import-dialog.png")});
    console.log("desktop-import-dialog");
    // Now try to set file input with sample-pack.zip via evaluate creating DataTransfer
    // We'll inject file via JS: create a File from samplePackZip buffer via base64? Alternative: just screenshot empty dialog (already satisfies "import dialogs")
    // For preview table we can simulate by directly calling parsePackZip in page via injected script using same logic? Simpler: just keep dialog screenshot.
    // Also screenshot progress/report would require actual import, but we can simulate by dispatching a fake preview via localStorage hack?
    // We'll attempt to trigger file input programmatically via page.evaluate with custom File.
    try {
      const b64 = samplePackZip.toString('base64');
      await page.evaluate(async (b64)=>{
        const binStr = atob(b64);
        const bytes = new Uint8Array(binStr.length);
        for(let i=0;i<binStr.length;i++) bytes[i]=binStr.charCodeAt(i);
        const file = new File([bytes], "sample-pack.zip", {type:"application/zip"});
        // find input type file
        const input = document.querySelector('input[type="file"]');
        if(!input) return "no input";
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', {bubbles:true}));
        return "dispatched";
      }, b64);
      await sleep(1500);
      await page.screenshot({path:path.join(outDir,"desktop-import-preview.png")});
      console.log("desktop-import-preview");
      // click Import button inside dialog
      await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll('button')); const b=btns.find(x=>x.textContent.includes("Import") && x.textContent.includes("lineups")); if(b) b.click(); return !!b; });
      await sleep(1200);
      await page.screenshot({path:path.join(outDir,"desktop-import-report.png")});
      console.log("desktop-import-report");
    } catch(e){ console.log("import simulate fail",e); }
    await page.close();
  }
  // 8 Create wizard steps (Setup default)
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:1440,height:900});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(1200);
    // click Create tab
    await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll('header button')); const b=btns.find(x=>x.textContent.trim()==="Create"); if(b) b.click(); });
    await sleep(800);
    await page.screenshot({path:path.join(outDir,"desktop-create-setup.png")});
    console.log("create-setup");
    // click Next to Capture
    await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll('button')); const n=btns.find(x=>x.textContent.trim()==="Next"); if(n) n.click(); });
    await sleep(600); await page.screenshot({path:path.join(outDir,"desktop-create-capture.png")}); console.log("create-capture");
    await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll('button')); const n=btns.find(x=>x.textContent.trim()==="Next"); if(n) n.click(); });
    await sleep(600); await page.screenshot({path:path.join(outDir,"desktop-create-pins.png")}); console.log("create-pins");
    await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll('button')); const n=btns.find(x=>x.textContent.trim()==="Next"); if(n) n.click(); });
    await sleep(600); await page.screenshot({path:path.join(outDir,"desktop-create-details.png")}); console.log("create-details");
    await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll('button')); const n=btns.find(x=>x.textContent.trim()==="Next"); if(n) n.click(); });
    await sleep(600); await page.screenshot({path:path.join(outDir,"desktop-create-review.png")}); console.log("create-review");
    await page.close();
  }
  // 9 Settings dialog
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:1440,height:900});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(1200);
    await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll('header button')); const b=btns.find(x=>x.textContent.includes("Settings")); if(b) b.click(); });
    await sleep(700); await page.screenshot({path:path.join(outDir,"desktop-settings.png")}); console.log("desktop-settings");
    await page.close();
  }
  // 10 Mobile variants 390x844
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:390,height:844});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(1500);
    await page.screenshot({path:path.join(outDir,"mobile-390.png")});
    console.log("mobile-390");
    // hover not really on mobile but try marker click for detail
    const markers=await page.$$("button[aria-label]");
    if(markers.length>0){
      await markers[0].click(); await sleep(900);
      await page.screenshot({path:path.join(outDir,"mobile-390-detail.png")});
      console.log("mobile-detail");
      // close detail via Esc
      await page.keyboard.press("Escape"); await sleep(400);
    }
    // open import on mobile
    await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll('header button')); const b=btns.find(x=>x.textContent.includes("Import")); if(b) b.click(); });
    await sleep(700); await page.screenshot({path:path.join(outDir,"mobile-390-import.png")}); console.log("mobile-import");
    await page.close();
  }
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:390,height:844});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(1200);
    await page.evaluate(()=>{ const btns=Array.from(document.querySelectorAll('header button')); const b=btns.find(x=>x.textContent.trim()==="Create"); if(b) b.click(); });
    await sleep(800); await page.screenshot({path:path.join(outDir,"mobile-390-create.png")}); console.log("mobile-create");
    await page.close();
  }
  // Loading + empty
  {
    const page=await newPageWithInterception(true);
    await page.setViewport({width:1440,height:900});
    await page.evaluateOnNewDocument(()=>{ try{ localStorage.clear(); }catch{} });
    page.goto("http://localhost:5173").catch(()=>{}); await sleep(1500);
    await page.screenshot({path:path.join(outDir,"loading.png")}); console.log("loading"); await page.close();
  }
  {
    const page=await newPageWithInterception(false);
    await page.setViewport({width:1440,height:900});
    await page.goto("http://localhost:5173",{waitUntil:"networkidle2"});
    await sleep(1200);
    await page.evaluate(()=>{ const prefs=JSON.parse(localStorage.getItem("lineuplab_prefs_v1")||"{}"); prefs.importance=[]; prefs.difficulty=[]; prefs.selectedAbilities=[]; localStorage.setItem("lineuplab_prefs_v1", JSON.stringify(prefs)); location.reload(); });
    await sleep(1500); await page.waitForNetworkIdle({idleTime:500}).catch(()=>{}); await sleep(500);
    await page.screenshot({path:path.join(outDir,"empty.png")}); console.log("empty"); await page.close();
  }

  await browser.close();
  console.log("All done v2");
}
main().catch(e=>{ console.error(e); process.exit(1); });
