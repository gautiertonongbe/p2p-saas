import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Edit, Users, Loader2, UserPlus, UserCheck, UserX, KeyRound, Copy, Mail, Shield, Building2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrateur", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "procurement_manager", label: "Resp. Achats", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "approver", label: "Approbateur", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "requester", label: "Demandeur", color: "bg-slate-100 text-slate-800 border-slate-200" },
];

function getRoleOption(role: string) {
  return ROLE_OPTIONS.find(r => r.value === role) || ROLE_OPTIONS[3];
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [tempPasswordDialog, setTempPasswordDialog] = useState<{ open: boolean; password: string; email: string }>({ open: false, password: "", email: "" });
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const { data: users = [], isLoading, refetch } = trpc.settings.listUsers.useQuery();
  const { data: departments = [] } = trpc.settings.listDepartments.useQuery();
  const { data: impersonateStatus } = trpc.impersonate.status.useQuery(undefined, { refetchOnWindowFocus: false });

  const utils = trpc.useUtils();

  const inviteUser = trpc.settings.inviteUser.useMutation({
    onSuccess: (data) => {
      setInviteOpen(false);
      setTempPasswordDialog({ open: true, password: data.tempPassword, email: inviteForm.email });
      resetInviteForm();
      utils.settings.listUsers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateUser = trpc.settings.updateUser.useMutation({
    onSuccess: () => {
      toast.success("Utilisateur mis à jour");
      setEditOpen(false);
      utils.settings.listUsers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetPassword = trpc.settings.resetUserPassword.useMutation({
    onSuccess: (data) => {
      setTempPasswordDialog({ open: true, password: data.tempPassword, email: selectedUser?.email || "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const startImpersonate = trpc.impersonate.start.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: (e) => toast.error(e.message),
  });

  const stopImpersonate = trpc.impersonate.stop.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: (e) => toast.error(e.message),
  });

  // Invite form state
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "requester", departmentId: "", approvalLimit: "" });
  const resetInviteForm = () => setInviteForm({ name: "", email: "", role: "requester", departmentId: "", approvalLimit: "" });

  // Edit form state
  const [editForm, setEditForm] = useState({ role: "", departmentId: "", approvalLimit: "", status: "active" as "active" | "disabled" });

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setEditForm({
      role: user.role || "requester",
      departmentId: user.departmentId?.toString() || "",
      approvalLimit: user.approvalLimit || "",
      status: user.status || "active",
    });
    setEditOpen(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Gestion des utilisateurs
          </h2>
          <p className="text-muted-foreground mt-1">{users.length} utilisateur{users.length > 1 ? "s" : ""} dans votre organisation</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Inviter un utilisateur
        </Button>
      </div>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          {users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Limite approbation</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: any) => {
                  const roleOpt = getRoleOption(user.role);
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={(user as any).avatarUrl} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{user.name || "Sans nom"}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${roleOpt.color} border text-xs`}>{roleOpt.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {user.departmentId
                            ? departments.find((d: any) => d.id === user.departmentId)?.name || "—"
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {user.approvalLimit
                            ? `${Number(user.approvalLimit).toLocaleString()} XOF`
                            : <span className="text-muted-foreground">Illimité</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "active" ? "default" : "secondary"} className="text-xs">
                          {user.status === "active" ? "Actif" : "Désactivé"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* Act As button */}
                          {currentUser?.role === "admin" && user.id !== currentUser?.id && (
                            impersonateStatus?.isImpersonating ? (
                              <Button variant="outline" size="sm" className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                                onClick={() => stopImpersonate.mutate()} disabled={stopImpersonate.isPending}>
                                <UserX className="h-3 w-3 mr-1" />Quitter
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                                onClick={() => startImpersonate.mutate({ targetUserId: user.id })} disabled={startImpersonate.isPending}>
                                <UserCheck className="h-3 w-3 mr-1" />Agir en tant que
                              </Button>
                            )
                          )}
                          {/* Reset password */}
                          {currentUser?.role === "admin" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              title="Réinitialiser le mot de passe"
                              onClick={() => { setSelectedUser(user); resetPassword.mutate({ userId: user.id }); }}>
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Edit */}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground font-medium">Aucun utilisateur</p>
              <p className="text-sm text-muted-foreground mt-1">Invitez des collaborateurs pour commencer</p>
              <Button className="mt-4" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />Inviter un utilisateur
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Inviter un utilisateur
            </DialogTitle>
            <DialogDescription>
              Créez un compte pour un nouveau collaborateur. Un mot de passe temporaire sera généré.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Jean Dupont" />
            </div>
            <div className="space-y-2">
              <Label>Adresse email *</Label>
              <Input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jean.dupont@entreprise.com" />
            </div>
            <div className="space-y-2">
              <Label>Rôle *</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        {r.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Département</Label>
              <Select value={inviteForm.departmentId} onValueChange={v => setInviteForm(f => ({ ...f, departmentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun département" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {departments.map((d: any) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {d.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Limite d'approbation (XOF)</Label>
              <Input type="number" value={inviteForm.approvalLimit}
                onChange={e => setInviteForm(f => ({ ...f, approvalLimit: e.target.value }))}
                placeholder="Laisser vide = illimité" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setInviteOpen(false); resetInviteForm(); }}>Annuler</Button>
            <Button onClick={() => inviteUser.mutate({
              name: inviteForm.name,
              email: inviteForm.email,
              role: inviteForm.role as any,
              departmentId: inviteForm.departmentId ? Number(inviteForm.departmentId) : undefined,
              approvalLimit: inviteForm.approvalLimit || undefined,
            })} disabled={inviteUser.isPending || !inviteForm.name || !inviteForm.email}>
              {inviteUser.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Création...</> : <>
                <UserPlus className="h-4 w-4 mr-2" />Créer et inviter
              </>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Password Dialog */}
      <Dialog open={tempPasswordDialog.open} onOpenChange={o => setTempPasswordDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <KeyRound className="h-5 w-5" />
              {selectedUser && !inviteUser.isSuccess ? "Mot de passe réinitialisé" : "Utilisateur créé avec succès"}
            </DialogTitle>
            <DialogDescription>
              Communiquez ces identifiants à {tempPasswordDialog.email} de manière sécurisée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-800">Email de connexion</p>
                <p className="font-mono text-sm font-semibold text-amber-900">{tempPasswordDialog.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-800">Mot de passe temporaire</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-lg font-bold text-amber-900 tracking-widest">{tempPasswordDialog.password}</p>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                    onClick={() => { navigator.clipboard.writeText(tempPasswordDialog.password); toast.success("Copié !"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                ⚠️ Ce mot de passe est temporaire. L'utilisateur devra le changer lors de sa première connexion via <strong>Paramètres → Mon Profil</strong>.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Lien de connexion:</p>
              <div className="flex items-center gap-2 bg-muted rounded p-2">
                <p className="font-mono text-xs flex-1 truncate">{window.location.origin}/login</p>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0"
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/login`); toast.success("Lien copié !"); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPasswordDialog(d => ({ ...d, open: false }))}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              {selectedUser?.name} — {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rôle *</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Département</Label>
              <Select value={editForm.departmentId} onValueChange={v => setEditForm(f => ({ ...f, departmentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun département" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {departments.map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Limite d'approbation (XOF)</Label>
              <Input type="number" value={editForm.approvalLimit}
                onChange={e => setEditForm(f => ({ ...f, approvalLimit: e.target.value }))}
                placeholder="Laisser vide = illimité" />
              <p className="text-xs text-muted-foreground">Montant maximum que cet utilisateur peut approuver</p>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="disabled">Désactivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={() => updateUser.mutate({
              userId: selectedUser.id,
              role: editForm.role as any,
              departmentId: editForm.departmentId ? Number(editForm.departmentId) : undefined,
              approvalLimit: editForm.approvalLimit || undefined,
              status: editForm.status,
            })} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
