import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { UserX } from "lucide-react";

export default function ImpersonateBanner() {
  const { user } = useAuth();
  const { data: status } = trpc.impersonate.status.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const stopMutation = trpc.impersonate.stop.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  if (!status?.isImpersonating) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-2 text-sm font-medium text-white"
      style={{ backgroundColor: "#d97706" }}
    >
      <div className="flex items-center gap-2">
        <UserX className="h-4 w-4 shrink-0" />
        <span>
          Vous agissez en tant que <strong>{user?.name || user?.email}</strong> ({user?.role})
        </span>
      </div>
      <button
        onClick={() => stopMutation.mutate()}
        disabled={stopMutation.isPending}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border border-white/40 hover:bg-white/20 transition-colors disabled:opacity-60"
      >
        <UserX className="h-3.5 w-3.5" />
        {stopMutation.isPending ? "Retour..." : "Revenir à mon compte"}
      </button>
    </div>
  );
}
