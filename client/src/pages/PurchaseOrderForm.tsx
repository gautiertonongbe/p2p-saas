import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronRight, Send, Building2, Calendar, FileText,
  Package, CheckCircle2, AlertTriangle, Truck
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TaxSelector, type TaxLine } from "@/components/TaxSelector";

function fmt(n: number | string) {
  return new Intl.NumberFormat("fr-FR").format(Number(n));
}

export default function PurchaseOrderForm() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const requestId = searchParams ? new URLSearchParams(searchParams).get("requestId") : null;
  const utils = trpc.useUtils();

  const [vendorId, setVendorId]   = useState<number>(0);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes]         = useState("");
  const [taxLines, setTaxLines]   = useState<TaxLine[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const { data: approvedRequests } = trpc.purchaseRequests.list.useQuery({ status: "approved" });
  const { data: vendors = [] }      = trpc.vendors.list.useQuery();
  const { data: requestDetails }    = trpc.purchaseRequests.getById.useQuery(
    { id: parseInt(requestId!) }, { enabled: !!requestId }
  );
  const { data: requestItems = [] } = trpc.purchaseRequests.getRequestItems.useQuery(
    { requestId: parseInt(requestId!) }, { enabled: !!requestId }
  );

  useEffect(() => {
    if (requestDetails && requestItems) {
      setSelectedRequest({ ...requestDetails, items: requestItems });
    }
  }, [requestDetails, requestItems]);

  const createMut = trpc.purchaseOrders.create.useMutation({
    onSuccess: () => {
      toast.success("Bon de commande créé !");
      utils.purchaseOrders.list.invalidate();
      setLocation("/purchase-orders");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const items = selectedRequest?.items ?? [];
  const subtotal = items.reduce((s: number, i: any) =>
    s + Number(i.quantity) * Number(i.unitPrice), 0
  ) || Number(selectedRequest?.amountEstimate || 0);
  const totalTax = taxLines.filter(t => !t.isWithholding).reduce((s, t) => s + t.amount, 0);
  const totalWithholding = taxLines.filter(t => t.isWithholding).reduce((s, t) => s + t.amount, 0);
  const netTotal = subtotal + totalTax - totalWithholding;

  const handleSubmit = async () => {
    if (!vendorId) { toast.error("Sélectionnez un fournisseur"); return; }
    if (!selectedRequest) { toast.error("Sélectionnez une demande d'achat"); return; }
    await createMut.mutateAsync({
      requestId: selectedRequest.id,
      vendorId,
      expectedDeliveryDate: deliveryDate || undefined,
      notes: notes || undefined,
      items: items.map((item: any) => ({
        itemName: item.itemName,
        description: item.description || undefined,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        unit: item.unit || undefined,
      })),
    });
  };

  const selectedVendor = (vendors as any[]).find((v: any) => v.id === vendorId);

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-white border-b px-6 py-3 flex items-center gap-4">
        <button onClick={() => setLocation("/purchase-orders")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Bons de commande
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
        <span className="text-sm font-medium">Nouveau BC</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setLocation("/purchase-orders")}
            className="px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={createMut.isPending || !vendorId || !selectedRequest}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg btn-primary text-white text-sm font-semibold disabled:opacity-50 transition-colors">
            <Send className="h-3.5 w-3.5" />
            {createMut.isPending ? "Création..." : "Créer le BC"}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Step indicator */}
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-100 mx-10" />
            {[
              { n: 1, label: "Demande", done: !!selectedRequest },
              { n: 2, label: "Fournisseur", done: !!vendorId },
              { n: 3, label: "Livraison", done: !!deliveryDate },
              { n: 4, label: "Confirmer", done: false },
            ].map((step, i) => (
              <div key={step.n} className="flex flex-col items-center gap-2 relative z-10">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  step.done ? "bg-emerald-500 border-emerald-500" : "bg-white border-gray-200"
                }`}>
                  {step.done
                    ? <CheckCircle2 className="h-5 w-5 text-white" />
                    : <span className="text-sm font-bold text-gray-400">{step.n}</span>}
                </div>
                <span className={`text-xs font-medium ${step.done ? "text-emerald-700" : "text-gray-400"}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Select request (only if not pre-selected) */}
        {!requestId && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50/50">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />Étape 1 — Sélectionner la demande approuvée
              </h2>
            </div>
            <div className="p-5">
              {!approvedRequests?.length ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-400" />
                  Aucune demande approuvée disponible
                </div>
              ) : (
                <div className="space-y-2">
                  {approvedRequests.map((req: any) => (
                    <button key={req.id}
                      onClick={() => setLocation(`/purchase-orders/new?requestId=${req.id}`)}
                      className="w-full text-left flex items-center justify-between p-3 rounded-xl border hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                      <div>
                        <p className="text-sm font-semibold">{req.title}</p>
                        <p className="text-xs text-muted-foreground">{req.requestNumber}</p>
                      </div>
                      <span className="text-sm font-bold text-blue-700">{fmt(req.amountEstimate)} XOF</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected request summary */}
        {selectedRequest && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-6 py-3 border-b bg-emerald-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">Demande sélectionnée</span>
              </div>
              {!requestId && (
                <button onClick={() => { setSelectedRequest(null); setLocation("/purchase-orders/new"); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline">
                  Changer
                </button>
              )}
            </div>

            {/* Header info */}
            <div className="px-6 py-4 border-b">
              <p className="font-semibold text-gray-900">{selectedRequest.title}</p>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span>{selectedRequest.requestNumber}</span>
                {selectedRequest.description && <span>· {selectedRequest.description}</span>}
              </div>
            </div>

            {/* Items table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Article</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qté</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prix unit.</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((item: any, i: number) => (
                  <tr key={item.id} className={`border-b last:border-0 ${i % 2 ? "bg-gray-50/30" : ""}`}>
                    <td className="px-6 py-3 font-medium">{item.itemName}
                      {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                    </td>
                    <td className="px-6 py-3 text-right text-muted-foreground">{item.quantity} {item.unit || "pcs"}</td>
                    <td className="px-6 py-3 text-right text-muted-foreground">{fmt(item.unitPrice)} XOF</td>
                    <td className="px-6 py-3 text-right font-semibold">{fmt(Number(item.quantity) * Number(item.unitPrice))} XOF</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-6 py-4 text-center text-muted-foreground text-sm">Chargement des articles...</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/70">
                  <td colSpan={3} className="px-6 py-3 text-right font-semibold text-gray-700 text-sm">Sous-total HT</td>
                  <td className="px-6 py-3 text-right font-bold text-lg">{fmt(subtotal)} <span className="text-sm font-normal text-muted-foreground">XOF</span></td>
                </tr>
              </tfoot>
            </table>

            {/* Taxes */}
            <div className="px-6 py-4 border-t">
              <TaxSelector baseAmount={subtotal} value={taxLines} onChange={setTaxLines} />
            </div>

            {/* Net total */}
            {taxLines.length > 0 && (
              <div className="px-6 py-4 bg-blue-50 border-t flex justify-between items-center">
                <span className="font-semibold text-gray-700">Net à payer</span>
                <span className="text-2xl font-bold text-blue-700">{fmt(netTotal)} <span className="text-sm font-normal text-muted-foreground">XOF</span></span>
              </div>
            )}
          </div>
        )}

        {/* Step 2 & 3: Vendor + delivery */}
        {selectedRequest && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50/50">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />Fournisseur & livraison
              </h2>
            </div>
            <div className="p-5 space-y-5">
              {/* Vendor */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Fournisseur <span className="text-red-500">*</span></Label>
                <select value={vendorId || ""}
                  onChange={e => setVendorId(parseInt(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                  <option value="">Sélectionner un fournisseur...</option>
                  {(vendors as any[]).map((v: any) => (
                    <option key={v.id} value={v.id}>{v.legalName}</option>
                  ))}
                </select>
                {selectedVendor && (
                  <div className="flex items-center gap-2 p-2.5 bg-purple-50 rounded-lg border border-purple-100">
                    <Building2 className="h-4 w-4 text-purple-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-purple-800">{selectedVendor.legalName}</p>
                      {selectedVendor.email && <p className="text-xs text-purple-600">{selectedVendor.email}</p>}
                    </div>
                    {selectedVendor.riskLevel && (
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                        selectedVendor.riskLevel === 'low' ? 'bg-emerald-100 text-emerald-700' :
                        selectedVendor.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        Risque {selectedVendor.riskLevel === 'low' ? 'faible' : selectedVendor.riskLevel === 'high' ? 'élevé' : 'modéré'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Delivery date */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />Date de livraison prévue
                </Label>
                <Input type="date" value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="h-10 rounded-xl" />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notes <span className="text-xs text-muted-foreground font-normal">(optionnel)</span></Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Instructions de livraison, conditions particulières, références..."
                  className="rounded-xl resize-none" />
              </div>
            </div>
          </div>
        )}

        {/* Summary before submit */}
        {selectedRequest && vendorId && (
          <div className="bg-blue-600 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Prêt à créer le bon de commande</p>
              <p className="text-sm text-blue-100">
                {selectedVendor?.legalName} · {fmt(netTotal)} XOF
                {deliveryDate && ` · Livraison le ${new Date(deliveryDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`}
              </p>
            </div>
            <button onClick={handleSubmit} disabled={createMut.isPending}
              className="px-5 py-2.5 rounded-xl bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1.5">
              <Send className="h-4 w-4" />
              {createMut.isPending ? "Création..." : "Créer le BC"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
