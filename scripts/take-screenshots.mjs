import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { mkdirSync } from "fs";
import path from "path";

const outDir = "docs/screenshots";
mkdirSync(outDir, { recursive: true });

// Use the chromium we extracted with libs
const executablePath = "/tmp/chromium";
// Also need libs extracted via sparticuz al2023.tar
process.env.LD_LIBRARY_PATH = "/tmp/chromium-libs/lib:" + (process.env.LD_LIBRARY_PATH || "");

const VIEWPORT_DESKTOP = { width: 1440, height: 900 };
const VIEWPORT_MOBILE = { width: 390, height: 844 };

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function setPrefs(page, prefs){
  await page.evaluate((prefs)=>{
    localStorage.setItem("lineuplab_prefs_v1", JSON.stringify(prefs));
  }, prefs);
}

async function main(){
  const browser = await puppeteer.launch({
    executablePath,
    headless: chromium.headless || "shell",
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1440,900",
    ],
    // important to inherit env with LD_LIBRARY_PATH
    env: { ...process.env, LD_LIBRARY_PATH: "/tmp/chromium-libs/lib" },
  });
  console.log("browser launched");

  // Helper to create new page with interception for valorant-api to use fallback (avoid network)
  // We will not intercept; let it use fallback quickly.

  // 1. Desktop default
  {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT_DESKTOP);
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1500);
    // Check no broken images
    const broken = await page.evaluate(()=>{
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs.filter(i=> !i.complete || i.naturalWidth===0).map(i=>i.src);
    });
    console.log("default broken images:", broken.slice(0,5));
    await page.screenshot({ path: path.join(outDir, "desktop-default.png"), fullPage: false });
    console.log("wrote desktop-default");
    await page.close();
  }

  // 2. Agent selected - pick first available agent via clicking
  {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT_DESKTOP);
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    // Click first bright agent tile (not dimmed)
    await page.evaluate(()=>{
      const btns = Array.from(document.querySelectorAll('aside button'));
      // Find agent grid buttons - they have opacity 1 and contain img
      const agentBtns = Array.from(document.querySelectorAll('aside button')).filter(b=> b.querySelector('img') && b.textContent.trim().length<10);
      console.log("agentBtns", agentBtns.length);
      // Pick first non-dimmed (opacity not 0.4)
      const target = agentBtns.find(b=> b.style.opacity !== "0.4" && !b.style.opacity.includes("0.4")) || agentBtns[0];
      if(target) target.click();
    });
    await sleep(800);
    await page.screenshot({ path: path.join(outDir, "desktop-agent-selected.png"), fullPage: false });
    console.log("wrote agent-selected");
    await page.close();
  }

  // 3. Hover marker - hover over first marker
  {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT_DESKTOP);
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    // Find markers (buttons with aria-label containing title)
    const markers = await page.$$("button[aria-label]");
    console.log("markers found", markers.length);
    if(markers.length>0){
      const box = await markers[0].boundingBox();
      if(box){
        await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
        await sleep(600);
        await page.screenshot({ path: path.join(outDir, "desktop-hover.png"), fullPage: false });
        console.log("wrote hover");
      }
    }
    await page.close();
  }

  // 4. Detail panel - click marker
  {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT_DESKTOP);
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    const markers = await page.$$("button[aria-label]");
    if(markers.length>0){
      await markers[0].click();
      await sleep(800);
      await page.screenshot({ path: path.join(outDir, "desktop-detail.png"), fullPage: false });
      console.log("wrote detail");
    }
    await page.close();
  }

  // 5. Filters partially deselected - toggle off some
  {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT_DESKTOP);
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    await page.evaluate(()=>{
      // Find filter buttons: Importance Useful and Difficulty Hard
      const btns = Array.from(document.querySelectorAll("button"));
      const useful = btns.find(b=> b.textContent.trim()==="Useful");
      const hard = btns.find(b=> b.textContent.trim()==="Hard");
      if(useful) useful.click();
      if(hard) hard.click();
    });
    await sleep(600);
    await page.screenshot({ path: path.join(outDir, "desktop-filters-deselected.png"), fullPage: false });
    console.log("wrote filters-deselected");
    await page.close();
  }

  // 6. Map dropdown open - click map card
  {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT_DESKTOP);
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    await page.evaluate(()=>{
      const banner = document.querySelector('button[aria-haspopup="dialog"]');
      if(banner) banner.click();
    });
    await sleep(800);
    await page.screenshot({ path: path.join(outDir, "desktop-map-dropdown.png"), fullPage: false });
    console.log("wrote map-dropdown");
    await page.close();
  }

  // 7. Loading state - intercept valorant-api to delay, then screenshot quickly before fallback
  {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT_DESKTOP);
    await page.setRequestInterception(true);
    page.on('request', req=>{
      const url = req.url();
      if(url.includes("valorant-api.com")){
        // delay 10s to keep loading
        // do not respond, keep pending
        // but we need to allow after screenshot? For now just abort after timeout? We'll keep hanging
        // Instead we can not respond and after 2 sec we screenshot loading
        return; // hang
      }
      req.continue();
    });
    // Clear caches before goto
    await page.evaluateOnNewDocument(()=>{
      try{ localStorage.clear(); }catch{}
    });
    page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" }).catch(()=>{});
    await sleep(1200);
    await page.screenshot({ path: path.join(outDir, "loading.png"), fullPage: false });
    console.log("wrote loading");
    await page.setRequestInterception(false);
    await page.close();
  }

  // 8. Empty state - set filters to none via localStorage
  {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT_DESKTOP);
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
    // Need to wait for reload
    await page.waitForNavigation({ waitUntil: "networkidle2" }).catch(()=>{});
    await sleep(1000);
    await page.screenshot({ path: path.join(outDir, "empty.png"), fullPage: false });
    console.log("wrote empty");
    await page.close();
  }

  // 9. Mobile 390
  {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT_MOBILE);
    await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
    await sleep(1200);
    await page.screenshot({ path: path.join(outDir, "mobile-390.png"), fullPage: false });
    console.log("wrote mobile");
    await page.close();
  }

  await browser.close();
  console.log("All screenshots done");
}

main().catch(e=>{ console.error(e); process.exit(1); });
