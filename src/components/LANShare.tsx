import { useState, useEffect } from "react";

export default function LANShare({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"host" | "join">("host");
  const [joinCode, setJoinCode] = useState("");

  // mock local IP detection (in Tauri would be via plugin, here placeholder)
  const mockIp = "192.168.1.42";
  const mockPort = "3030";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-panel border border-borderSubtle rounded-card w-full max-w-lg overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b border-borderSubtle flex items-center justify-between">
          <h3 className="text-textPrimary font-bold">LAN Share</h3>
          <button onClick={onClose} className="w-10 h-10 rounded bg-tile flex items-center justify-center text-muted">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <button onClick={()=>setMode("host")} className={`flex-1 py-2 rounded-md border font-bold text-sm ${mode==="host"?"bg-accent text-white border-accent":"bg-tile text-muted border-borderSubtle"}`}>Host</button>
            <button onClick={()=>setMode("join")} className={`flex-1 py-2 rounded-md border font-bold text-sm ${mode==="join"?"bg-accent text-white border-accent":"bg-tile text-muted border-borderSubtle"}`}>Join</button>
          </div>
          {mode==="host" ? (
            <div className="space-y-3">
              <div className="rounded-md bg-tile border border-borderSubtle p-3">
                <p className="text-xs font-bold tracking-widest text-muted mb-1">YOUR ADDRESS</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-panel border border-borderSubtle rounded px-2 py-2 text-sm text-textPrimary">{mockIp}:{mockPort}</code>
                  <button onClick={()=>{ navigator.clipboard.writeText(`${mockIp}:${mockPort}`); setCopied(true); setTimeout(()=>setCopied(false),1500); }} className="px-3 py-2 rounded bg-panel border border-borderSubtle text-xs text-textPrimary min-h-[40px]">{copied ? "Copied" : "Copy"}</button>
                </div>
                <p className="text-xs text-muted mt-2">Other players on same Wi-Fi can join via this address. (Not implemented yet — UI placeholder for upcoming LAN sync.)</p>
              </div>
              <div className="rounded-md bg-panel border border-borderSubtle p-4 flex flex-col items-center gap-2">
                <div className="w-32 h-32 bg-white rounded flex items-center justify-center text-black text-xs font-mono">QR<br />{mockIp}</div>
                <p className="text-xs text-muted">Scan to join (coming soon)</p>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded bg-accent text-white font-bold min-h-[40px] opacity-50 cursor-not-allowed" title="Not implemented">Start Host (soon)</button>
                <button className="px-4 py-2 rounded bg-tile border border-borderSubtle text-textPrimary min-h-[40px]">Settings</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-bold tracking-widest text-muted">JOIN CODE OR IP</label>
              <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="192.168.1.42:3030" className="w-full px-3 py-2 rounded-md bg-panel border border-borderSubtle text-textPrimary text-sm" />
              <button className="w-full py-2 rounded bg-accent text-white font-bold min-h-[40px] opacity-50 cursor-not-allowed" title="Not implemented">Join (soon)</button>
              <p className="text-xs text-muted text-center">LAN sharing will sync lineups & media over local network without internet. This UI is a preview — backend not implemented.</p>
            </div>
          )}
          <div className="bg-accent/10 border border-accent/30 rounded p-2 text-xs text-accent">
            <b>Note:</b> Full LAN sync requires Tauri plugin + local discovery. Currently UI only — import/export via share icon works today.
          </div>
        </div>
        <div className="p-3 border-t border-borderSubtle flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded bg-tile border border-borderSubtle text-textPrimary min-h-[40px]">Close</button>
        </div>
      </div>
    </div>
  );
}
