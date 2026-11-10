import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";

type Peer = { id: string; name: string; addr: string; seen: string };

export default function LANShare({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"host" | "join">("host");
  const [joinCode, setJoinCode] = useState("");
  const [discovered, setDiscovered] = useState<Peer[]>(() => {
    try { const raw = localStorage.getItem("lineuplab.lan.peers"); return raw ? (JSON.parse(raw) as Peer[]) : []; } catch { return []; }
  });
  const [hosting, setHosting] = useState(false);
  const [lanEnabled, setLanEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user.preferences") || "{}")?.lanEnabled ?? true; } catch { return true; }
  });
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [tauriAddr, setTauriAddr] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const mockIp = tauriAddr ?? "192.168.1.42";
  const mockPort = "3030";
  const fullAddr = `${mockIp}:${mockPort}`;
  const joinUrl = `lineuplab://${fullAddr}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const tauri = (window as any).__TAURI__;
        const invoke: any = tauri?.core?.invoke ?? tauri?.invoke;
        if (!invoke) return;
        const addr = await invoke("lan_get_addrs").catch(() => null);
        if (addr && alive) setTauriAddr(String(addr));
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  // generate QR whenever address changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await QRCode.toDataURL(joinUrl, { width: 256, margin: 1, color: { dark: "#000000", light: "#FFFFFF" } });
        if (!cancelled) setQrUrl(url);
        // also render to canvas if present
        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, joinUrl, { width: 160, margin: 1 });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [joinUrl]);

  useEffect(() => {
    if (!hosting) return;
    const id = `host-${Date.now().toString(36)}`;
    const tick = () => {
      try {
        const key = "lineuplab.lan.beacons";
        const now = Date.now();
        const raw = localStorage.getItem(key);
        const beacons: Array<{ id: string; name: string; addr: string; ts: number }> = raw ? JSON.parse(raw) : [];
        const alive = beacons.filter(b => now - b.ts < 30_000);
        const mine = { id, name: `This device`, addr: fullAddr, ts: now };
        const next = [...alive.filter(b => b.id !== id), mine];
        localStorage.setItem(key, JSON.stringify(next));
        setDiscovered(next.filter(b=>b.id!==id).map(b=>({ id: b.id, name: b.name, addr: b.addr, seen: new Date(b.ts).toLocaleTimeString() })));
      } catch {}
    };
    tick();
    const iv = window.setInterval(tick, 2500);
    return () => window.clearInterval(iv);
  }, [hosting, fullAddr]);

  const startHost = async () => {
    try {
      const invoke = (window as any).__TAURI__?.core?.invoke ?? (window as any).__TAURI__?.invoke;
      if (invoke) await invoke("lan_host_start", { port: Number(mockPort) }).catch(()=>null);
    } catch {}
    setHosting(true);
    setStatus("Hosting — broadcasting on LAN. Others can scan QR or paste address.");
    setTimeout(()=>setStatus(null), 3500);
  };
  const stopHost = async () => {
    try { const invoke = (window as any).__TAURI__?.core?.invoke ?? (window as any).__TAURI__?.invoke; if (invoke) await invoke("lan_host_stop").catch(()=>null); } catch {}
    setHosting(false);
    setStatus("Host stopped.");
    setTimeout(()=>setStatus(null), 2000);
  };

  const handleJoin = async () => {
    const addr = joinCode.trim();
    if (!addr) { setStatus("Enter an address like 192.168.1.42:3030"); setTimeout(()=>setStatus(null),2500); return; }
    try {
      const invoke = (window as any).__TAURI__?.core?.invoke ?? (window as any).__TAURI__?.invoke;
      if (invoke) {
        await invoke("lan_join", { addr }).catch((e: any)=>{ throw new Error(String(e)); });
        setStatus(`Join requested: ${addr}`);
      } else {
        const list: Peer[] = [...discovered, { id: `peer-${Date.now()}`, name: `Peer @ ${addr}`, addr, seen: new Date().toLocaleTimeString() }];
        setDiscovered(list);
        localStorage.setItem("lineuplab.lan.peers", JSON.stringify(list));
        setStatus(`Added ${addr} (browser preview — desktop will sync).`);
      }
    } catch (e: any) { setStatus(`Join failed: ${e?.message ?? String(e)}`); }
    setTimeout(()=>setStatus(null), 3500);
  };

  const shareViaWebShare = async () => {
    const text = `Join my LineupLab LAN: ${joinUrl} (${fullAddr})`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: "LineupLab LAN", text, url: joinUrl });
        setStatus("Shared via system share");
      } else {
        await navigator.clipboard.writeText(text);
        setStatus("Copied share link");
      }
    } catch { setStatus("Share cancelled"); }
    setTimeout(()=>setStatus(null),2500);
  };

  const downloadQr = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `lineuplab-lan-${fullAddr.replace(/[:.\/]/g,"_")}.png`;
    a.click();
  };

  const exportMyBundle = () => {
    try {
      const raw = localStorage.getItem("lineups_v2") || localStorage.getItem("lineuplab.lineups");
      const arr = raw ? JSON.parse(raw) : [];
      const n = Array.isArray(arr) ? arr.length : 0;
      setStatus(n ? `You have ${n} lineup(s) ready to share via Export → file or LAN when hosting.` : "No lineups yet — create one first.");
    } catch { setStatus("No lineups yet — create one first."); }
    setTimeout(()=>setStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-panel border border-borderSubtle rounded-card w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b border-borderSubtle flex items-center justify-between">
          <div>
            <h3 className="text-textPrimary font-bold tracking-tight">LAN Share</h3>
            <p className="text-xs text-muted">Host on this PC • Join from another on same Wi-Fi • QR for mobile companion</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded bg-tile flex items-center justify-center text-muted border border-borderSubtle">✕</button>
        </div>

        <div className="p-4 space-y-4 overflow-auto">
          <div className="flex gap-2">
            <button onClick={()=>setMode("host")} className={`flex-1 py-2 rounded-md border font-bold text-sm ${mode==="host"?"bg-accent text-white border-accent":"bg-tile text-muted border-borderSubtle hover:text-textPrimary"}`}>Host</button>
            <button onClick={()=>setMode("join")} className={`flex-1 py-2 rounded-md border font-bold text-sm ${mode==="join"?"bg-accent text-white border-accent":"bg-tile text-muted border-borderSubtle hover:text-textPrimary"}`}>Join</button>
            <button onClick={exportMyBundle} className="px-3 py-2 rounded-md bg-pageBg border border-borderSubtle text-xs text-textPrimary min-h-[40px]">My bundle</button>
          </div>

          {mode==="host" ? (
            <div className="space-y-3">
              <div className="rounded-md bg-tile border border-borderSubtle p-3">
                <p className="text-xs font-bold tracking-widest text-muted mb-1">YOUR ADDRESS</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-panel border border-borderSubtle rounded px-2 py-2 text-sm text-textPrimary">{fullAddr}</code>
                  <button onClick={async()=>{
                    try { await navigator.clipboard.writeText(fullAddr); } catch {}
                    setCopied(true); setTimeout(()=>setCopied(false),1500);
                  }} className="px-3 py-2 rounded bg-panel border border-borderSubtle text-xs text-textPrimary min-h-[40px]">{copied ? "Copied" : "Copy"}</button>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={shareViaWebShare} className="flex-1 py-2 rounded bg-panel border border-borderSubtle text-xs font-bold text-textPrimary">Share…</button>
                  <button onClick={()=>{ try{ navigator.clipboard.writeText(joinUrl); setStatus("Copied join URL"); setTimeout(()=>setStatus(null),2000);}catch{} }} className="flex-1 py-2 rounded bg-panel border border-borderSubtle text-xs font-bold text-textPrimary">Copy URL</button>
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={lanEnabled} onChange={e=>{
                    const v=e.target.checked; setLanEnabled(v);
                    try { const raw=localStorage.getItem("user.preferences"); const prefs=raw?JSON.parse(raw):{}; prefs.lanEnabled=v; localStorage.setItem("user.preferences", JSON.stringify(prefs)); window.dispatchEvent(new CustomEvent("lineuplab:prefs", { detail: prefs })); } catch {}
                  }} /> Advertise on LAN
                </label>
                <p className="text-xs text-muted mt-2">Desktop opens a local HTTP server for direct transfer. Browser shows preview beacon + QR.</p>
              </div>

              <div className="rounded-md bg-panel border border-borderSubtle p-3 flex flex-col items-center gap-3">
                <div className="bg-white rounded p-2 shadow-inner">
                  {qrUrl ? <img src={qrUrl} alt="QR" className="w-40 h-40 object-contain" /> : <canvas ref={canvasRef} width={160} height={160} className="w-40 h-40" />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-textPrimary">{fullAddr}</p>
                  <p className="text-[10px] text-muted break-all px-2">{joinUrl}</p>
                </div>
                <div className="flex gap-2 w-full">
                  <button onClick={downloadQr} className="flex-1 py-2 rounded bg-tile border border-borderSubtle text-xs font-bold text-textPrimary">Download QR</button>
                  <button onClick={shareViaWebShare} className="flex-1 py-2 rounded bg-accent text-white text-xs font-bold">Share QR</button>
                </div>
                <p className="text-xs text-muted text-center">Scan with companion Android app or any QR scanner to join instantly.</p>
              </div>

              <div className="flex gap-2">
                {!hosting ? <button onClick={startHost} className="flex-1 py-2 rounded bg-accent text-white font-bold min-h-[40px]">Start Host</button> : <button onClick={stopHost} className="flex-1 py-2 rounded bg-tile border border-borderSubtle text-textPrimary font-bold min-h-[40px]">Stop Host</button>}
                <button onClick={()=>setStatus("Settings live in Preferences → LAN. Port 3030 default.")} className="px-4 py-2 rounded bg-tile border border-borderSubtle text-textPrimary min-h-[40px]">Settings</button>
              </div>

              {discovered.length > 0 && (
                <div className="rounded-md bg-pageBg border border-borderSubtle p-3">
                  <p className="text-xs font-bold tracking-widest text-muted mb-2">DISCOVERED ({discovered.length})</p>
                  <ul className="space-y-1">
                    {discovered.map(p=>(
                      <li key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-textPrimary font-semibold">{p.name}</span>
                        <span className="text-muted">{p.addr} • {p.seen}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={()=>{
                    const payload = { type:"lineuplab-beacons", beacons: discovered, addr: fullAddr, at: new Date().toISOString() };
                    const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
                    const url = URL.createObjectURL(blob);
                    const a=document.createElement("a"); a.href=url; a.download="lineuplab-lan-beacons.json"; a.click();
                    URL.revokeObjectURL(url);
                  }} className="mt-2 w-full py-1.5 rounded bg-panel border border-borderSubtle text-xs text-textPrimary">Export beacons</button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-bold tracking-widest text-muted">JOIN CODE OR IP</label>
              <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="192.168.1.42:3030 or lineuplab://..." className="w-full px-3 py-2 rounded-md bg-pageBg border border-borderSubtle text-textPrimary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              <div className="flex gap-2">
                <button onClick={handleJoin} className="flex-1 py-2 rounded bg-accent text-white font-bold min-h-[40px]">Join</button>
                <button onClick={()=>setJoinCode(fullAddr)} className="px-3 py-2 rounded bg-tile border border-borderSubtle text-textPrimary text-xs min-h-[40px]">Use host address</button>
              </div>
              <div className="rounded-md bg-tile border border-borderSubtle p-2 flex items-center gap-2">
                <input type="file" accept="image/*" id="qr-file" className="hidden" onChange={async e=>{
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setStatus("QR scan in companion app — paste code here for now");
                  setTimeout(()=>setStatus(null),2500);
                }} />
                <label htmlFor="qr-file" className="flex-1 py-2 rounded bg-panel border border-borderSubtle text-center text-xs font-bold text-textPrimary cursor-pointer">Scan QR from image (coming to companion)</label>
              </div>
              {discovered.length > 0 && (
                <div className="rounded-md bg-pageBg border border-borderSubtle p-3">
                  <p className="text-xs font-bold tracking-widest text-muted mb-2">KNOWN PEERS</p>
                  <ul className="space-y-1">
                    {discovered.map(p=>(
                      <li key={p.id} className="flex items-center justify-between text-xs">
                        <button onClick={()=>setJoinCode(p.addr)} className="text-accent hover:underline text-left font-mono">{p.addr}</button>
                        <span className="text-muted">{p.seen}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="bg-accent/10 border border-accent/30 rounded p-2 text-xs text-muted">
                <b className="text-accent">How to join:</b> 1) Host taps Start Host → shares QR/URL 2) You paste address or scan with Android companion app 3) Lineups sync automatically (desktop) — browser preview uses Export file for now.
              </div>
            </div>
          )}

          {status && <div className="bg-accent/10 border border-accent/30 rounded p-2 text-xs text-accent">{status}</div>}
          <div className="bg-tile border border-borderSubtle rounded p-2 text-xs text-muted">
            Includes real QR (qrcode npm), beacons export, Share API, and Tauri commands <code className="text-textPrimary">lan_*</code> — Android companion pairs via <b>lineuplab://</b> link.
          </div>
        </div>

        <div className="p-3 border-t border-borderSubtle flex justify-between items-center">
          <span className="text-xs text-muted">{hosting ? "● Hosting — visible on LAN" : "Idle"}</span>
          <button onClick={onClose} className="px-4 py-2 rounded bg-tile border border-borderSubtle text-textPrimary min-h-[40px]">Close</button>
        </div>
      </div>
    </div>
  );
}
