import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, Package, FileText, Plus, Send, Loader2, Building2 } from "lucide-react";

function fmt(n: number) { return new Intl.NumberFormat("fr-FR").format(n); }

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMut = trpc.supplierPortal.vendorLogin.useMutation({
    onSuccess: () => { toast.success("Connexion réussie"); window.location.reload(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl">Portail Fournisseur</CardTitle>
          <p className="text-sm text-muted-foreground">Connectez-vous pour accéder à votre espace</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Mot de passe</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              onKeyDown={e => e.key === "Enter" && loginMut.mutate({ email, password })} />
          </div>
          <button onClick={() => loginMut.mutate({ email, password })} disabled={loginMut.isPending || !email || !password}
            className="w-full py-2.5 rounded-lg text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#2563eb" }}>
            {loginMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Se connecter
          </button>
          <p className="text-xs text-center text-muted-foreground">Accès réservé aux fournisseurs enregistrés.<br/>Contactez votre acheteur pour obtenir vos accès.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PortalDashboard() {
  const [activeTab, setActiveTab] = useState<"pos"|"invoices"|"submit">("pos");
  const [showSubmit, setShowSubmit] = useState(false);

  const { data: vendorUser } = trpc.supplierPortal.vendorMe.useQuery();
  const { data: pos = [] } = trpc.supplierPortal.getVendorPOs.useQuery();
  const { data: submissions = [] } = trpc.supplierPortal.getVendorSubmissions.useQuery();
  const logoutMut = trpc.supplierPortal.vendorLogout.useMutation({
    onSuccess: () => window.location.reload(),
  });
  const submitMut = trpc.supplierPortal.submitInvoice.useMutation({
    onSuccess: (data) => { toast.success(data.message); setShowSubmit(false); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({ poId: "", invoiceNumber: "", invoiceDate: new Date().toISOString().split("T")[0], dueDate: "", amount: "", taxAmount: "", notes: "" });

  const STATUS_COLORS: Record<string, string> = {
    submitted: "bg-blue-100 text-blue-800",
    under_review: "bg-yellow-100 text-yellow-800",
    accepted: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  const STATUS_LABELS: Record<string, string> = {
    submitted: "Soumise", under_review: "En cours d'examen", accepted: "Acceptée", rejected: "Refusée"
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm">{vendorUser?.vendorName || "Portail Fournisseur"}</p>
            <p className="text-xs text-muted-foreground">{vendorUser?.email}</p>
          </div>
        </div>
        <button onClick={() => logoutMut.mutate()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors">
          <LogOut className="h-4 w-4" />Se déconnecter
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{(pos as any[]).length}</p>
            <p className="text-xs text-muted-foreground">Commandes actives</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{(submissions as any[]).filter((s: any) => s.status === "accepted").length}</p>
            <p className="text-xs text-muted-foreground">Factures acceptées</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{(submissions as any[]).filter((s: any) => s.status === "submitted").length}</p>
            <p className="text-xs text-muted-foreground">En attente</p>
          </CardContent></Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {[
            { id: "pos", label: "Bons de commande", icon: Package },
            { id: "invoices", label: "Mes factures", icon: FileText },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {/* POs Tab */}
        {activeTab === "pos" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Vos bons de commande</h2>
              <button onClick={() => setShowSubmit(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: "#2563eb" }}>
                <Plus className="h-4 w-4" />Soumettre une facture
              </button>
            </div>
            {(pos as any[]).length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun bon de commande actif</CardContent></Card>
            ) : (pos as any[]).map((po: any) => (
              <Card key={po.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{po.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">{po.title || "Bon de commande"}</p>
                      <p className="text-sm font-medium text-blue-700 mt-1">{fmt(Number(po.totalAmount))} XOF</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">{po.status}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">{po.submissionCount} facture(s) soumise(s)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Vos soumissions de factures</h2>
              <button onClick={() => setShowSubmit(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: "#2563eb" }}>
                <Plus className="h-4 w-4" />Nouvelle facture
              </button>
            </div>
            {(submissions as any[]).length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune facture soumise</CardContent></Card>
            ) : (submissions as any[]).map((sub: any) => (
              <Card key={sub.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{sub.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">Date: {new Date(sub.invoiceDate).toLocaleDateString("fr-FR")}</p>
                      <p className="text-sm font-medium text-blue-700">{fmt(Number(sub.amount))} XOF</p>
                      {sub.reviewNote && <p className="text-xs text-muted-foreground italic mt-1">"{sub.reviewNote}"</p>}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || ""}`}>
                      {STATUS_LABELS[sub.status] || sub.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Submit Invoice Modal */}
        {showSubmit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Soumettre une facture</CardTitle>
                  <button onClick={() => setShowSubmit(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Bon de commande (optionnel)</Label>
                  <select value={form.poId} onChange={e => setForm(f => ({ ...f, poId: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">— Facture directe (sans BC) —</option>
                    {(pos as any[]).map((po: any) => (
                      <option key={po.id} value={po.id}>{po.orderNumber} — {fmt(Number(po.totalAmount))} XOF</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>N° Facture *</Label>
                    <Input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="FAC-001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date facture *</Label>
                    <Input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Montant HT (XOF) *</Label>
                    <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>TVA (XOF)</Label>
                    <Input type="number" value={form.taxAmount} onChange={e => setForm(f => ({ ...f, taxAmount: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date d'échéance</Label>
                    <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Références, conditions..." />
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setShowSubmit(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
                  <button
                    onClick={() => submitMut.mutate({
                      poId: form.poId ? parseInt(form.poId) : undefined,
                      invoiceNumber: form.invoiceNumber,
                      invoiceDate: form.invoiceDate,
                      dueDate: form.dueDate || undefined,
                      amount: parseFloat(form.amount) || 0,
                      taxAmount: parseFloat(form.taxAmount) || undefined,
                      notes: form.notes || undefined,
                    })}
                    disabled={submitMut.isPending || !form.invoiceNumber || !form.amount}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: "#2563eb" }}>
                    {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Soumettre
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SupplierPortal() {
  const { data: vendorUser, isLoading } = trpc.supplierPortal.vendorMe.useQuery();
  const utils = trpc.useUtils();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (!vendorUser) return <LoginForm onLogin={() => utils.supplierPortal.vendorMe.invalidate()} />;
  return <PortalDashboard />;
}
