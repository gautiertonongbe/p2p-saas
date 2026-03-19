import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, GitBranch, Loader2 } from "lucide-react";

export function DepartmentManagement() {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<any>(null);

  const { data: departments = [], isLoading } = trpc.settings.listDepartments.useQuery();
  const createDepartment = trpc.settings.createDepartment.useMutation();
  const updateDepartment = trpc.settings.updateDepartment.useMutation();
  const utils = trpc.useUtils();

  const [createFormData, setCreateFormData] = useState({
    code: "",
    name: "",
  });

  const [editFormData, setEditFormData] = useState({
    code: "",
    name: "",
    isActive: true,
  });

  const handleCreateDepartment = async () => {
    try {
      await createDepartment.mutateAsync(createFormData);
      toast.success("Département créé avec succès");
      setIsCreateDialogOpen(false);
      setCreateFormData({ code: "", name: "" });
      utils.settings.listDepartments.invalidate();
    } catch (error) {
      toast.error("Erreur lors de la création du département");
    }
  };

  const handleEditDepartment = (dept: any) => {
    setSelectedDepartment(dept);
    setEditFormData({
      code: dept.code,
      name: dept.name,
      isActive: dept.isActive ?? true,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateDepartment = async () => {
    if (!selectedDepartment) return;
    try {
      await updateDepartment.mutateAsync({
        id: selectedDepartment.id,
        ...editFormData,
      });
      toast.success("Département mis à jour avec succès");
      setIsEditDialogOpen(false);
      utils.settings.listDepartments.invalidate();
    } catch (error) {
      toast.error("Erreur lors de la mise à jour du département");
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
            <GitBranch className="h-6 w-6" />
            Gestion des départements
          </h2>
          <p className="text-muted-foreground mt-1">
            Gérer les départements et leur structure organisationnelle
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau département
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un département</DialogTitle>
              <DialogDescription>
                Ajouter un nouveau département à votre organisation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="createCode">Code du département *</Label>
                <Input
                  id="createCode"
                  value={createFormData.code}
                  onChange={(e) => setCreateFormData({ ...createFormData, code: e.target.value.toUpperCase() })}
                  placeholder="Ex: FIN, OPS, IT"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="createName">Nom du département *</Label>
                <Input
                  id="createName"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  placeholder="Ex: Finance, Opérations, Informatique"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleCreateDepartment}
                disabled={!createFormData.code || !createFormData.name || createDepartment.isPending}
              >
                {createDepartment.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {departments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept: any) => (
                  <TableRow key={dept.id}>
                    <TableCell>
                      <span className="font-mono font-semibold">{dept.code}</span>
                    </TableCell>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>
                      <Badge variant={dept.isActive ? "default" : "secondary"}>
                        {dept.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditDepartment(dept)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-4">
                Aucun département trouvé
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer le premier département
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Department Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le département</DialogTitle>
            <DialogDescription>
              Modifier les informations de {selectedDepartment?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editCode">Code du département *</Label>
              <Input
                id="editCode"
                value={editFormData.code}
                onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value.toUpperCase() })}
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editName">Nom du département *</Label>
              <Input
                id="editName"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={editFormData.isActive}
                onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="editIsActive" className="cursor-pointer">
                Département actif
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateDepartment} disabled={updateDepartment.isPending}>
              {updateDepartment.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
