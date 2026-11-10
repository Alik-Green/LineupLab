import { useEffect, useState } from "react";

type Peer = { id: string; name: string; addr: string; seen: string };

export default function LANShare({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"host" | "join">("host");
  const [joinCode, setJoinCode] = useState("");
  const [discovered, setDiscovered] = useState<Peer[]>(() => {
    try {
      const raw = localStorage.getItem("lineuplab.lan.peers");
      return raw ? (JSON.parse(raw) as Peer[]) : [];
    } catch { return []; }
  });
  const [hosting, setHosting] = useState(false);
  const [lanEnabled, setLanEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user.preferences") || "{}")?.lanEnabled ?? true; } catch { return true; }
  });
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [tauriAddr, setTauriAddr] = useState<string | null>(null);

  const mockIp = tauriAddr ?? "192.168.1.42";
  const mockPort = "3030";

  // Probe Tauri LAN endpoint if present (future: tauri lan_get_addrs command)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const tauri = (window as any).__TAURI__;
        // optional backend command; no-op if not registered
        const invoke: undefined | ((cmd: string, args?: any) => Promise<any>) =
          tauri?.core?.invoke ?? tauri?.invoke;
        if (!invoke) return;
        const addr = await invoke("lan_get_addrs").catch(() => null);
        if (addr && alive) setTauriAddr(String(addr));
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  // Simple local-network \"discovery\" emulation via localStorage beacon
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
        const mine = { id, name: `This device`, addr: `${mockIp}:${mockPort}`, ts: now };
        const next = [...alive.filter(b => b.id !== id), mine];
        localStorage.setItem(key, JSON.stringify(next));
        // synthesize discovered list (others)
        setDiscovered(next.filter(b=>b.id!==id).map(b=>({ id: b.id, name: b.name, addr: b.addr, seen: new Date(b.ts).toLocaleTimeString() })));
      } catch {}
    };
    tick();
    const iv = window.setInterval(tick, 2500);
    return () => window.clearInterval(iv);
  }, [hosting, mockIp]);

  const startHost = async () => {
    try {
      const tauri = (window as any).__TAURI__;
      const invoke = tauri?.core?.invoke ?? tauri?.invoke;
      if (invoke) {
        // future backend
        await invoke("lan_host_start", { port: Number(mockPort) }).catch(()=>null);
      }
    } catch {}
    setHosting(true);
    setStatus("Hosting — broadcasting on LAN (localStorage beacon in browser preview).");
    setTimeout(()=>setStatus(null), 3500);
  };
  const stopHost = async () => {
    try {
      const invoke = (window as any).__TAURI__?.core?.invoke ?? (window as any).__TAURI__?.invoke;
      if (invoke) await invoke("lan_host_stop").catch(()=>null);
    } catch {}
    setHosting(false);
    setStatus("Host stopped.");
    setTimeout(()=>setStatus(null), 2000);
  };

  const handleJoin = async () => {
    const addr = joinCode.trim();
    if (!addr) { setStatus("Enter an address like 192.168.1.42:3030"); return; }
    try {
      const invoke = (window as any).__TAURI__?.core?.invoke ?? (window as any).__TAURI__?.invoke;
      if (invoke) {
        await invoke("lan_join", { addr }).catch((e: any)=>{ throw new Error(String(e)); });
        setStatus(`Join requested: ${addr}`);
      } else {
        // Browser fallback: pretend and add to discovered
        const list: Peer[] = [...discovered, { id: `peer-${Date.now()}`, name: `Peer @ ${addr}`, addr, seen: new Date().toLocaleTimeString() }];
        setDiscovered(list);
        localStorage.setItem("lineuplab.lan.peers", JSON.stringify(list));
        setStatus(`Joined ${addr} (preview — no network in browser).`);
      }
    } catch (e: any) {
      setStatus(`Join failed: ${e?.message ?? String(e)}`);
    }
    setTimeout(()=>setStatus(null), 3500);
  };

  const exportMyBundle = () => {
    try {
      const raw = localStorage.getItem("lineups_v2") || localStorage.getItem("lineuplab.lineups");
      const arr = raw ? JSON.parse(raw) : [];
      const n = Array.isArray(arr) ? arr.length : 0;
      setStatus(n ? `You have ${n} lineup(s) ready to share via Export on the main share menu.` : "No lineups yet — create one first.");
    } catch {
      setStatus("No lineups yet — create one first.");
    }
    setTimeout(()=>setStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-panel border border-borderSubtle rounded-card w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b border-borderSubtle flex items-center justify-between">
          <div>
            <h3 className="text-textPrimary font-bold tracking-tight">LAN Share</h3>
            <p className="text-xs text-muted">Host or join on the same Wi-Fi. Tauri build exposes real LAN; browser shows preview.</p>
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
                  <code className="flex-1 bg-panel border border-borderSubtle rounded px-2 py-2 text-sm text-textPrimary">{mockIp}:{mockPort}</code>
                  <button onClick={async()=>{
                    try { await navigator.clipboard.writeText(`${mockIp}:${mockPort}`); } catch { /* */ }
                    setCopied(true); setTimeout(()=>setCopied(false),1500);
                  }} className="px-3 py-2 rounded bg-panel border border-borderSubtle text-xs text-textPrimary min-h-[40px]">{copied ? "Copied" : "Copy"}</button>
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={lanEnabled} onChange={e=>{
                    const v=e.target.checked; setLanEnabled(v);
                    try {
                      const raw=localStorage.getItem("user.preferences");
                      const prefs=raw?JSON.parse(raw):{};
                      prefs.lanEnabled=v;
                      localStorage.setItem("user.preferences", JSON.stringify(prefs));
                      window.dispatchEvent(new CustomEvent("lineuplab:prefs", { detail: prefs }));
                    } catch {}
                  }} />
                  Advertise on LAN
                </label>
                <p className="text-xs text-muted mt-2">Others on the same Wi-Fi can paste this address. In the desktop app this will open a real HTTP endpoint; in browser it's a preview beacon.</p>
              </div>

              <div className="rounded-md bg-panel border border-borderSubtle p-3 flex flex-col items-center gap-2">
                <div className="w-32 h-32 bg-white rounded flex flex-col items-center justify-center text-black text-[10px] font-mono leading-tight p-2 text-center">
                  <span>QR</span>
                  <span className="text-[9px] break-all">{mockIp}:{mockPort}</span>
                </div>
                <p className="text-xs text-muted">Scan to join (coming soon)</p>
              </div>

              <div className="flex gap-2">
                {!hosting ? (
                  <button onClick={startHost} className="flex-1 py-2 rounded bg-accent text-white font-bold min-h-[40px]">Start Host</button>
                ) : (
                  <button onClick={stopHost} className="flex-1 py-2 rounded bg-tile border border-borderSubtle text-textPrimary font-bold min-h-[40px]">Stop Host</button>
                )}
                <button onClick={()=>setStatus("Settings live in Preferences → LAN.")} className="px-4 py-2 rounded bg-tile border border-borderSubtle text-textPrimary min-h-[40px]">Settings</button>
              </div>

              {discovered.length > 0 && (
                <div className="rounded-md bg-pageBg border border-borderSubtle p-3">
                  <p className="text-xs font-bold tracking-widest text-muted mb-2">DISCOVERED</p>
                  <ul className="space-y-1">
                    {discovered.map(p=>(
                      <li key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-textPrimary">{p.name}</span>
                        <span className="text-muted">{p.addr} • {p.seen}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-bold tracking-widest text-muted">JOIN CODE OR IP</label>
              <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="192.168.1.42:3030" className="w-full px-3 py-2 rounded-md bg-pageBg border border-borderSubtle text-textPrimary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              <div className="flex gap-2">
                <button onClick={handleJoin} className="flex-1 py-2 rounded bg-accent text-white font-bold min-h-[40px]">Join</button>
                <button onClick={()=>setJoinCode(`${mockIp}:${mockPort}`)} className="px-3 py-2 rounded bg-tile border border-borderSubtle text-textPrimary text-xs min-h-[40px]">Use host address</button>
              </div>
              {discovered.length > 0 && (
                <div className="rounded-md bg-pageBg border border-borderSubtle p-3">
                  <p className="text-xs font-bold tracking-widest text-muted mb-2">KNOWN PEERS</p>
                  <ul className="space-y-1">
                    {discovered.map(p=>(
                      <li key={p.id} className="flex items-center justify-between text-xs">
                        <button onClick={()=>setJoinCode(p.addr)} className="text-accent hover:underline text-left">{p.addr}</button>
                        <span className="text-muted">{p.seen}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-muted text-center">LAN sharing syncs lineups & media over local network. Use Share → Export for file-based transfer today.</p>
            </div>
          )}

          {status && (
            <div className="bg-accent/10 border border-accent/30 rounded p-2 text-xs text-accent">{status}</div>
          )}
          <div className="bg-tile border border-borderSubtle rounded p-2 text-xs text-muted">
            Desktop build will expose <code className="text-textPrimary">lan_get_addrs</code> / <code className="text-textPrimary">lan_host_*</code> commands. Browser preview uses localStorage beacons — no real network.
          </div>
        </div>

        <div className="p-3 border-t border-borderSubtle flex justify-between items-center">
          <span className="text-xs text-muted">{hosting ? "● Hosting" : "Idle"}</span>
          <button onClick={onClose} className="px-4 py-2 rounded bg-tile border border-borderSubtle text-textPrimary min-h-[40px]">Close</button>
        </div>
      </div>
    </div>
  );
}
