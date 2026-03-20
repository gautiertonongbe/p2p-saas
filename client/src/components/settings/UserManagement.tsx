import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Users, Loader2, UserPlus, UserCheck, UserX } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const { data: users = [], isLoading } = trpc.settings.listUsers.useQuery();
  const { data: departments = [] } = trpc.settings.listDepartments.useQuery();
  const updateUser = trpc.settings.updateUser.useMutation();
  const utils = trpc.useUtils();

  const [createFormData, setCreateFormData] = useState({
    name: "",
    email: "",
    role: "requester" as "admin" | "procurement_manager" | "approver" | "requester",
    departmentId: "",
    approvalLimit: "",
  });

  const [editFormData, setEditFormData] = useState({
    role: "",
    departmentId: "",
    approvalLimit: "",
    status: "active" as "active" | "disabled",
  });

  const handleCreateUser = async () => {
    // Note: User creation requires OAuth flow, so we show instructions instead
    toast.info("Pour ajouter un nouvel utilisateur, invitez-le à se connecter via le portail OAuth. Une fois connecté, vous pourrez modifier son rôle ici.");
    setIsCreateDialogOpen(false);
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setEditFormData({
      role: user.role || "requester",
      departmentId: user.departmentId?.toString() || "",
      approvalLimit: user.approvalLimit || "",
      status: user.status || "active",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await updateUser.mutateAsync({
        userId: selectedUser.id,
        role: editFormData.role as any,
        departmentId: editFormData.departmentId ? parseInt(editFormData.departmentId) : undefined,
        approvalLimit: editFormData.approvalLimit || undefined,
        status: editFormData.status,
      });
      toast.success("Utilisateur mis à jour avec succès");
      setIsEditDialogOpen(false);
      utils.settings.listUsers.invalidate();
    } catch (error) {
      toast.error("Erreur lors de la mise à jour de l'utilisateur");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "procurement_manager":
        return "bg-blue-100 text-blue-800";
      case "approver":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrateur";
      case "procurement_manager":
        return "Gestionnaire des achats";
      case "approver":
        return "Approbateur";
      case "requester":
        return "Demandeur";
      default:
        return role;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Gestion des utilisateurs
          </h2>
          <p className="text-muted-foreground mt-1">
            Gérer les utilisateurs, leurs rôles et permissions
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Inviter un utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inviter un nouvel utilisateur</DialogTitle>
              <DialogDescription>
                Les utilisateurs doivent se connecter via OAuth pour accéder à la plateforme
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Instructions:</strong> Partagez le lien de connexion OAuth avec le nouvel utilisateur. 
                  Une fois qu'il se sera connecté, il apparaîtra dans cette liste et vous pourrez lui attribuer un rôle et des permissions.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Lien de connexion</Label>
                <Input
                  readOnly
                  value={window.location.origin}
                  className="bg-muted"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsCreateDialogOpen(false)}>
                Compris
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || "Sans nom"}</TableCell>
                    <TableCell>{user.email || "—"}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.departmentId ? (
                        departments.find((d: any) => d.id === user.departmentId)?.name || `Dept ${user.departmentId}`
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === "active" ? "default" : "secondary"}>
                        {user.status === "active" ? "Actif" : "Désactivé"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {currentUser?.role === "admin" && user.id !== currentUser?.id && (
                          impersonateStatus?.isImpersonating ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                              onClick={() => stopImpersonate.mutate()}
                              disabled={stopImpersonate.isPending}
                            >
                              <UserX className="h-3 w-3 mr-1" />
                              Quitter
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                              onClick={() => startImpersonate.mutate({ targetUserId: user.id })}
                              disabled={startImpersonate.isPending}
                            >
                              <UserCheck className="h-3 w-3 mr-1" />
                              Agir en tant que
                            </Button>
                          )
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Aucun utilisateur trouvé
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifier le rôle et les permissions de {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editRole">Rôle *</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value) => setEditFormData({ ...editFormData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="procurement_manager">Gestionnaire des achats</SelectItem>
                  <SelectItem value="approver">Approbateur</SelectItem>
                  <SelectItem value="requester">Demandeur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDepartment">Département</Label>
              <Select
                value={editFormData.departmentId}
                onValueChange={(value) => setEditFormData({ ...editFormData, departmentId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un département" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {departments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editApprovalLimit">Limite d'approbation (XOF)</Label>
              <Input
                id="editApprovalLimit"
                type="number"
                value={editFormData.approvalLimit}
                onChange={(e) => setEditFormData({ ...editFormData, approvalLimit: e.target.value })}
                placeholder="Ex: 1000000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editStatus">Statut *</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value: any) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="disabled">Désactivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateUser} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
