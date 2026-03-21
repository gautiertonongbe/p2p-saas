import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { Plus, Search, FileText, Users, Clock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import {
import { PageHeader } from "@/components/PageHeader";
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft:     { label: "Brouillon",  className: "bg-gray-100 text-gray-700 border-gray-200" },
  sent:      { label: "Envoyé",     className: "bg-blue-100 text-blue-800 border-blue-200" },
  closed:    { label: "Clôturé",    className: "bg-orange-100 text-orange-800 border-orange-200" },
  awarded:   { label: "Attribué",   className: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "Annulé",     className: "bg-red-100 text-red-800 border-red-200" },
};

const formatDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" });

export default function RFQsList() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: rfqs, isLoading } = trpc.rfqs.list.useQuery();

  const filtered = rfqs?.filter(r =>
    r.rfqNumber.toLowerCase().includes(search.toLowerCase()) ||
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: rfqs?.length ?? 0,
    sent: rfqs?.filter(r => r.status === "sent").length ?? 0,
    awarded: rfqs?.filter(r => r.status === "awarded").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={<ClipboardList className="h-5 w-5" />} title="Appels d'offres" description="Demandes de cotation" />
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Appels d'offres</h1>
          <p className="text-muted-foreground mt-1">Gérer vos demandes de cotation (RFQ)</p>
        </div>
        <Button onClick={() => setLocation("/rfqs/new")} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau RFQ
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total RFQs", value: stats.total, icon: FileText, color: "bg-blue-100 text-blue-600" },
          { label: "En cours", value: stats.sent, icon: Clock, color: "bg-orange-100 text-orange-600" },
          { label: "Attribués", value: stats.awarded, icon: CheckCircle2, color: "bg-green-100 text-green-600" },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher un RFQ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : filtered && filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° RFQ</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Fournisseurs</TableHead>
                  <TableHead>Réponses</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(rfq => {
                  const s = STATUS_MAP[rfq.status] ?? STATUS_MAP.draft;
                  const isOverdue = rfq.status === "sent" && new Date(rfq.deadline) < new Date();
                  return (
                    <TableRow key={rfq.id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setLocation(`/rfqs/${rfq.id}`)}>
                      <TableCell className="font-mono text-sm">{rfq.rfqNumber}</TableCell>
                      <TableCell className="font-medium">{rfq.title}</TableCell>
                      <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>
                        {formatDate(rfq.deadline)}
                        {isOverdue && <span className="ml-1 text-xs">(en retard)</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{rfq.vendorCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>{rfq.responseCount}</TableCell>
                      <TableCell>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.className}`}>
                          {s.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setLocation(`/rfqs/${rfq.id}`); }}>
                          Voir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-4 font-medium text-muted-foreground">Aucun appel d'offres</p>
              <p className="text-sm text-muted-foreground mt-1">Créez votre premier RFQ pour comparer les offres fournisseurs</p>
              <Button onClick={() => setLocation("/rfqs/new")} className="mt-4" variant="outline">
                <Plus className="mr-2 h-4 w-4" />Nouveau RFQ
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
