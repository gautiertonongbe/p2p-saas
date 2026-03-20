import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, UserX, ChevronDown } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ImpersonateBanner() {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: status } = trpc.impersonate.status.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data: userList } = trpc.impersonate.listUsers.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchOnWindowFocus: false,
  });

  const startMutation = trpc.impersonate.start.useMutation({
    onSuccess: () => { window.location.href = "/"; }
  });

  const stopMutation = trpc.impersonate.stop.useMutation({
    onSuccess: () => { window.location.href = "/"; }
  });

  if (!user) return null;

  // Show "stop impersonating" banner when impersonating
  if (status?.isImpersonating) {
    return (
      <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          <span>Mode "Agir en tant que" actif — vous agissez en tant que <strong>{user.name || user.email}</strong> ({user.role})</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="bg-white text-amber-600 border-white hover:bg-amber-50 h-7 text-xs"
          onClick={() => stopMutation.mutate()}
          disabled={stopMutation.isPending}
        >
          <UserX className="h-3 w-3 mr-1" />
          Revenir à mon compte
        </Button>
      </div>
    );
  }

  // Show "act as" selector for admins
  if (user.role !== "admin") return null;

  return (
    <div className="bg-slate-700 text-white px-4 py-1.5 flex items-center gap-3 text-sm">
      <UserCheck className="h-4 w-4 text-slate-300 shrink-0" />
      <span className="text-slate-300 text-xs shrink-0">Agir en tant que:</span>
      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
        <SelectTrigger className="h-7 text-xs bg-slate-600 border-slate-500 text-white w-56">
          <SelectValue placeholder="Sélectionner un utilisateur..." />
        </SelectTrigger>
        <SelectContent>
          {userList?.map(u => (
            <SelectItem key={u.id} value={String(u.id)}>
              {u.name || u.email} — {u.role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        className="h-7 text-xs bg-amber-500 hover:bg-amber-600 border-0"
        disabled={!selectedUserId || startMutation.isPending}
        onClick={() => selectedUserId && startMutation.mutate({ targetUserId: Number(selectedUserId) })}
      >
        {startMutation.isPending ? "..." : "Basculer"}
      </Button>
    </div>
  );
}
