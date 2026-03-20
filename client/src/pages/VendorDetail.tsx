import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Building2, Phone, Mail, Globe, FileText,
  TrendingUp, ShoppingCart, CheckCircle2, XCircle, Edit,
  Shield, Plus, Calendar, DollarSign, CreditCard, Smartphone,
  PenLine, UserPlus} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { EntityHistory } from "@/components/EntityHistory";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

const formatDate = (date: string | Date | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
};

export default function VendorDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const sendForSignatureMut = trpc.esignature.sendForSignature.useMutation({
    onSuccess: (data) => { toast.success(data.message); setSignatureDialogOpen(false); utils.vendors.getById.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const inviteVendorUserMut = trpc.supplierPortal.inviteVendorUser.useMutation({
    onSuccess: (data) => { toast.success(`Accès créé ! Mot de passe temporaire: ${data.tempPassword}`); setInviteVendorOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [inviteVendorOpen, setInviteVendorOpen] = useState(false);
  const [vendorInviteForm, setVendorInviteForm] = useState({ name: "", email: "" });
  const [signatories, setSignatories] = useState([{ name: "", email: "", role: "" }]);
  const [deactivateReason, setDeactivateReason] = useState("");

  // Contract form state
  const [contractNumber, setContractNumber] = useState("");
  const [contractTitle, setContractTitle] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractValue, setContractValue] = useState("");

  const numericId = parseInt(id!);

  const { data: vendor, isLoading } = trpc.vendors.getById.useQuery(
    { id: numericId },
    { enabled: !!id }
  );

  const { data: metrics } = trpc.vendors.getPerformanceMetrics.useQuery(
    { vendorId: numericId },
    { enabled: !!id }
  );

  const { data: history, isLoading: historyLoading } = trpc.settings.getEntityHistory.useQuery(
    { entityType: "vendor", entityId: numericId },
    { enabled: !!id }
  );

  const canManage = user?.role === "admin" || user?.role === "procurement_manager";

  const approveMutation = trpc.vendors.approve.useMutation({
    onSuccess: () => {
      toast.success("Fournisseur approuvé et activé avec succès");
      utils.vendors.getById.invalidate({ id: numericId });
      utils.vendors.list.invalidate();
      setApproveDialogOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const deactivateMutation = trpc.vendors.deactivate.useMutation({
    onSuccess: () => {
      toast.success("Fournisseur désactivé");
      utils.vendors.getById.invalidate({ id: numericId });
      utils.vendors.list.invalidate();
      setDeactivateDialogOpen(false);
      setDeactivateReason("");
    },
    onError: (error) => toast.error(error.message),
  });

  const addContractMutation = trpc.vendors.addContract.useMutation({
    onSuccess: () => {
      toast.success("Contrat ajouté avec succès");
      utils.vendors.getById.invalidate({ id: numericId });
      setContractDialogOpen(false);
      setContractNumber("");
      setContractTitle("");
      setContractStartDate("");
      setContractEndDate("");
      setContractValue("");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleAddContract = () => {
    if (!contractNumber.trim() || !contractTitle.trim() || !contractStartDate) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }
    addContractMutation.mutate({
      vendorId: numericId,
      contractNumber,
      title: contractTitle,
      startDate: contractStartDate,
      endDate: contractEndDate || undefined,
      totalValue: contractValue ? parseFloat(contractValue) : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground/50" />
        <p className="text-muted-foreground">Fournisseur introuvable</p>
        <Button onClick={() => setLocation("/vendors")} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux fournisseurs
        </Button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-200",
    inactive: "bg-gray-100 text-gray-700 border-gray-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  };

  const statusLabels: Record<string, string> = {
    active: "Actif",
    inactive: "Inactif",
    pending: "En attente",
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => setLocation("/vendors")} variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{vendor.legalName}</h1>
            {vendor.tradeName && (
              <p className="text-muted-foreground mt-1">{vendor.tradeName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[vendor.status]}`}>
            {statusLabels[vendor.status]}
          </span>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/vendors/${id}/edit`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Commandes totales</p>
                <p className="text-2xl font-bold">{metrics?.totalOrders ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dépenses totales</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.totalSpend ?? 0)}</p>
                <p className="text-xs text-muted-foreground">XOF</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Score performance</p>
                <p className="text-2xl font-bold">
                  {metrics?.performanceScore != null
                    ? `${metrics.performanceScore}/100`
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Livraisons à temps</p>
                <p className="text-2xl font-bold">{metrics?.onTimeDeliveryRate ?? 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* On-time delivery progress bar */}
      {(metrics?.onTimeDeliveryRate ?? 0) > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taux de livraison à temps</span>
                <span className="font-medium">{metrics?.onTimeDeliveryRate}%</span>
              </div>
              <Progress value={metrics?.onTimeDeliveryRate ?? 0} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="payment">Paiement</TabsTrigger>
          <TabsTrigger value="contracts">
            Contrats
            {vendor.contracts && vendor.contracts.length > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {vendor.contracts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Informations du fournisseur</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nom légal</p>
                    <p className="font-medium">{vendor.legalName}</p>
                  </div>
                  {vendor.tradeName && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nom commercial</p>
                      <p className="font-medium">{vendor.tradeName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pays</p>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{vendor.country || "-"}</p>
                    </div>
                  </div>
                  {vendor.taxId && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Numéro fiscal</p>
                      <p className="font-medium font-mono">{vendor.taxId}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Type</p>
                    <Badge variant={vendor.isFormal ? "default" : "secondary"}>
                      {vendor.isFormal ? "Fournisseur formel" : "Fournisseur semi-formel"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Contact</p>
                    <p className="font-medium">{vendor.contactName || "-"}</p>
                  </div>
                  {vendor.contactEmail && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${vendor.contactEmail}`} className="font-medium text-primary hover:underline">
                          {vendor.contactEmail}
                        </a>
                      </div>
                    </div>
                  )}
                  {vendor.contactPhone && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Téléphone</p>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">{vendor.contactPhone}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Membre depuis</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{formatDate(vendor.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment">
          <div className="space-y-4">
            {/* Bank Accounts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Comptes bancaires
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vendor.bankAccounts && vendor.bankAccounts.length > 0 ? (
                  <div className="space-y-3">
                    {vendor.bankAccounts.map((account, idx) => (
                      <div key={idx} className="p-3 border rounded-lg bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{account.bankName}</p>
                            <p className="text-sm text-muted-foreground font-mono">{account.accountNumber}</p>
                            {account.iban && (
                              <p className="text-xs text-muted-foreground font-mono">IBAN: {account.iban}</p>
                            )}
                          </div>
                          <Badge variant="outline">Bancaire</Badge>
                        </div>
                        {(account as any).ribFileName && (
                          <div className="flex items-center gap-2 p-2 rounded bg-emerald-50 border border-emerald-200">
                            <FileCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="text-xs text-emerald-700 truncate">{(account as any).ribFileName}</span>
                            <Badge variant="outline" className="ml-auto text-xs border-emerald-300 text-emerald-700">RIB joint</Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Aucun compte bancaire enregistré</p>
                )}
              </CardContent>
            </Card>

            {/* Mobile Money */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Mobile Money
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vendor.mobileMoneyAccounts && vendor.mobileMoneyAccounts.length > 0 ? (
                  <div className="space-y-3">
                    {vendor.mobileMoneyAccounts.map((account, idx) => (
                      <div key={idx} className="p-3 border rounded-lg bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{account.provider}</p>
                            <p className="text-sm text-muted-foreground font-mono">{account.number}</p>
                          </div>
                          <Badge variant="outline">Mobile Money</Badge>
                        </div>
                        {(account as any).screenshotFileName && (
                          <div className="flex items-center gap-2 p-2 rounded bg-blue-50 border border-blue-200">
                            <FileCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span className="text-xs text-blue-700 truncate">{(account as any).screenshotFileName}</span>
                            <Badge variant="outline" className="ml-auto text-xs border-blue-300 text-blue-700">Justificatif joint</Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Aucun compte mobile money enregistré</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Contrats</CardTitle>
                <CardDescription>Contrats actifs et historique</CardDescription>
              </div>
              {canManage && (
                <Button onClick={() => setContractDialogOpen(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un contrat
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {vendor.contracts && vendor.contracts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Contrat</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Début</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead>Valeur totale</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendor.contracts.map((contract: any) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-mono text-sm">{contract.contractNumber}</TableCell>
                        <TableCell className="font-medium">{contract.title}</TableCell>
                        <TableCell>{formatDate(contract.startDate)}</TableCell>
                        <TableCell>{contract.endDate ? formatDate(contract.endDate) : "Indéfini"}</TableCell>
                        <TableCell>
                          {contract.totalValue
                            ? `${formatCurrency(contract.totalValue)} XOF`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              contract.status === "active"
                                ? "default"
                                : contract.status === "expired"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {contract.status === "active" ? "Actif" : contract.status === "expired" ? "Expiré" : "Résilié"}
                          </Badge>
                          {(contract.signatureStatus) && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              {contract.signatureStatus === "fully_signed" ? "✅ Signé" :
                               contract.signatureStatus === "partially_signed" ? "🖊 Partiel" :
                               contract.signatureStatus === "pending_signature" ? "⏳ En attente" : ""}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {canManage && (
                            <Button size="sm" variant="outline" className="gap-1 text-xs"
                              onClick={() => {
                                setSelectedContractId(contract.id);
                                setSignatureDialogOpen(true);
                              }}>
                              <PenLine className="h-3 w-3" />Signer
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">Aucun contrat enregistré</p>
                  {canManage && (
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => setContractDialogOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter un contrat
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <EntityHistory entries={history || []} isLoading={historyLoading} />
        </TabsContent>
      </Tabs>

      {/* Admin Actions */}
      {canManage && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Shield className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-900">Actions d'administration</p>
                  <p className="text-sm text-amber-700">Gérer le statut de ce fournisseur</p>
                </div>
              </div>
              <div className="flex gap-2">
                {vendor.status === "pending" && (
                  <Button
                    onClick={() => setApproveDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approuver le fournisseur
                  </Button>
                )}
                {vendor.status === "active" && (
                  <Button
                    onClick={() => setDeactivateDialogOpen(true)}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    size="sm"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Désactiver
                  </Button>
                )}
                {vendor.status === "inactive" && (
                  <Button
                    onClick={() => approveMutation.mutate({ id: numericId })}
                    size="sm"
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Réactiver
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approuver ce fournisseur?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action activera le fournisseur {vendor.legalName}. Il pourra ensuite être sélectionné dans les demandes d'achat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approveMutation.mutate({ id: numericId })}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              Approuver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver ce fournisseur?</AlertDialogTitle>
            <AlertDialogDescription>
              Le fournisseur {vendor.legalName} sera désactivé et ne pourra plus être sélectionné dans les nouvelles commandes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 px-1 py-2">
            <Label>Raison (optionnel)</Label>
            <Input
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              placeholder="Raison de la désactivation..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateMutation.mutate({ id: numericId, reason: deactivateReason })}
              disabled={deactivateMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Contract Dialog */}
      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un contrat</DialogTitle>
            <DialogDescription>Enregistrer un nouveau contrat avec ce fournisseur</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>N° Contrat *</Label>
                <Input
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  placeholder="CONT-2026-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Valeur totale (XOF)</Label>
                <Input
                  type="number"
                  value={contractValue}
                  onChange={(e) => setContractValue(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Titre du contrat *</Label>
              <Input
                value={contractTitle}
                onChange={(e) => setContractTitle(e.target.value)}
                placeholder="Titre du contrat..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début *</Label>
                <Input
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={contractEndDate}
                  onChange={(e) => setContractEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddContract} disabled={addContractMutation.isPending}>
              {addContractMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* E-Signature Dialog */}
      {signatureDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><PenLine className="h-5 w-5 text-blue-600" />Envoyer pour signature</h3>
            <p className="text-sm text-muted-foreground">Ajoutez les signataires. Chacun recevra un lien unique pour signer électroniquement.</p>
            <div className="space-y-3">
              {signatories.map((sig, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <input value={sig.name} onChange={e => setSignatories(s => s.map((x, idx) => idx === i ? {...x, name: e.target.value} : x))}
                    placeholder="Nom" className="border rounded-lg px-3 py-2 text-sm col-span-1" />
                  <input value={sig.email} onChange={e => setSignatories(s => s.map((x, idx) => idx === i ? {...x, email: e.target.value} : x))}
                    placeholder="Email" className="border rounded-lg px-3 py-2 text-sm col-span-1" />
                  <input value={sig.role} onChange={e => setSignatories(s => s.map((x, idx) => idx === i ? {...x, role: e.target.value} : x))}
                    placeholder="Rôle" className="border rounded-lg px-3 py-2 text-sm col-span-1" />
                </div>
              ))}
              <button onClick={() => setSignatories(s => [...s, { name: "", email: "", role: "" }])}
                className="text-sm text-blue-600 hover:underline">+ Ajouter un signataire</button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              💡 Chaque signataire recevra un lien de signature unique. Copiez et partagez le lien avec eux directement.
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setSignatureDialogOpen(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button
                onClick={() => selectedContractId && sendForSignatureMut.mutate({
                  contractId: selectedContractId,
                  signatories: signatories.filter(s => s.name && s.email),
                })}
                disabled={sendForSignatureMut.isPending || signatories.every(s => !s.name || !s.email)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 btn-primary">
                {sendForSignatureMut.isPending ? "Envoi..." : "Envoyer pour signature"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Vendor Portal User Dialog */}
      {inviteVendorOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold">Inviter au portail fournisseur</h3>
            <p className="text-sm text-muted-foreground">Créez un accès au portail pour ce fournisseur.</p>
            <div className="space-y-3">
              <input value={vendorInviteForm.name} onChange={e => setVendorInviteForm(f => ({...f, name: e.target.value}))}
                placeholder="Nom du contact" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input type="email" value={vendorInviteForm.email} onChange={e => setVendorInviteForm(f => ({...f, email: e.target.value}))}
                placeholder="Email" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setInviteVendorOpen(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button
                onClick={() => vendor && inviteVendorUserMut.mutate({ vendorId: vendor.id, name: vendorInviteForm.name, email: vendorInviteForm.email })}
                disabled={inviteVendorUserMut.isPending || !vendorInviteForm.name || !vendorInviteForm.email}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 btn-primary">
                {inviteVendorUserMut.isPending ? "Création..." : "Créer l'accès"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
