import { useTranslation } from "react-i18next";
import { ActionMenu } from "@/components/ActionMenu";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import {
  Building2, Smartphone, CreditCard, Banknote,
  DollarSign, CheckCircle2, Clock, XCircle, Search, Eye, FileText, Download} from "lucide-react";
import React, { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const fmt = (n: string | number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(n));

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

const METHOD_ICONS: Record<string, (props: any) => React.ReactElement | null> = {
  bank_transfer: Building2,
  mobile_money: Smartphone,
  check: CreditCard,
  cash: Banknote,
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Virement bancaire",
  mobile_money: "Mobile Money",
  check: "Chèque",
  cash: "Espèces",
};

const STATUS_MAP: Record<string, { label: string; icon: React.FC<any>; cls: string }> = {
  completed:  { label: "Payé",        icon: CheckCircle2, cls: "bg-green-100 text-green-800 border-green-200" },
  scheduled:  { label: "Planifié",    icon: Clock,        cls: "bg-blue-100 text-blue-800 border-blue-200" },
  processing: { label: "En cours",    icon: Clock,        cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  failed:     { label: "Échoué",      icon: XCircle,      cls: "bg-red-100 text-red-800 border-red-200" },
  cancelled:  { label: "Annulé",      icon: XCircle,      cls: "bg-gray-100 text-gray-700 border-gray-200" },
};

export default function PaymentsList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "procurement_manager";
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: payments, isLoading } = trpc.invoices.listPayments.useQuery(
    statusFilter !== "all" ? { status: statusFilter as any } : undefined
  );

  const filtered = payments?.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.reference?.toLowerCase().includes(q) ||
      (p.invoice as any)?.invoiceNumber?.toLowerCase().includes(q) ||
      (p.vendor as any)?.legalName?.toLowerCase().includes(q)
    );
  });

  const totalPaid = payments?.filter(p => p.status === "completed")
    .reduce((s, p) => s + parseFloat(p.amount), 0) ?? 0;

  const pendingCount = payments?.filter(p => p.status === "scheduled").length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader icon={<CreditCard className="h-5 w-5" />} title={t("payments.title")} description="Suivi des paiements" />
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Paiements</h1>
          <p className="text-muted-foreground mt-1">Historique et suivi des règlements fournisseurs</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total réglé</p>
                <p className="text-xl font-bold">{fmt(totalPaid)} <span className="text-sm font-normal text-muted-foreground">XOF</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Clock className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Paiements planifiés</p>
                <p className="text-xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg"><DollarSign className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total paiements</p>
                <p className="text-xl font-bold">{payments?.length ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher (référence, facture, fournisseur)…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="completed">Payés</SelectItem>
            <SelectItem value="scheduled">Planifiés</SelectItem>
            <SelectItem value="processing">En cours</SelectItem>
            <SelectItem value="failed">Échoués</SelectItem>
            <SelectItem value="cancelled">Annulés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement…</div>
          ) : filtered && filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Date valeur</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => {
                  const st = STATUS_MAP[p.status] ?? STATUS_MAP.completed;
                  const Icon = METHOD_ICONS[p.paymentMethod] ?? DollarSign;
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {(p.vendor as any)?.legalName ?? `Fournisseur #${(p.invoice as any)?.vendorId ?? "—"}`}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {(p.invoice as any)?.invoiceNumber ?? `#${p.invoiceId}`}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{METHOD_LABELS[p.paymentMethod]}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmt(p.amount)} <span className="text-xs text-muted-foreground">XOF</span>
                      </TableCell>
                      <TableCell className="text-sm">{fmtDate(p.valueDate)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {p.reference || "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${st.cls}`}>
                          <st.icon className="h-3 w-3" />
                          {st.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionMenu actions={[
                          { icon: <Eye className="h-4 w-4" />, label: "Voir le paiement", onClick: () => {} },
                          { icon: <FileText className="h-4 w-4" />, label: "Voir la facture associee", href: p.invoiceId ? `/invoices/${p.invoiceId}` : undefined, hidden: !p.invoiceId, variant: "default" },
                          { icon: <Download className="h-4 w-4" />, label: "Telecharger le recu", onClick: () => {}, hidden: !canManage },
                        ]} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-4 font-medium text-muted-foreground">Aucun paiement enregistré</p>
              <p className="text-sm text-muted-foreground mt-1">
                Les paiements apparaissent ici lorsque vous marquez une facture comme payée
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
