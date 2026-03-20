import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Save, X } from "lucide-react";
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

// Compress image to max 200KB base64
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const maxSize = 256;
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
      } else {
        if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function AvatarUpload({ currentUrl, name, size = "md", onUploaded }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.settings.uploadAvatar.useMutation();

  const sizeMap = { sm: "h-10 w-10", md: "h-16 w-16", lg: "h-24 w-24" };
  const iconSize = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-5 w-5" };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop grande. Maximum 5 Mo.");
      return;
    }

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      setPreview(compressed);
      setPendingBase64(compressed);
    } catch {
      toast.error("Impossible de lire l'image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!pendingBase64) return;
    setUploading(true);
    try {
      await uploadMutation.mutateAsync({ base64: pendingBase64 });
      toast.success("Photo de profil mise à jour !");
      onUploaded?.(pendingBase64);
      setPendingBase64(null);
    } catch (e: any) {
      toast.error("Erreur: " + (e?.message || "Échec du téléchargement"));
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setPendingBase64(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative inline-block group">
        <Avatar className={sizeMap[size]}>
          <AvatarImage src={displayUrl || undefined} alt={name || "Avatar"} />
          <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          title="Changer la photo"
        >
          {uploading
            ? <Loader2 className={`${iconSize[size]} text-white animate-spin`} />
            : <Camera className={`${iconSize[size]} text-white`} />
          }
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Save / Cancel buttons when image is selected */}
      {pendingBase64 && (
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={uploading} className="gap-1">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Enregistrer
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={uploading} className="gap-1">
            <X className="h-3 w-3" />
            Annuler
          </Button>
        </div>
      )}

      {!pendingBase64 && (
        <p className="text-xs text-muted-foreground text-center">
          Survolez et cliquez pour changer<br/>JPG, PNG, WebP · max 5 Mo
        </p>
      )}
    </div>
  );
}
