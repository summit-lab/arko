"use client";

import { useState, useRef, useTransition } from "react";
import { Upload, X, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateLogoUrl } from "@/app/(dashboard)/settings/actions";

interface LogoUploadProps {
  workspaceId: string;
  currentLogoUrl: string | null;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export function LogoUpload({ workspaceId, currentLogoUrl }: LogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(file: File): string | null {
    if (!ACCEPTED.includes(file.type)) return "Solo PNG, JPG, WebP o SVG.";
    if (file.size > MAX_SIZE) return "El archivo debe pesar menos de 2MB.";
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSuccess(false);

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    // Upload
    startUpload(async () => {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${workspaceId}/logo.${ext}`;

      // Remove old logo files first (different extensions)
      const { data: existing } = await supabase.storage
        .from("workspace-logos")
        .list(workspaceId);

      if (existing && existing.length > 0) {
        const toDelete = existing.map((f) => `${workspaceId}/${f.name}`);
        await supabase.storage.from("workspace-logos").remove(toDelete);
      }

      const { error: uploadError } = await supabase.storage
        .from("workspace-logos")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setError("Error al subir el logo. Intentá de nuevo.");
        setPreview(currentLogoUrl);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("workspace-logos")
        .getPublicUrl(path);

      // Add cache-buster so sidebar updates
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      // Persist to DB
      await updateLogoUrl(publicUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleRemove() {
    setError(null);
    setSuccess(false);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";

    startUpload(async () => {
      const supabase = createClient();
      const { data: existing } = await supabase.storage
        .from("workspace-logos")
        .list(workspaceId);

      if (existing && existing.length > 0) {
        const toDelete = existing.map((f) => `${workspaceId}/${f.name}`);
        await supabase.storage.from("workspace-logos").remove(toDelete);
      }

      await updateLogoUrl(null);
    });
  }

  return (
    <div className="space-y-3">
      <label className="block text-[10px] text-muted-foreground uppercase tracking-wider">
        Logo del workspace
      </label>

      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="relative shrink-0">
          {preview ? (
            <div className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Logo preview"
                className="w-16 h-16 rounded-xl object-cover border border-white/[0.08]"
              />
              <button
                type="button"
                onClick={handleRemove}
                disabled={isUploading}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] flex items-center justify-center">
              <Upload className="h-5 w-5 text-white/15" />
            </div>
          )}
        </div>

        {/* Drop zone / file input */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            flex-1 rounded-xl border border-dashed px-4 py-4 text-center cursor-pointer transition-all
            ${isDragging
              ? "border-violet-400/40 bg-violet-500/[0.06]"
              : "border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.16]"
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.svg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {isUploading ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <Loader2 className="h-4 w-4 text-white/40 animate-spin" />
              <span className="text-[12px] text-white/40">Subiendo...</span>
            </div>
          ) : success ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <Check className="h-4 w-4 text-emerald-400" />
              <span className="text-[12px] text-emerald-400">Logo actualizado</span>
            </div>
          ) : (
            <>
              <p className="text-[12px] text-white/40">
                Arrastrá una imagen o <span className="text-white/60 underline underline-offset-2">elegí un archivo</span>
              </p>
              <p className="text-[10px] text-white/20 mt-1">PNG, JPG, WebP o SVG · Máx 2MB</p>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-red-400/80">{error}</p>
      )}
    </div>
  );
}
