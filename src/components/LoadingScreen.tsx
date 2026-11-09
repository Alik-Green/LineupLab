export default function LoadingScreen({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  if (error) {
    return (
      <div className="min-h-screen bg-pageBg flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-accent/20 border border-accent flex items-center justify-center text-accent mb-4">!</div>
        <h2 className="text-textPrimary font-bold text-lg">Failed to load game data</h2>
        <p className="text-muted text-sm mt-2 max-w-md">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-4 px-5 py-2 rounded bg-accent text-white font-bold min-h-[44px]">
            Retry
          </button>
        )}
        <p className="text-muted text-xs mt-3">Check your connection. The app will use cached data if available.</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-pageBg flex flex-col items-center justify-center p-6">
      <div className="w-10 h-10 rounded-full border-4 border-tile border-t-accent animate-spin" />
      <p className="text-textPrimary font-semibold mt-4">Downloading game data…</p>
      <p className="text-muted text-sm mt-1">Fetching agents and maps from valorant-api.com</p>
      <div className="mt-4 w-48 h-1.5 bg-panel rounded-full overflow-hidden">
        <div className="h-full bg-accent animate-pulse w-[60%]" />
      </div>
    </div>
  );
}
