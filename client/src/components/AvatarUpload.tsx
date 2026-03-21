import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Camera, Save, X } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
  currentUrl?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
  onUploaded?: (url: string) => void;
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const maxSize = 300;
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
      } else {
        if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

export function AvatarUpload({ currentUrl, name, size = "md", onUploaded }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.settings.uploadAvatar.useMutation();
  const utils = trpc.useUtils();

  const sizeMap = { sm: "h-10 w-10", md: "h-16 w-16", lg: "h-24 w-24" };
  const iconMap = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-5 w-5" };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop grande (max 5 Mo)"); return; }
    setLoading(true);
    try {
      const compressed = await compressImage(file);
      setPreview(compressed);
      setPending(compressed);
    } catch {
      toast.error("Impossible de lire l'image");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!pending) return;
    setLoading(true);
    try {
      await uploadMutation.mutateAsync({ base64: pending });
      toast.success("Photo de profil mise à jour !");
      setPending(null);
      onUploaded?.(pending);
      // Refresh auth.me so sidebar avatar updates
      utils.auth.me.invalidate();
    } catch (e: any) {
      toast.error("Erreur lors de la sauvegarde: " + (e?.message || "inconnu"));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setPending(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className="flex flex-col items-start gap-4">
      {/* Avatar + hover overlay */}
      <div className="flex items-center gap-4">
        <div className="relative inline-block group">
          <Avatar className={sizeMap[size]}>
            <AvatarImage src={displayUrl || undefined} alt={name || "Avatar"} />
            <AvatarFallback className="text-sm font-semibold" style={{ backgroundColor: "#e0e7ff", color: "#4338ca" }}>
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            title="Changer la photo"
          >
            {loading
              ? <Loader2 className={`${iconMap[size]} text-white animate-spin`} />
              : <Camera className={`${iconMap[size]} text-white`} />
            }
          </button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
        </div>

        {/* Click hint */}
        {!pending && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-sm text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            Changer la photo
          </button>
        )}
      </div>

      {/* Save / Cancel — shown below avatar when image selected */}
      {pending && (
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60 whitespace-nowrap btn-primary"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Enregistrer
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            Annuler
          </button>
          <span className="text-xs text-gray-500">Photo prête — cliquez Enregistrer</span>
        </div>
      )}

      {!pending && (
        <p className="text-xs text-gray-500">JPG, PNG, WebP · max 5 Mo</p>
      )}
    </div>
  );
}
