import { useState } from "react";
import type { ValorantAgent, ValorantMap } from "../types/lineup";

type StepId = "setup" | "capture" | "pins" | "details" | "review";
const STEPS: { id: StepId; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "capture", label: "Capture" },
  { id: "pins", label: "Pins" },
  { id: "details", label: "Details" },
  { id: "review", label: "Review" },
];

export default function CreateWizard({ agents, maps }: { agents: ValorantAgent[]; maps: ValorantMap[] }) {
  const [active, setActive] = useState<StepId>("setup");
  const idx = STEPS.findIndex((s) => s.id === active);

  const toast = (msg: string) => {
    // Simple toast via custom event or alert fallback
    // We'll dispatch a transient DOM toast
    const el = document.createElement("div");
    el.textContent = msg;
    el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 bg-panel border border-borderSubtle text-textPrimary px-4 py-2 rounded-md shadow-xl z-50 text-sm";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  };

  const Content = () => {
    switch (active) {
      case "setup":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-textPrimary">Setup</h3>
            <p className="text-sm text-muted">Choose map, agent, ability for your lineup.</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-tile border border-borderSubtle p-3">
                <p className="text-xs font-semibold text-muted mb-2">Map</p>
                <select className="w-full bg-panel border border-borderSubtle rounded px-3 py-2 text-sm text-textPrimary min-h-[40px]" onChange={() => toast("Coming soon")}>
                  <option>Select map</option>
                  {maps.slice(0, 6).map((m) => <option key={m.uuid}>{m.displayName}</option>)}
                </select>
              </div>
              <div className="rounded-md bg-tile border border-borderSubtle p-3">
                <p className="text-xs font-semibold text-muted mb-2">Agent</p>
                <select className="w-full bg-panel border border-borderSubtle rounded px-3 py-2 text-sm text-textPrimary min-h-[40px]" onChange={() => toast("Coming soon")}>
                  <option>Select agent</option>
                  {agents.slice(0, 6).map((a) => <option key={a.uuid}>{a.displayName}</option>)}
                </select>
              </div>
            </div>
            <button onClick={() => toast("Coming soon")} className="w-full min-h-[48px] rounded bg-accent text-white font-bold text-[15px]">Continue to Capture</button>
          </div>
        );
      case "capture":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-textPrimary">Capture</h3>
            <p className="text-sm text-muted">Capture stand, aim and landing media (40/48px controls).</p>
            <div className="grid grid-cols-3 gap-2">
              {["Stand 1", "Aim 1", "Landing"].map((label) => (
                <button key={label} onClick={() => toast("Coming soon")} className="h-[120px] rounded-md bg-tile border-2 border-dashed border-borderSubtle flex flex-col items-center justify-center text-muted hover:bg-tileHover min-h-[48px]">
                  <span className="text-2xl">📸</span>
                  <span className="text-xs font-semibold mt-1">{label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => toast("Coming soon")} className="w-full min-h-[48px] rounded bg-accent text-white font-bold">Save captures (Coming soon)</button>
          </div>
        );
      case "pins":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-textPrimary">Pins</h3>
            <p className="text-sm text-muted">Place map pins for start, end and bounces.</p>
            <div className="h-[220px] rounded-md bg-tile border border-borderSubtle flex items-center justify-center text-muted">
              Minimap pin editor — Coming soon
            </div>
            <button onClick={() => toast("Coming soon")} className="w-full min-h-[48px] rounded bg-accent text-white font-bold">Add pin (Coming soon)</button>
          </div>
        );
      case "details":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-textPrimary">Details</h3>
            <div className="space-y-2">
              <input placeholder="Lineup title" className="w-full min-h-[48px] px-3 rounded bg-tile border border-borderSubtle text-textPrimary text-[15px]" onFocus={() => toast("Coming soon")} />
              <textarea placeholder="Notes / steps" rows={3} className="w-full px-3 py-2 rounded bg-tile border border-borderSubtle text-textPrimary text-[15px]" onFocus={() => toast("Coming soon")} />
              <div className="grid grid-cols-2 gap-2">
                <select className="min-h-[48px] px-3 rounded bg-tile border border-borderSubtle text-textPrimary" onChange={() => toast("Coming soon")}><option>Difficulty</option><option>easy</option><option>normal</option><option>hard</option></select>
                <select className="min-h-[48px] px-3 rounded bg-tile border border-borderSubtle text-textPrimary" onChange={() => toast("Coming soon")}><option>Importance</option><option>essential</option><option>useful</option><option>optional</option></select>
              </div>
            </div>
          </div>
        );
      case "review":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-textPrimary">Review</h3>
            <p className="text-sm text-muted">Review and save your lineup (mock state).</p>
            <div className="rounded-md bg-tile border border-borderSubtle p-4 text-center text-muted">
              No lineup to review yet — complete previous steps.
            </div>
            <button onClick={() => toast("Coming soon — create will save to IndexedDB in a future release")} className="w-full min-h-[48px] rounded bg-accent text-white font-bold">Save lineup (Coming soon)</button>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-pageBg">
      {/* Stepper */}
      <div className="shrink-0 border-b border-borderSubtle bg-panel p-2">
        <div className="flex items-center gap-1 overflow-auto overscroll-contain">
          {STEPS.map((s, i) => {
            const isActive = s.id === active;
            const isDone = i < idx;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full border shrink-0 min-h-[40px] ${isActive ? "bg-accent border-accent text-white" : isDone ? "bg-essential/20 border-essential text-essential" : "bg-tile border-borderSubtle text-muted"}`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? "bg-white text-accent" : isDone ? "bg-essential text-white" : "bg-borderSubtle text-muted"}`}>{i + 1}</span>
                <span className="text-xs font-semibold">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content fits viewport without scrolling page */}
      <div className="flex-1 min-h-0 overflow-auto overscroll-contain p-4">
        <div className="max-w-2xl mx-auto bg-panel border border-borderSubtle rounded-card p-4">
          <Content />
        </div>
        <div className="flex gap-2 mt-4 max-w-2xl mx-auto">
          <button disabled={idx === 0} onClick={() => setActive(STEPS[idx - 1].id)} className="flex-1 min-h-[48px] rounded bg-tile border border-borderSubtle text-textPrimary font-semibold disabled:opacity-40">Back</button>
          <button disabled={idx === STEPS.length - 1} onClick={() => setActive(STEPS[idx + 1].id)} className="flex-1 min-h-[48px] rounded bg-accent text-white font-bold disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
