export function App({ platform }: { platform: 'desktop' | 'mobile' }) {
  return <main className="min-h-screen bg-slate-950 p-10 text-slate-100"><h1 className="text-3xl font-bold">LineupLab</h1><p className="mt-3 text-slate-400">{platform} · Your next round, rehearsed.</p></main>;
}
