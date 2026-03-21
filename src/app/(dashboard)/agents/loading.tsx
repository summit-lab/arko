export default function AgentsLoading() {
  return (
    <div className="p-8 h-[calc(100vh-4rem)] flex flex-col gap-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-8 w-32 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-80 rounded bg-white/[0.04] mt-3" />
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Agents Sidebar */}
        <div className="w-72 shrink-0 glass-card rounded-2xl p-4 flex flex-col">
          <div className="h-3 w-36 rounded bg-white/[0.04] mb-4 px-2" />
          <div className="space-y-2 flex-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03]">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="h-4 w-4 rounded bg-white/[0.06]" />
                  <div className="h-3.5 w-36 rounded bg-white/[0.06]" />
                </div>
                <div className="h-2.5 w-full rounded bg-white/[0.03]" />
                <div className="h-2.5 w-2/3 rounded bg-white/[0.03] mt-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 glass-card rounded-2xl flex flex-col overflow-hidden">
          <div className="flex-1 p-6 space-y-6">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-[70%] p-4 rounded-2xl bg-white/[0.06]">
                <div className="h-3 w-full rounded bg-white/[0.06]" />
                <div className="h-3 w-3/4 rounded bg-white/[0.04] mt-2" />
              </div>
            </div>
            {/* AI message */}
            <div className="flex justify-start">
              <div className="max-w-[80%]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-3.5 w-3.5 rounded bg-white/[0.06]" />
                  <div className="h-3 w-32 rounded bg-white/[0.04]" />
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] space-y-2">
                  <div className="h-3 w-full rounded bg-white/[0.04]" />
                  <div className="h-3 w-full rounded bg-white/[0.04]" />
                  <div className="h-3 w-5/6 rounded bg-white/[0.04]" />
                  <div className="h-3 w-full rounded bg-white/[0.04] mt-3" />
                  <div className="h-3 w-3/4 rounded bg-white/[0.04]" />
                </div>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/[0.05]">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-11 rounded-xl bg-white/[0.04]" />
              <div className="h-11 w-11 rounded-xl bg-white/[0.06]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
