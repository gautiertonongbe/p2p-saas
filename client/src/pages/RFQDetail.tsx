import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Send, Award, Users, BarChart2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EntityHistory } from "@/components/EntityHistory";

const fmt = (n: string | number) => new Intl.NumberFormat("fr-FR").format(Number(n));
const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

// ── Inline scoring component ──────────────────────────────────────────────────
function ScoreResponseInline({
  responseId, criteria, onScored,
}: { responseId: number; criteria: { name: string; weight: number }[]; onScored: () => void }) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(criteria.map(c => [c.name, 5]))
  );
  const [open, setOpen] = useState(false);

  const scoreMutation = trpc.rfqs.scoreResponse.useMutation({
    onSuccess: () => { toast.success("Offre notée avec succès"); setOpen(false); onScored(); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalScore = Math.round(
    criteria.reduce((s, c) => s + (scores[c.name] ?? 5) * c.weight / 10, 0)
  );

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        <BarChart2 className="mr-2 h-3.5 w-3.5" />
        Noter cette offre
      </Button>
    );
  }

  return (
    <div className="mt-4 p-4 border rounded-lg bg-muted/20 space-y-4">
      <p className="text-sm font-medium">Notation de l'offre (1-10 par critère)</p>
      {criteria.map(c => (
        <div key={c.name} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{c.name} <span className="text-muted-foreground">({c.weight}%)</span></span>
            <span className="font-medium">{scores[c.name] ?? 5}/10 → {((scores[c.name] ?? 5) * c.weight / 10).toFixed(1)} pts</span>
          </div>
          <input
            type="range" min="1" max="10" step="1"
            value={scores[c.name] ?? 5}
            onChange={e => setScores(p => ({ ...p, [c.name]: parseInt(e.target.value) }))}
            className="w-full h-2 accent-primary"
          />
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 border-t">
        <p className="text-sm font-bold">Score total: <span className="text-primary">{totalScore}/100</span></p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button size="sm" disabled={scoreMutation.isPending}
            onClick={() => scoreMutation.mutate({ responseId, scores, totalScore })}>
            {scoreMutation.isPending ? "Enregistrement…" : "Valider la note"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft:   { label: "Brouillon", className: "bg-gray-100 text-gray-700" },
  sent:    { label: "Envoyé",    className: "bg-blue-100 text-blue-800" },
  closed:  { label: "Clôturé",  className: "bg-orange-100 text-orange-800" },
  awarded: { label: "Attribué", className: "bg-green-100 text-green-800" },
};

export default function RFQDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const numId = parseInt(id!);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [awardVendorId, setAwardVendorId] = useState<string>("");
  const [awardResponseId, setAwardResponseId] = useState<number | null>(null);
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [addVendorId, setAddVendorId] = useState<string>("");
  const [addVendorOpen, setAddVendorOpen] = useState(false);

  const { data: rfq, isLoading } = trpc.rfqs.getById.useQuery({ id: numId }, { enabled: !!id });
  const { data: history, isLoading: histLoading } = trpc.settings.getEntityHistory.useQuery({ entityType: "rfq", entityId: numId }, { enabled: !!id });
  const { data: vendors } = trpc.vendors.list.useQuery({ status: "active" });

  const sendMutation = trpc.rfqs.send.useMutation({
    onSuccess: () => { toast.success("RFQ envoyé aux fournisseurs"); setSendDialogOpen(false); utils.rfqs.getById.invalidate({ id: numId }); },
    onError: (e: any) => toast.error(e.message),
  });

  const awardMutation = trpc.rfqs.awardVendor.useMutation({
    onSuccess: () => { toast.success("Marché attribué avec succès"); setAwardDialogOpen(false); utils.rfqs.getById.invalidate({ id: numId }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addVendorMutation = trpc.rfqs.addVendor.useMutation({
    onSuccess: () => { toast.success("Fournisseur ajouté"); setAddVendorOpen(false); utils.rfqs.getById.invalidate({ id: numId }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Chargement...</div>;
  if (!rfq) return <div className="flex flex-col items-center justify-center min-h-[400px]"><p className="text-muted-foreground">RFQ introuvable</p><Button onClick={() => setLocation("/rfqs")} variant="outline" className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" />Retour</Button></div>;

  const st = STATUS_MAP[rfq.status] ?? STATUS_MAP.draft;
  const canManage = user?.role === "admin" || user?.role === "procurement_manager";
  const isOverdue = rfq.status === "sent" && new Date(rfq.deadline) < new Date();
  const invitedVendorIds = new Set((rfq.vendors ?? []).map((v: any) => v.vendorId));

  // Build comparison matrix: for each response, show score per criterion
  const criteria = rfq.evaluationCriteria ?? [];
  const responses = rfq.responses ?? [];
  const lowestPrice = responses.length > 0 ? Math.min(...responses.map((r: any) => parseFloat(r.totalAmount))) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/rfqs")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{rfq.title}</h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">{rfq.rfqNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${st.className}`}>{st.label}</span>
          {canManage && rfq.status === "draft" && (
            <Button onClick={() => setSendDialogOpen(true)} size="sm">
              <Send className="mr-2 h-4 w-4" />Envoyer aux fournisseurs
            </Button>
          )}
          {canManage && rfq.status === "sent" && responses.length > 0 && (
            <Button onClick={() => setAwardDialogOpen(true)} size="sm" className="bg-green-600 hover:bg-green-700">
              <Award className="mr-2 h-4 w-4" />Attribuer le marché
            </Button>
          )}
        </div>
      </div>

      {/* Key info cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Date limite", value: fmtDate(rfq.deadline), alert: isOverdue },
          { label: "Fournisseurs invités", value: rfq.vendors?.length ?? 0 },
          { label: "Réponses reçues", value: responses.length },
          { label: "Attribué à", value: rfq.awardedVendorId ? `Fournisseur #${rfq.awardedVendorId}` : "—" },
        ].map((k, i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
              <p className={`text-lg font-semibold mt-1 ${k.alert ? "text-red-600" : ""}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items">Articles</TabsTrigger>
          <TabsTrigger value="vendors">
            Fournisseurs
            <span className="ml-2 text-xs bg-muted px-1.5 rounded-full">{rfq.vendors?.length ?? 0}</span>
          </TabsTrigger>
          <TabsTrigger value="responses">
            Réponses
            <span className="ml-2 text-xs bg-muted px-1.5 rounded-full">{responses.length}</span>
          </TabsTrigger>
          {criteria.length > 0 && <TabsTrigger value="comparison">Comparaison</TabsTrigger>}
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        {/* Items */}
        <TabsContent value="items">
          <Card>
            <CardHeader><CardTitle>Articles demandés</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Désignation</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Prix estimé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rfq.items ?? []).map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.description || "—"}</TableCell>
                      <TableCell className="text-right">{item.quantity} {item.unit || "pcs"}</TableCell>
                      <TableCell className="text-right">
                        {item.estimatedUnitPrice ? `${fmt(item.estimatedUnitPrice)} XOF` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendors */}
        <TabsContent value="vendors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Fournisseurs invités</CardTitle></div>
              {canManage && rfq.status === "draft" && (
                <Button size="sm" variant="outline" onClick={() => setAddVendorOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />Ajouter
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {rfq.vendors?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Invité le</TableHead>
                      <TableHead>Répondu le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rfq.vendors.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.vendor?.legalName ?? `#${v.vendorId}`}</TableCell>
                        <TableCell>
                          <Badge variant={v.status === "responded" ? "default" : v.status === "declined" ? "destructive" : "secondary"}>
                            {v.status === "invited" ? "Invité" : v.status === "responded" ? "A répondu" : "A décliné"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{fmtDate(v.invitedAt)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{v.respondedAt ? fmtDate(v.respondedAt) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-muted-foreground">Aucun fournisseur invité</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Responses */}
        <TabsContent value="responses">
          <div className="space-y-4">
            {responses.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Aucune réponse reçue</CardContent></Card>
            ) : (
              responses.map((r: any) => (
                <Card key={r.id} className={r.isAwarded ? "border-green-300 bg-green-50/30" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{r.vendor?.legalName ?? `Fournisseur #${r.vendorId}`}</CardTitle>
                        <CardDescription>Réponse soumise le {fmtDate(r.createdAt)}</CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{fmt(r.totalAmount)} XOF</p>
                        {lowestPrice > 0 && parseFloat(r.totalAmount) === lowestPrice && (
                          <Badge className="bg-green-100 text-green-800 border-green-200 mt-1">Moins-disant</Badge>
                        )}
                        {r.isAwarded && <Badge className="bg-green-600 text-white ml-2">Attribué</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">Délai livraison:</span> <span className="font-medium">{r.deliveryDays ? `${r.deliveryDays} jours` : "—"}</span></div>
                      <div><span className="text-muted-foreground">Valide jusqu'au:</span> <span className="font-medium">{r.validUntil ? fmtDate(r.validUntil) : "—"}</span></div>
                    </div>
                    {r.notes && <p className="mt-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{r.notes}</p>}
                    {r.totalScore && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Score global</span>
                          <span className="font-medium">{r.totalScore}/100</span>
                        </div>
                        <Progress value={parseFloat(r.totalScore)} className="h-2" />
                      </div>
                    )}
                    {/* Inline scoring for each criterion */}
                    {!r.totalScore && criteria.length > 0 && canManage && rfq.status === "sent" && (
                      <ScoreResponseInline
                        responseId={r.id}
                        criteria={criteria}
                        onScored={() => utils.rfqs.getById.invalidate({ id: numId })}
                      />
                    )}
                    {/* Line items */}
                    {r.lineItems?.length > 0 && (
                      <div className="mt-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Article</TableHead>
                              <TableHead className="text-right">Prix unitaire</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {r.lineItems.map((li: any) => (
                              <TableRow key={li.id}>
                                <TableCell>#{li.rfqItemId}</TableCell>
                                <TableCell className="text-right">{fmt(li.unitPrice)} XOF</TableCell>
                                <TableCell className="text-right">{fmt(li.totalPrice)} XOF</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Comparison matrix */}
        {criteria.length > 0 && (
          <TabsContent value="comparison">
            <Card>
              <CardHeader>
                <CardTitle>Matrice de comparaison</CardTitle>
                <CardDescription>Évaluation pondérée des offres selon vos critères</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {responses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Aucune réponse à comparer</p>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium">Critère</th>
                        <th className="text-right py-2 px-2 text-muted-foreground">Poids</th>
                        {responses.map((r: any) => (
                          <th key={r.id} className="text-right py-2 px-3 font-medium">
                            {r.vendor?.legalName ?? `#${r.vendorId}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {criteria.map((c: any, ci: number) => (
                        <tr key={ci} className="border-b">
                          <td className="py-2 pr-4">{c.name}</td>
                          <td className="text-right py-2 px-2 text-muted-foreground">{c.weight}%</td>
                          {responses.map((r: any) => {
                            const score = r.scores?.[c.name];
                            return (
                              <td key={r.id} className="text-right py-2 px-3">
                                {score != null ? (
                                  <div className="flex flex-col items-end">
                                    <span className="font-medium">{score}/10</span>
                                    <span className="text-xs text-muted-foreground">{((score * c.weight) / 10).toFixed(1)} pts</span>
                                  </div>
                                ) : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Totals */}
                      <tr className="font-semibold bg-muted/30">
                        <td className="py-2 pr-4" colSpan={2}>Score total</td>
                        {responses.map((r: any) => (
                          <td key={r.id} className="text-right py-2 px-3">
                            {r.totalScore ? `${r.totalScore}/100` : "—"}
                          </td>
                        ))}
                      </tr>
                      <tr className="text-muted-foreground text-xs">
                        <td className="py-2 pr-4" colSpan={2}>Montant</td>
                        {responses.map((r: any) => (
                          <td key={r.id} className={`text-right py-2 px-3 ${parseFloat(r.totalAmount) === lowestPrice ? "text-green-600 font-medium" : ""}`}>
                            {fmt(r.totalAmount)} XOF
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* History */}
        <TabsContent value="history">
          <EntityHistory entries={history || []} isLoading={histLoading} />
        </TabsContent>
      </Tabs>

      {/* Send Dialog */}
      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer le RFQ aux fournisseurs ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cela notifiera les {rfq.vendors?.length ?? 0} fournisseur(s) invité(s) et ouvrira la période de réponse jusqu'au {fmtDate(rfq.deadline)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => sendMutation.mutate({ id: numId })} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? "Envoi..." : "Envoyer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Award Dialog */}
      <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribuer le marché</DialogTitle>
            <DialogDescription>Sélectionnez l'offre retenue pour ce RFQ</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {responses.map((r: any) => (
              <label key={r.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${awardResponseId === r.id ? "border-primary bg-primary/5" : ""}`}>
                <input type="radio" name="award" value={r.id} checked={awardResponseId === r.id}
                  onChange={() => { setAwardResponseId(r.id); setAwardVendorId(String(r.vendorId)); }} />
                <div className="flex-1">
                  <p className="font-medium">{r.vendor?.legalName}</p>
                  <p className="text-sm text-muted-foreground">{fmt(r.totalAmount)} XOF{r.deliveryDays ? ` · ${r.deliveryDays}j` : ""}</p>
                </div>
                {parseFloat(r.totalAmount) === lowestPrice && <Badge className="bg-green-100 text-green-800">Moins-disant</Badge>}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardDialogOpen(false)}>Annuler</Button>
            <Button className="btn-primary text-white"
              disabled={!awardResponseId || awardMutation.isPending}
              onClick={() => awardMutation.mutate({ rfqId: numId, responseId: awardResponseId!, vendorId: parseInt(awardVendorId) })}
              className="bg-green-600 hover:bg-green-700"
            >
              {awardMutation.isPending ? "Attribution..." : "Attribuer le marché"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vendor Dialog */}
      <Dialog open={addVendorOpen} onOpenChange={setAddVendorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un fournisseur</DialogTitle>
          </DialogHeader>
          <Select value={addVendorId} onValueChange={setAddVendorId}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur actif" /></SelectTrigger>
            <SelectContent>
              {vendors?.filter(v => !invitedVendorIds.has(v.id)).map(v => (
                <SelectItem key={v.id} value={String(v.id)}>{v.legalName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddVendorOpen(false)}>Annuler</Button>
            <Button className="btn-primary text-white" disabled={!addVendorId || addVendorMutation.isPending}
              onClick={() => addVendorMutation.mutate({ rfqId: numId, vendorId: parseInt(addVendorId) })}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
