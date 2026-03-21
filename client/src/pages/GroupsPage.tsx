import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
import { PageHeader } from "@/components/PageHeader";
  Users, Plus, Shield, Eye, CheckCircle, BarChart2,
  MessageSquare, Receipt, FileText, X, Loader2,
  UserPlus, UserMinus, Settings, ChevronRight, Lock,
} from "lucide-react";

const PERMISSION_LABELS: Record<string, { label: string; desc: string; icon: any }> = {
  view_documents:    { label: "Voir documents",     desc: "Accès aux PR, BC, factures confidentiels", icon: Eye },
  approve_documents: { label: "Approuver",          desc: "Approuver les documents assignés au groupe", icon: CheckCircle },
  access_expenses:   { label: "Notes de frais",     desc: "Accès au module notes de frais", icon: Receipt },
  access_community:  { label: "Communauté",         desc: "Accès au forum communautaire", icon: MessageSquare },
  access_analytics:  { label: "Analyses",           desc: "Accès aux tableaux de bord analytiques", icon: BarChart2 },
  access_reports:    { label: "Rapports",           desc: "Accès au générateur de rapports", icon: FileText },
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS);

const COLORS = [
  "#2563eb","#7c3aed","#059669","#dc2626","#d97706",
  "#0891b2","#db2777","#65a30d","#6366f1","#f97316",
];

function GroupCard({ group, onSelect, onRequestJoin }: { group: any; onSelect: () => void; onRequestJoin: () => void }) {
  const perms: string[] = (() => { try { return JSON.parse(group.permissions); } catch { return []; } })();

  return (
    <Card className="hover:shadow-md transition-all cursor-pointer" onClick={onSelect}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold"
            style={{ backgroundColor: group.color || "#2563eb" }}>
            {group.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{group.name}</p>
              {!group.isActive && <Badge variant="secondary" className="text-xs">Inactif</Badge>}
              {group.isMember && <Badge className="text-xs bg-emerald-100 text-emerald-700 border-0">Membre</Badge>}
              {group.hasPendingRequest && <Badge className="text-xs bg-amber-100 text-amber-700 border-0">En attente</Badge>}
            </div>
            {group.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{group.description}</p>}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />{group.memberCount} membre(s)
              </span>
              {group.pendingCount > 0 && (
                <span className="text-xs text-amber-600 font-medium">{group.pendingCount} demande(s)</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {perms.slice(0, 3).map(p => {
                const pl = PERMISSION_LABELS[p];
                if (!pl) return null;
                const Icon = pl.icon;
                return (
                  <span key={p} className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                    <Icon className="h-2.5 w-2.5" />{pl.label}
                  </span>
                );
              })}
              {perms.length > 3 && <span className="text-xs text-muted-foreground">+{perms.length - 3}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {!group.isMember && !group.hasPendingRequest && group.isActive && (
              <button onClick={e => { e.stopPropagation(); onRequestJoin(); }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                <UserPlus className="h-3 w-3" />Rejoindre
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GroupDetail({ groupId, onBack }: { groupId: number; onBack: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "procurement_manager";
  const utils = trpc.useUtils();
  const [addEmail, setAddEmail] = useState("");

  const { data: group, isLoading } = trpc.groups.getById.useQuery({ id: groupId });
  const { data: allUsers = [] } = trpc.settings.listUsers.useQuery();

  const addMut = trpc.groups.addMember.useMutation({
    onSuccess: () => { toast.success("Membre ajouté"); utils.groups.getById.invalidate({ id: groupId }); setAddEmail(""); },
    onError: e => toast.error(e.message),
  });
  const removeMut = trpc.groups.removeMember.useMutation({
    onSuccess: () => { toast.success("Membre retiré"); utils.groups.getById.invalidate({ id: groupId }); },
    onError: e => toast.error(e.message),
  });
  const reviewMut = trpc.groups.reviewRequest.useMutation({
    onSuccess: () => { toast.success("Demande traitée"); utils.groups.getById.invalidate({ id: groupId }); utils.groups.list.invalidate(); },
    onError: e => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!group) return null;

  const perms: string[] = (() => { try { return JSON.parse((group as any).permissions); } catch { return []; } })();
  const activeMembers = (group as any).members?.filter((m: any) => m.status === "active") || [];
  const pendingMembers = (group as any).members?.filter((m: any) => m.status === "pending") || [];

  const userToAdd = (allUsers as any[]).find((u: any) => u.email === addEmail.trim());

  return (
    <div className="space-y-4">
      <PageHeader icon={<Lock className="h-5 w-5" />} title="Groupes & Accès" description="Permissions utilisateurs" /><button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />Fermer
      </button>

      {/* Group header */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-xl font-black"
              style={{ backgroundColor: (group as any).color }}>
              {(group as any).name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold">{(group as any).name}</h2>
              {(group as any).description && <p className="text-sm text-muted-foreground">{(group as any).description}</p>}
              <p className="text-xs text-muted-foreground mt-1">Créé par {(group as any).createdByName}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" />Permissions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_PERMISSIONS.map(p => {
              const pl = PERMISSION_LABELS[p];
              const Icon = pl.icon;
              const active = perms.includes(p);
              return (
                <div key={p} className={`flex items-center gap-3 p-2.5 rounded-lg border ${active ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100 opacity-50"}`}>
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-emerald-600" : "text-gray-400"}`} />
                  <div>
                    <p className={`text-sm font-medium ${active ? "text-emerald-800" : "text-gray-500"}`}>{pl.label}</p>
                    <p className="text-xs text-muted-foreground">{pl.desc}</p>
                  </div>
                  {active && <CheckCircle className="h-4 w-4 text-emerald-500 ml-auto shrink-0" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pending requests */}
      {isAdmin && pendingMembers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3"><CardTitle className="text-sm text-amber-800">{pendingMembers.length} demande(s) d'adhésion</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pendingMembers.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200">
                <div>
                  <p className="text-sm font-medium">{m.userName}</p>
                  <p className="text-xs text-muted-foreground">{m.userEmail}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reviewMut.mutate({ groupId, userId: m.userId, action: "approve" })}
                    className="px-2 py-1 bg-emerald-600 text-white text-xs rounded font-medium hover:bg-emerald-700">
                    Accepter
                  </button>
                  <button onClick={() => reviewMut.mutate({ groupId, userId: m.userId, action: "reject" })}
                    className="px-2 py-1 border border-red-300 text-red-600 text-xs rounded hover:bg-red-50">
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />{activeMembers.length} membre(s)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add member */}
          {isAdmin && (
            <div className="flex gap-2 pb-3 border-b">
              <Input value={addEmail} onChange={e => setAddEmail(e.target.value)}
                placeholder="Email de l'utilisateur à ajouter..." className="text-sm" />
              <button
                onClick={() => userToAdd && addMut.mutate({ groupId, userId: userToAdd.id })}
                disabled={!userToAdd || addMut.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white btn-primary disabled:opacity-50 shrink-0">
                <UserPlus className="h-4 w-4" />Ajouter
              </button>
            </div>
          )}
          {activeMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun membre actif</p>
          ) : (
            activeMembers.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                    {(m.userName || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.userName}</p>
                    <p className="text-xs text-muted-foreground">{m.userEmail} · {m.role === "admin" ? "Admin groupe" : "Membre"}</p>
                  </div>
                </div>
                {isAdmin && m.userId !== user?.id && (
                  <button onClick={() => removeMut.mutate({ groupId, userId: m.userId })}
                    className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50">
                    <UserMinus className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function GroupsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "procurement_manager";
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "", color: "#2563eb", permissions: [] as string[] });

  const { data: groups = [], isLoading } = trpc.groups.list.useQuery();
  const { data: myGroups = [] } = trpc.groups.myGroups.useQuery();
  const { data: myPerms = [] } = trpc.groups.myPermissions.useQuery();

  const createMut = trpc.groups.create.useMutation({
    onSuccess: () => { toast.success("Groupe créé !"); utils.groups.list.invalidate(); setShowCreate(false); setNewGroup({ name: "", description: "", color: "#2563eb", permissions: [] }); },
    onError: e => toast.error(e.message),
  });
  const requestMut = trpc.groups.requestJoin.useMutation({
    onSuccess: () => { toast.success("Demande envoyée !"); utils.groups.list.invalidate(); },
    onError: e => toast.error(e.message),
  });

  if (selectedId) {
    return (
      <div className="max-w-3xl mx-auto pb-8">
        <GroupDetail groupId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Lock className="h-6 w-6 text-blue-600" />Groupes & Accès</h1>
          <p className="text-sm text-muted-foreground">Contrôlez qui peut voir et faire quoi sur la plateforme</p>
        </div>
        {isAdmin && !showCreate && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold btn-primary">
            <Plus className="h-4 w-4" />Nouveau groupe
          </button>
        )}
      </div>

      {/* My permissions banner */}
      {(myPerms as string[]).length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1"><Shield className="h-3.5 w-3.5" />Vos permissions actuelles</p>
            <div className="flex flex-wrap gap-1">
              {(myPerms as string[]).map(p => {
                const pl = PERMISSION_LABELS[p];
                if (!pl) return null;
                const Icon = pl.icon;
                return (
                  <span key={p} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    <Icon className="h-3 w-3" />{pl.label}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showCreate && (
        <Card className="border-2 border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Créer un groupe</CardTitle>
              <button onClick={() => setShowCreate(false)}><X className="h-4 w-4" /></button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nom du groupe *</Label>
                <Input value={newGroup.name} onChange={e => setNewGroup(g => ({...g, name: e.target.value}))} placeholder="Ex: Équipe Finance, Acheteurs IT" />
              </div>
              <div className="space-y-1.5">
                <Label>Couleur</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(color => (
                    <button key={color} onClick={() => setNewGroup(g => ({...g, color}))}
                      className={`h-7 w-7 rounded-full transition-transform ${newGroup.color === color ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={newGroup.description} onChange={e => setNewGroup(g => ({...g, description: e.target.value}))} rows={2} placeholder="Décrivez le rôle de ce groupe..." />
            </div>
            <div className="space-y-2">
              <Label>Permissions du groupe</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map(p => {
                  const pl = PERMISSION_LABELS[p];
                  const Icon = pl.icon;
                  const checked = newGroup.permissions.includes(p);
                  return (
                    <label key={p} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${checked ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50"}`}>
                      <input type="checkbox" checked={checked}
                        onChange={e => setNewGroup(g => ({...g, permissions: e.target.checked ? [...g.permissions, p] : g.permissions.filter(x => x !== p)}))} />
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div><p className="text-sm font-medium">{pl.label}</p><p className="text-xs text-muted-foreground">{pl.desc}</p></div>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={() => createMut.mutate({ name: newGroup.name, description: newGroup.description || undefined, color: newGroup.color, permissions: newGroup.permissions as any })}
                disabled={!newGroup.name.trim() || newGroup.permissions.length === 0 || createMut.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white btn-primary disabled:opacity-50">
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Créer le groupe
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (groups as any[]).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Lock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">Aucun groupe créé</p>
            <p className="text-sm text-muted-foreground mt-1">Les groupes permettent de contrôler l'accès aux modules et documents</p>
            {isAdmin && <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 rounded-lg text-sm btn-primary text-white">Créer le premier groupe</button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(groups as any[]).map(group => (
            <GroupCard key={group.id} group={group}
              onSelect={() => setSelectedId(group.id)}
              onRequestJoin={() => requestMut.mutate({ groupId: group.id })} />
          ))}
        </div>
      )}
    </div>
  );
}
