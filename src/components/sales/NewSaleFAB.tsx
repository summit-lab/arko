"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { SaleFormModal } from "./SaleFormModal";
import type { ReelPicker, StoryPicker } from "./SaleForm";

interface NewSaleFABProps {
  reels: ReelPicker[];
  stories: StoryPicker[];
}

export function NewSaleFAB({ reels, stories }: NewSaleFABProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSaved = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Nueva venta"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full flex items-center justify-center cursor-pointer transition-all hover:brightness-110 hover:scale-105"
        style={{
          background: "linear-gradient(180deg, rgba(122,134,224,0.95) 0%, rgba(122,134,224,0.85) 100%)",
          border: "1px solid rgba(122,134,224,0.6)",
          borderTop: "1px solid rgba(255,255,255,0.35)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 12px 32px rgba(122,134,224,0.35), 0 6px 16px rgba(0,0,0,0.4)",
        }}
      >
        <Plus className="h-6 w-6 text-white" strokeWidth={2.2} />
      </button>

      {open && (
        <SaleFormModal
          reels={reels}
          stories={stories}
          onClose={() => setOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
