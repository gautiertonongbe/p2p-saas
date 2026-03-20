import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Plus, Search, FileText, Upload, Download } from "lucide-react";
import React, { useState } from "react";
import { ViewManager, ViewState } from "@/components/ViewManager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function InvoicesList() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewState, setViewState] = useState<ViewState>({ filters: [], displayType: "table" });

  const INVOICE_COLUMNS = [
    { key: "invoiceNumber", label: "N° facture", sortable: true },
    { key: "status", label: "Statut", type: "status" as const, filterable: true,
      filterOptions: [
        { value: "pending", label: "En attente" }, { value: "approved", label: "Approuvée" },
        { value: "disputed", label: "En litige" }, { value: "paid", label: "Payée" },
        { value: "rejected", label: "Rejetée" }, { value: "cancelled", label: "Annulée" },
      ]},
    { key: "matchStatus", label: "Rapprochement", type: "status" as const, filterable: true,
      filterOptions: [{ value: "matched", label: "Rapproché" }, { value: "unmatched", label: "Non rapproché" }, { value: "exception", label: "Exception" }]},
    { key: "amount", label: "Montant", type: "amount" as const, sortable: true },
    { key: "vendorId", label: "Fournisseur", filterable: true },
    { key: "createdAt", label: "Date saisie", type: "date" as const, sortable: true },
    { key: "dueDate", label: "Échéance", type: "date" as const, sortable: true },
  ];
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: invoices, isLoading } = trpc.invoices.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: () => {
      toast.success("Facture créée avec succès");
      utils.invoices.list.invalidate();
      setUploadDialogOpen(false);
      setUploading(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
      setUploading(false);
    }
  });

  const exportPDFMutation = trpc.invoices.exportPDF.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('PDF téléchargé avec succès');
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const { data: vendors } = trpc.vendors.list.useQuery();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 16 * 1024 * 1024) {
      toast.error("Le fichier ne doit pas dépasser 16 Mo");
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoiceNumber || !vendorId || !invoiceDate || !amount) {
      toast.error("Veuillez remplir tous les champs requis");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Le montant doit être un nombre positif");
      return;
    }

    setUploading(true);

    try {
      await createMutation.mutateAsync({
        invoiceNumber,
        vendorId: parseInt(vendorId),
        invoiceDate,
        amount: amountNum,
        invoiceFileUrl: selectedFile?.name || ""
      });
      
      // Reset form
      setInvoiceNumber("");
      setVendorId("");
      setInvoiceDate("");
      setAmount("");
      setSelectedFile(null);
    } catch (_err) {
      // Error handled by mutation onError
    }
  };

  const filteredInvoices = invoices?.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    const matchesViewFilters = viewState.filters.every(f => {
      const val = (invoice as any)[f.field];
      switch (f.operator) {
        case "eq": return String(val) === f.value;
        case "ne": return String(val) !== f.value;
        case "contains": return String(val).toLowerCase().includes(f.value.toLowerCase());
        case "gt": return Number(val) > Number(f.value);
        case "gte": return Number(val) >= Number(f.value);
        case "lt": return Number(val) < Number(f.value);
        case "lte": return Number(val) <= Number(f.value);
        default: return true;
      }
    });
    return matchesSearch && matchesStatus && matchesViewFilters;
  });

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('fr-FR').format(Number(amount));
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('invoices.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('invoices.list')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewManager
            entity="invoices"
            entityLabel="Factures"
            columns={INVOICE_COLUMNS}
            value={viewState}
            onChange={setViewState}
            defaultColumns={INVOICE_COLUMNS.map(c => c.key)}
          />
          <Link href="/invoices/new">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" className="btn-primary">
                <Plus className="h-4 w-4" />Nouvelle facture
              </button>
            </Link>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto btn-primary">
                <Upload className="mr-2 h-4 w-4" />
                {t('invoices.upload')}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Télécharger une facture</DialogTitle>
              <DialogDescription>
                Téléchargez un fichier PDF ou image. Les données seront extraites automatiquement par OCR.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Numéro de facture *</Label>
                <Input
                  id="invoiceNumber"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-2024-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Fournisseur *</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un fournisseur" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors?.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id.toString()}>
                        {vendor.legalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceDate">Date de facture *</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Montant (XOF) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-file">Fichier de facture (optionnel)</Label>
                <Input
                  id="invoice-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground">
                  Formats acceptés: PDF, JPG, PNG (max 16 Mo)
                </p>
              </div>
              {uploading && (
                <div className="text-center text-sm text-muted-foreground">
                  Création de la facture en cours...
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? "Création..." : "Créer la facture"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('common.filter')}</CardTitle>
          <CardDescription>Rechercher et filtrer les factures</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('common.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('common.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="pending">{t('invoices.status.pending')}</SelectItem>
                <SelectItem value="approved">{t('invoices.status.approved')}</SelectItem>
                <SelectItem value="disputed">En litige</SelectItem>
                <SelectItem value="revised">À réviser</SelectItem>
                <SelectItem value="paid">{t('invoices.status.paid')}</SelectItem>
                <SelectItem value="rejected">{t('invoices.status.rejected')}</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
          ) : filteredInvoices && filteredInvoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoices.invoiceNumber')}</TableHead>
                  <TableHead>{t('invoices.vendor')}</TableHead>
                  <TableHead>{t('invoices.invoiceDate')}</TableHead>
                  <TableHead>{t('invoices.dueDate')}</TableHead>
                  <TableHead className="text-right">{t('invoices.amount')}</TableHead>
                  <TableHead>{t('invoices.matchStatus')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => window.location.href = `/invoices/${invoice.id}`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {invoice.invoiceNumber}
                        {(invoice as any).revisionNumber > 1 && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                            Rev.{(invoice as any).revisionNumber}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{(invoice as any).vendor?.legalName ?? `#${invoice.vendorId}`}</TableCell>
                    <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                    <TableCell>{invoice.dueDate ? formatDate(invoice.dueDate) : '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.amount)} XOF</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        invoice.matchStatus === 'matched' ? 'bg-green-100 text-green-800' :
                        invoice.matchStatus === 'exception' ? 'bg-red-100 text-red-800' :
                        invoice.matchStatus === 'manual_review' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {t(`invoices.matchStatus.${invoice.matchStatus}`)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`status-badge status-${invoice.status}`}>
                        {t(`invoices.status.${invoice.status}`)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportPDFMutation.mutate({ id: invoice.id });
                          }}
                          disabled={exportPDFMutation.isPending}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          {t('common.view')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Aucune facture trouvée</p>
              <Button className="mt-4" variant="outline" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                {t('invoices.upload')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
