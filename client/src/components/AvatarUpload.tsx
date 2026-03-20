import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, X } from "lucide-react";
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

export function AvatarUpload({ currentUrl, name, size = "md", onUploaded }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.settings.uploadAvatar.useMutation();

  const sizeMap = { sm: "h-10 w-10", md: "h-16 w-16", lg: "h-24 w-24" };
  const iconSize = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-5 w-5" };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image trop grande. Maximum 2 Mo.");
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPreview(base64);
      try {
        await uploadMutation.mutateAsync({ base64 });
        toast.success("Photo de profil mise à jour !");
        onUploaded?.(base64);
      } catch {
        toast.error("Erreur lors du téléchargement");
        setPreview(null);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const displayUrl = preview || currentUrl;

  return (
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
  );
}
