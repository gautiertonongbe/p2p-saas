import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { Save, Send, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PurchaseOrderForm() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const requestId = searchParams ? new URLSearchParams(searchParams).get('requestId') : null;
  
  const utils = trpc.useUtils();

  const [vendorId, setVendorId] = useState<number>(0);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  // Fetch approved requests
  const { data: approvedRequests } = trpc.purchaseRequests.list.useQuery({
    status: "approved"
  });

  // Fetch vendors
  const { data: vendors } = trpc.vendors.list.useQuery();

  // Fetch request details if requestId is provided
  const { data: requestDetails } = trpc.purchaseRequests.getById.useQuery(
    { id: parseInt(requestId!) },
    { enabled: !!requestId }
  );

  const { data: requestItems } = trpc.purchaseRequests.getRequestItems.useQuery(
    { requestId: parseInt(requestId!) },
    { enabled: !!requestId }
  );

  useEffect(() => {
    if (requestDetails && requestItems) {
      setSelectedRequest({ ...requestDetails, items: requestItems });
    }
  }, [requestDetails, requestItems]);

  const createMutation = trpc.purchaseOrders.create.useMutation({
    onSuccess: () => {
      toast.success(t('success.created'));
      utils.purchaseOrders.list.invalidate();
      setLocation("/purchase-orders");
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const handleSubmit = async () => {
    if (!vendorId) {
      toast.error("Veuillez sélectionner un fournisseur");
      return;
    }

    if (!selectedRequest) {
      toast.error("Veuillez sélectionner une demande d'achat");
      return;
    }

    await createMutation.mutateAsync({
      requestId: selectedRequest.id,
      vendorId,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      notes: notes || undefined,
      items: selectedRequest.items.map((item: any) => ({
        itemName: item.itemName,
        description: item.description || undefined,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        unit: item.unit || undefined,
      })),
    });
  };

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('fr-FR').format(Number(amount));
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('purchaseOrders.new')}</h1>
        <p className="text-muted-foreground mt-2">Créer un bon de commande à partir d'une demande approuvée</p>
      </div>

      {/* Select Request */}
      {!requestId && (
        <Card>
          <CardHeader>
            <CardTitle>Sélectionner une demande d'achat</CardTitle>
            <CardDescription>Choisir une demande approuvée pour créer un bon de commande</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedRequest?.id?.toString() || ""}
              onValueChange={(value) => {
                const request = approvedRequests?.find(r => r.id === parseInt(value));
                if (request) {
                  setSelectedRequest({ ...request, items: [] });
                  // Items will be fetched by the useQuery hook above
                  setLocation(`/purchase-orders/new?requestId=${request.id}`);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une demande" />
              </SelectTrigger>
              <SelectContent>
                {approvedRequests?.map((request) => (
                  <SelectItem key={request.id} value={request.id.toString()}>
                    {request.requestNumber} - {request.title} ({formatCurrency(request.amountEstimate)} XOF)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Request Details */}
      {selectedRequest && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Détails de la demande</CardTitle>
              <CardDescription>{selectedRequest.requestNumber}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Titre</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.title}</p>
                </div>
                {selectedRequest.description && (
                  <div>
                    <p className="text-sm font-medium">Description</p>
                    <p className="text-sm text-muted-foreground">{selectedRequest.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Montant estimé</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(selectedRequest.amountEstimate)} XOF</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Articles</CardTitle>
              <CardDescription>Articles à inclure dans le bon de commande</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedRequest.items && selectedRequest.items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Prix unitaire</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedRequest.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell className="text-muted-foreground">{item.description || '-'}</TableCell>
                        <TableCell className="text-right">{item.quantity} {item.unit || 'pcs'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)} XOF</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(item.quantity) * Number(item.unitPrice))} XOF
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-bold">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {formatCurrency(selectedRequest.amountEstimate)} XOF
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun article trouvé
                </div>
              )}
            </CardContent>
          </Card>

          {/* PO Details */}
          <Card>
            <CardHeader>
              <CardTitle>Informations du bon de commande</CardTitle>
              <CardDescription>Détails supplémentaires pour le bon de commande</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Fournisseur *</Label>
                <Select value={vendorId.toString()} onValueChange={(value) => setVendorId(parseInt(value))}>
                  <SelectTrigger id="vendor">
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
                <Label htmlFor="deliveryDate">Date de livraison prévue</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instructions spéciales, conditions de livraison, etc."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setLocation("/purchase-orders")}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              Créer le bon de commande
            </Button>
          </div>
        </>
      )}

      {!selectedRequest && requestId && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              {t('common.loading')}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
