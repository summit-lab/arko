"use client";

import { useChartTheme } from "@/hooks/useChartTheme";
import { SaleForm } from "./SaleForm";
import type { ReelPicker, Sale, SaleFormProps, StoryPicker } from "./SaleForm";

interface SaleFormModalProps {
  reels: ReelPicker[];
  stories: StoryPicker[];
  onClose: () => void;
  onSaved: (sale: Sale) => void;
  defaultSourceType?: SaleFormProps["defaultSourceType"];
  /** Si se pasa, el modal entra en modo edición. */
  sale?: Sale | null;
}

export function SaleFormModal({ reels, stories, onClose, onSaved, defaultSourceType, sale }: SaleFormModalProps) {
  const ct = useChartTheme();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: ct.overlayBg, backdropFilter: "blur(14px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl max-h-[90vh] flex flex-col glass-card"
        style={{
          boxShadow: "0 40px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <SaleForm
          reels={reels}
          stories={stories}
          onCancel={onClose}
          onSuccess={onSaved}
          defaultSourceType={defaultSourceType}
          sale={sale}
        />
      </div>
    </div>
  );
}
