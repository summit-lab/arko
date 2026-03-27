export default function AdminClientsLoading() {
  return (
    <div className="px-8 py-10 space-y-8 animate-pulse">
      <div>
        <div className="h-10 w-48 bg-white/[0.04] rounded-lg" />
        <div className="h-4 w-64 bg-white/[0.03] rounded mt-3" />
      </div>
      <div className="glass-panel rounded-xl p-6 h-[400px]" />
    </div>
  );
}
