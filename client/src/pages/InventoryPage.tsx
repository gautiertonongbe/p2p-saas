import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { Plus, Package, AlertTriangle, Warehouse, ArrowUp, ArrowDown, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

export default function InventoryPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newWarehouseOpen, setNewWarehouseOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<any>(null);

  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [reorderLevel, setReorderLevel] = useState("");

  const [whCode, setWhCode] = useState("");
  const [whName, setWhName] = useState("");
  const [whLocation, setWhLocation] = useState("");

  const [adjustWarehouseId, setAdjustWarehouseId] = useState<string>("");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState<"in" | "out" | "adjustment">("in");

  const { data: items, isLoading } = trpc.inventory.listItems.useQuery();
  const { data: warehouses } = trpc.inventory.listWarehouses.useQuery();
  const { data: alerts } = trpc.inventory.getLowStockAlerts.useQuery();

  const canManage = user?.role === "admin" || user?.role === "procurement_manager";

  const createItemMutation = trpc.inventory.createItem.useMutation({
    onSuccess: () => { toast.success("Article créé"); utils.inventory.listItems.invalidate(); setNewItemOpen(false); setItemCode(""); setItemName(""); setUnit("pcs"); setReorderLevel(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const createWhMutation = trpc.inventory.createWarehouse.useMutation({
    onSuccess: () => { toast.success("Entrepôt créé"); utils.inventory.listWarehouses.invalidate(); setNewWarehouseOpen(false); setWhCode(""); setWhName(""); setWhLocation(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const adjustMutation = trpc.inventory.adjustStock.useMutation({
    onSuccess: (d) => { toast.success(`Stock mis à jour → ${fmt(d.newQuantity)} ${adjustItem?.unit ?? "pcs"}`); utils.inventory.listItems.invalidate(); utils.inventory.getLowStockAlerts.invalidate(); setAdjustOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdjust = (item: any) => {
    setAdjustItem(item);
    setAdjustQty("");
    setAdjustType("in");
    setAdjustWarehouseId(warehouses?.[0]?.id ? String(warehouses[0].id) : "");
    setAdjustOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={<Package className="h-5 w-5" />} title="Inventaire" description="Gestion des stocks" />
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Inventaire</h1>
          <p className="text-muted-foreground mt-1">Gérer les stocks par entrepôt</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setNewWarehouseOpen(true)}>
              <Warehouse className="mr-2 h-4 w-4" />Entrepôt
            </Button>
            <Button size="sm" onClick={() => setNewItemOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Nouvel article
            </Button>
          </div>
        )}
      </div>

      {/* Low stock alerts */}
      {alerts && alerts.length > 0 && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-orange-900">{alerts.length} article(s) en rupture de stock imminente</p>
            <p className="text-sm text-orange-700 mt-1">
              {alerts.slice(0, 3).map((a: any) => a.itemName).join(", ")}{alerts.length > 3 ? ` et ${alerts.length - 3} autres` : ""}
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items">Articles <span className="ml-2 text-xs bg-muted px-1.5 rounded-full">{items?.length ?? 0}</span></TabsTrigger>
          <TabsTrigger value="warehouses">Entrepôts <span className="ml-2 text-xs bg-muted px-1.5 rounded-full">{warehouses?.length ?? 0}</span></TabsTrigger>
          {(alerts?.length ?? 0) > 0 && (
            <TabsTrigger value="alerts" className="text-orange-600">
              Alertes <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 rounded-full">{alerts?.length}</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Chargement...</div>
              ) : items && items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Désignation</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead className="text-right">Stock total</TableHead>
                      <TableHead className="text-right">Seuil alerte</TableHead>
                      <TableHead>Niveau</TableHead>
                      {canManage && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any) => {
                      const pct = item.reorderLevel ? Math.min(100, (item.totalQuantity / (item.reorderLevel * 3)) * 100) : 100;
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-sm">{item.itemCode}</TableCell>
                          <TableCell className="font-medium">
                            {item.itemName}
                            {item.isLowStock && <Badge className="ml-2 bg-orange-100 text-orange-800 text-xs">Stock bas</Badge>}
                          </TableCell>
                          <TableCell>{item.unit ?? "—"}</TableCell>
                          <TableCell className={`text-right font-medium ${item.isLowStock ? "text-orange-600" : ""}`}>
                            {fmt(item.totalQuantity)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.reorderLevel ? fmt(parseFloat(item.reorderLevel)) : "—"}
                          </TableCell>
                          <TableCell className="w-32">
                            <Progress value={pct} className={`h-1.5 ${item.isLowStock ? "[&>div]:bg-orange-500" : ""}`} />
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openAdjust(item)}>
                                <Settings2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground/40" />
                  <p className="mt-4 font-medium text-muted-foreground">Aucun article en stock</p>
                  {canManage && (
                    <Button onClick={() => setNewItemOpen(true)} className="mt-4" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />Créer un article
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warehouses Tab */}
        <TabsContent value="warehouses">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {warehouses?.map((wh: any) => (
              <Card key={wh.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg"><Warehouse className="h-5 w-5 text-blue-600" /></div>
                    <div>
                      <p className="font-semibold">{wh.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{wh.code}</p>
                      {wh.location && <p className="text-sm text-muted-foreground mt-1">{wh.location}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {canManage && (
              <Card className="border-dashed cursor-pointer hover:bg-muted/30" onClick={() => setNewWarehouseOpen(true)}>
                <CardContent className="pt-5 flex items-center justify-center gap-2 text-muted-foreground">
                  <Plus className="h-4 w-4" /><span className="text-sm">Nouvel entrepôt</span>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader><CardTitle>Articles en rupture imminente</CardTitle><CardDescription>Stock actuel ≤ niveau de réapprovisionnement</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead className="text-right">Stock actuel</TableHead>
                    <TableHead className="text-right">Seuil alerte</TableHead>
                    <TableHead className="text-right">Écart</TableHead>
                    {canManage && <TableHead className="text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts?.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div><p className="font-medium">{a.itemName}</p><p className="text-xs font-mono text-muted-foreground">{a.itemCode}</p></div>
                      </TableCell>
                      <TableCell className="text-right text-orange-600 font-medium">{fmt(a.currentQuantity)}</TableCell>
                      <TableCell className="text-right">{fmt(a.reorderLevel)}</TableCell>
                      <TableCell className="text-right text-red-600 font-medium">-{fmt(a.reorderLevel - a.currentQuantity)}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openAdjust(a)}>
                            <ArrowUp className="mr-1 h-3.5 w-3.5" />Entrée stock
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Item Dialog */}
      <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvel article</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Code article *</Label><Input value={itemCode} onChange={e => setItemCode(e.target.value)} placeholder="ART-001" /></div>
              <div className="space-y-1"><Label>Unité</Label><Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs, kg, m…" /></div>
            </div>
            <div className="space-y-1"><Label>Désignation *</Label><Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Nom de l'article" /></div>
            <div className="space-y-1"><Label>Seuil d'alerte</Label><Input type="number" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} placeholder="Quantité minimum avant alerte" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewItemOpen(false)}>Annuler</Button>
            <Button disabled={!itemCode.trim() || !itemName.trim() || createItemMutation.isPending}
              onClick={() => createItemMutation.mutate({ itemCode, itemName, unit: unit || undefined, reorderLevel: reorderLevel ? parseFloat(reorderLevel) : undefined })}>
              {createItemMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Warehouse Dialog */}
      <Dialog open={newWarehouseOpen} onOpenChange={setNewWarehouseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvel entrepôt</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Code *</Label><Input value={whCode} onChange={e => setWhCode(e.target.value)} placeholder="WH-001" /></div>
              <div className="space-y-1"><Label>Nom *</Label><Input value={whName} onChange={e => setWhName(e.target.value)} placeholder="Entrepôt principal" /></div>
            </div>
            <div className="space-y-1"><Label>Localisation</Label><Input value={whLocation} onChange={e => setWhLocation(e.target.value)} placeholder="Cotonou, Zone industrielle…" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewWarehouseOpen(false)}>Annuler</Button>
            <Button disabled={!whCode.trim() || !whName.trim() || createWhMutation.isPending}
              onClick={() => createWhMutation.mutate({ code: whCode, name: whName, location: whLocation || undefined })}>
              {createWhMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mouvement de stock</DialogTitle>
            <DialogDescription>{adjustItem?.itemName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Type de mouvement</Label>
              <div className="flex gap-3">
                {[{ v: "in", label: "Entrée", icon: ArrowUp, cls: "text-green-700 border-green-300 bg-green-50" },
                  { v: "out", label: "Sortie", icon: ArrowDown, cls: "text-red-700 border-red-300 bg-red-50" },
                  { v: "adjustment", label: "Ajustement", icon: Settings2, cls: "text-blue-700 border-blue-300 bg-blue-50" }
                ].map(opt => (
                  <button key={opt.v} onClick={() => setAdjustType(opt.v as any)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${adjustType === opt.v ? opt.cls : "border-border hover:bg-muted/50"}`}>
                    <opt.icon className="h-4 w-4" />{opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Entrepôt *</Label>
              <Select value={adjustWarehouseId} onValueChange={setAdjustWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un entrepôt" /></SelectTrigger>
                <SelectContent>
                  {warehouses?.map((wh: any) => <SelectItem key={wh.id} value={String(wh.id)}>{wh.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{adjustType === "adjustment" ? "Nouvelle quantité *" : "Quantité *"}</Label>
              <Input type="number" min="0" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Annuler</Button>
            <Button disabled={!adjustQty || !adjustWarehouseId || adjustMutation.isPending}
              onClick={() => adjustMutation.mutate({ itemId: adjustItem.id, warehouseId: parseInt(adjustWarehouseId), quantity: parseFloat(adjustQty), type: adjustType })}>
              {adjustMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
