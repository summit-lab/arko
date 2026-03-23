export default function SettingsLoading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-32 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-60 rounded bg-white/[0.04] mt-3" />
      </div>

      <div className="glass-card rounded-xl p-6 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded bg-white/[0.06]" />
            <div className="h-10 w-full rounded-lg bg-white/[0.04]" />
          </div>
        ))}
        <div className="h-10 w-32 rounded-lg bg-white/[0.06]" />
      </div>
    </div>
  );
}
