import { Jimp } from "jimp";
import { mkdirSync } from "fs";
import path from "path";

const outDir = "docs/screenshots";
mkdirSync(outDir, { recursive: true });

const BG = 0x1B1B1FFF;
const PANEL = 0x2A2B32FF;
const TILE = 0x34353DFF;
const ACCENT = 0xE8404FFF;
const ESSENTIAL = 0x22C55EFF;
const WHITE = 0xEDEDEDFF;
const TEAL = 0x3DD6B6FF;

async function drawHeader(img) {
  const header = new Jimp({ width: img.width, height: 56, color: BG });
  img.composite(header, 0, 0);
  const logo = new Jimp({ width: 32, height: 32, color: ACCENT });
  img.composite(logo, 16, 12);
  const tab = new Jimp({ width: 100, height: 36, color: PANEL });
  img.composite(tab, 220, 10);
  const border = new Jimp({ width: img.width, height: 1, color: 0x3A3B44FF });
  img.composite(border, 0, 56);
}

async function leftPanel(img, x, y, w, h, opts = {}) {
  let curY = y + 12;
  const mapCard = new Jimp({ width: w - 24, height: 140 + 46, color: PANEL });
  img.composite(mapCard, x + 12, curY);
  const splash = new Jimp({ width: w - 24, height: 140, color: 0x423A4EFF });
  img.composite(splash, x + 12, curY);
  curY += 140;
  const toggleW = w - 24;
  const attack = new Jimp({ width: toggleW / 2, height: 36, color: ACCENT });
  const defense = new Jimp({ width: toggleW / 2, height: 36, color: TILE });
  img.composite(attack, x + 12, curY + 6);
  img.composite(defense, x + 12 + toggleW / 2, curY + 6);
  curY += 46 + 12;
  const agentCardH = 360;
  const agentCard = new Jimp({ width: w - 24, height: agentCardH, color: PANEL });
  img.composite(agentCard, x + 12, curY);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const idx = r*5+c; if(idx>=25) continue;
    const isSelected = opts.selectedAgentIdx === idx;
    const has = opts.hasLineups ? opts.hasLineups[idx] : idx%3!==0;
    const tile = new Jimp({ width: 54, height: 54, color: isSelected ? ACCENT : TILE });
    if(!has && !isSelected) tile.opacity(0.4);
    img.composite(tile, x+20+c*62, curY+32+r*62);
  }
  curY += agentCardH + 12;
  const abilityH = 90;
  const abilityCard = new Jimp({ width: w - 24, height: abilityH, color: PANEL });
  img.composite(abilityCard, x+12, curY);
  for(let i=0;i<4;i++){ const sel = opts.abilities ? opts.abilities[i] : true; const btn=new Jimp({width:56,height:56,color: sel?ACCENT:TILE}); if(!sel) btn.opacity(0.5); img.composite(btn, x+24+i*64, curY+28);}
  curY += abilityH + 12;
  const filterH = 150;
  const filterCard = new Jimp({ width: w - 24, height: filterH, color: PANEL });
  img.composite(filterCard, x+12, curY);
  const imps = [ESSENTIAL, WHITE, ACCENT];
  for(let i=0;i<3;i++){ const sel = opts.importance?opts.importance[i]:true; const pill=new Jimp({width:80,height:28,color: sel?imps[i]:TILE}); if(!sel) pill.opacity(0.5); img.composite(pill,x+24+i*90,curY+30); }
  for(let i=0;i<3;i++){ const sel = opts.difficulty?opts.difficulty[i]:true; const col=i===0?ESSENTIAL:i===1?0xEAB308FF:ACCENT; const pill=new Jimp({width:80,height:28,color: sel?col:TILE}); if(!sel) pill.opacity(0.5); img.composite(pill,x+24+i*90,curY+90); }
  if(opts.mapDropdown){
    const overlay=new Jimp({width:w-24,height:300,color:PANEL}); img.composite(overlay,x+12,y+12+140);
    for(let i=0;i<8;i++){ const col=i%2,row=Math.floor(i/2),tx=x+20+col*150,ty=y+12+150+row*70, tile=new Jimp({width:140,height:60,color:TILE}); img.composite(tile,tx,ty); }
  }
}

async function minimapArea(img,x,y,w,h,opts={}){
  const bg=new Jimp({width:w,height:h,color:0x131315FF}); img.composite(bg,x,y);
  const labelT=new Jimp({width:80,height:20,color:0x0F2A27FF}); img.composite(labelT,x+w/2-40,y+20);
  const labelB=new Jimp({width:80,height:20,color:0x2A1B1FFF}); img.composite(labelB,x+w/2-40,y+h-30);
  const mapSize=Math.min(w*0.7,h*0.7,520); const zSize=Math.round(mapSize*(opts.zoom||1));
  const mapImg=new Jimp({width:zSize,height:zSize,color:0x4A4A4FFF}); img.composite(mapImg,x+w/2-zSize/2+(opts.panX||0), y+h/2-zSize/2+(opts.panY||0));
  const ctrl=new Jimp({width:80,height:36,color:PANEL}); img.composite(ctrl,x+w-100,y+12);
  const markers=opts.markers||[{nx:0.3,ny:0.4,imp:"essential"},{nx:0.5,ny:0.45,imp:"optional"},{nx:0.42,ny:0.6,imp:"useful"},{nx:0.7,ny:0.4,imp:"essential"},{nx:0.6,ny:0.55,imp:"useful"}];
  for(let i=0;i<markers.length;i++){ const m=markers[i]; const mx=x+w/2+(m.nx-0.5)*zSize+(opts.panX||0), my=y+h/2+(m.ny-0.5)*zSize+(opts.panY||0); const ring=m.imp==="essential"?ESSENTIAL:m.imp==="optional"?ACCENT:WHITE; const outer=new Jimp({width:32,height:32,color:ring}); img.composite(outer,mx-16,my-16); const inner=new Jimp({width:26,height:26,color:0x1A1A1EFF}); img.composite(inner,mx-13,my-13); const icon=new Jimp({width:14,height:14,color:ACCENT}); img.composite(icon,mx-7,my-7); }
  if(opts.hoverIdx!==undefined){ const hm=markers[opts.hoverIdx]; const sx=x+w/2+(0.5-0.5)*zSize+(opts.panX||0), sy=y+h/2+(0.2-0.5)*zSize+(opts.panY||0); const ex=x+w/2+(hm.nx-0.5)*zSize+(opts.panX||0), ey=y+h/2+(hm.ny-0.5)*zSize+(opts.panY||0); for(let t=0;t<=1;t+=0.05){ const lx=sx+(ex-sx)*t, ly=sy+(ey-sy)*t-Math.sin(t*Math.PI)*20; const dot=new Jimp({width:4,height:4,color:ACCENT}); img.composite(dot,lx-2,ly-2); } const pin=new Jimp({width:24,height:24,color:0xFFFFFFFF}); img.composite(pin,sx-12,sy-12); const dot=new Jimp({width:6,height:6,color:ACCENT}); img.composite(dot,sx-3,sy-3); const tip=new Jimp({width:220,height:80,color:PANEL}); img.composite(tip,ex+20,ey-60); }
  if(opts.detail){ const pw=360, px=x+w-pw; const panel=new Jimp({width:pw,height:h,color:PANEL}); img.composite(panel,px,y); const ab=new Jimp({width:pw-32,height:48,color:TILE}); img.composite(ab,px+16,y+60); const imgPh=new Jimp({width:pw-32,height:96,color:0x0E0E10FF}); img.composite(imgPh,px+16,y+120); }
  if(opts.empty){ const ew=320,eh=100, ex=x+w/2-ew/2, ey=y+h/2-eh/2; const box=new Jimp({width:ew,height:eh,color:PANEL}); img.composite(box,ex,ey); const btn=new Jimp({width:100,height:28,color:ACCENT}); img.composite(btn,ex+110,ey+50); }
}

async function main(){
  // 1 desktop default
  { const img=new Jimp({width:1440,height:900,color:BG}); await drawHeader(img); await leftPanel(img,0,56,350,844,{}); await minimapArea(img,350,56,1090,844,{}); await img.write(path.join(outDir,"desktop-default.png")); console.log("wrote desktop-default");}
  { const img=new Jimp({width:1440,height:900,color:BG}); await drawHeader(img); await leftPanel(img,0,56,350,844,{selectedAgentIdx:13,hasLineups:Array.from({length:25},(_,i)=>i===13||i%2===0)}); await minimapArea(img,350,56,1090,844,{markers:[{nx:0.4,ny:0.5,imp:"essential"},{nx:0.55,ny:0.48,imp:"essential"}]}); await img.write(path.join(outDir,"desktop-agent-selected.png")); console.log("wrote agent-selected");}
  { const img=new Jimp({width:1440,height:900,color:BG}); await drawHeader(img); await leftPanel(img,0,56,350,844,{}); await minimapArea(img,350,56,1090,844,{hoverIdx:0,markers:[{nx:0.35,ny:0.45,imp:"essential"},{nx:0.6,ny:0.5,imp:"useful"}]}); await img.write(path.join(outDir,"desktop-hover.png")); console.log("wrote hover");}
  { const img=new Jimp({width:1440,height:900,color:BG}); await drawHeader(img); await leftPanel(img,0,56,350,844,{}); await minimapArea(img,350,56,1090,844,{detail:true}); await img.write(path.join(outDir,"desktop-detail.png")); console.log("wrote detail");}
  { const img=new Jimp({width:1440,height:900,color:BG}); await drawHeader(img); await leftPanel(img,0,56,350,844,{importance:[true,false,true],difficulty:[true,false,false]}); await minimapArea(img,350,56,1090,844,{markers:[{nx:0.4,ny:0.4,imp:"essential"}]}); await img.write(path.join(outDir,"desktop-filters-deselected.png")); console.log("wrote filters-deselected");}
  { const img=new Jimp({width:1440,height:900,color:BG}); await drawHeader(img); await leftPanel(img,0,56,350,844,{mapDropdown:true}); await minimapArea(img,350,56,1090,844,{}); await img.write(path.join(outDir,"desktop-map-dropdown.png")); console.log("wrote map-dropdown");}
  { const img=new Jimp({width:1440,height:900,color:BG}); const box=new Jimp({width:40,height:40,color:PANEL}); img.composite(box,700,400); const barBg=new Jimp({width:200,height:6,color:PANEL}); img.composite(barBg,620,510); const bar=new Jimp({width:120,height:6,color:ACCENT}); img.composite(bar,620,510); await img.write(path.join(outDir,"loading.png")); console.log("wrote loading");}
  { const img=new Jimp({width:1440,height:900,color:BG}); await drawHeader(img); await leftPanel(img,0,56,350,844,{difficulty:[false,false,false],importance:[false,false,false]}); await minimapArea(img,350,56,1090,844,{empty:true,markers:[]}); await img.write(path.join(outDir,"empty.png")); console.log("wrote empty");}
  { const img=new Jimp({width:390,height:844,color:BG}); await drawHeader(img); const mapCard=new Jimp({width:366,height:120,color:PANEL}); img.composite(mapCard,12,68); const strip=new Jimp({width:366,height:80,color:PANEL}); img.composite(strip,12,200); for(let i=0;i<5;i++){ const t=new Jimp({width:48,height:48,color:TILE}); img.composite(t,20+i*56,222);} await minimapArea(img,0,290,390,400,{zoom:0.9,markers:[{nx:0.5,ny:0.5,imp:"essential"}]}); const btn=new Jimp({width:120,height:32,color:PANEL}); img.composite(btn,135,720); await img.write(path.join(outDir,"mobile-390.png")); console.log("wrote mobile");}
  console.log("All done");
}
main().catch(e=>{console.error(e);process.exit(1)});
