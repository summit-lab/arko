"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteClientAccount } from "./actions";

interface DeleteClientAccountProps {
  userId: string;
  email: string;
}

/**
 * Zona de peligro del detalle de cliente: elimina la cuenta y toda su data.
 * Para confirmar hay que escribir el email exacto del cliente.
 */
export function DeleteClientAccount({ userId, email }: DeleteClientAccountProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  function handleDelete() {
    if (!matches || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteClientAccount(userId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/clients");
      router.refresh();
    });
  }

  return (
    <div className="glass-card px-5 py-4 border border-red-500/15">
      <div className="flex items-center gap-2 mb-2">
        <Trash2 size={14} className="text-red-400" />
        <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium">Eliminar cuenta</p>
      </div>
      <p className="text-[11px] text-white/35 leading-relaxed">
        Borra el usuario, su workspace y toda su data (ADN, contenido, conexiones, uso). No se puede deshacer.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 h-7 px-3 rounded-md text-[11px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer"
        >
          Eliminar cuenta
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-white/40">
            Escribí <span className="text-white/70">{email}</span> para confirmar:
          </p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={isPending}
            autoFocus
            className="w-full h-8 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/80 outline-none focus:border-red-400/40"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!matches || isPending}
              className="h-7 px-3 rounded-md text-[11px] font-medium text-white bg-red-500/70 hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Eliminar definitivamente
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setTyped(""); setError(null); }}
              disabled={isPending}
              className="h-7 px-3 rounded-md text-[11px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error ? <p className="text-[10px] text-red-400/80 mt-2">{error}</p> : null}
    </div>
  );
}
