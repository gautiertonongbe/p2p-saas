import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Clock, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SecuritySettings() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: auditLogs, isLoading } = trpc.settings.getAuditLogs.useQuery({
    limit: 50,
  });

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionBadge = (action: string) => {
    const actionColors: Record<string, string> = {
      created: "bg-green-100 text-green-800",
      updated: "bg-blue-100 text-blue-800",
      deleted: "bg-red-100 text-red-800",
      approved: "bg-emerald-100 text-emerald-800",
      rejected: "bg-orange-100 text-orange-800",
    };

    return (
      <Badge variant="outline" className={actionColors[action] || "bg-gray-100 text-gray-800"}>
        {action}
      </Badge>
    );
  };

  const filteredLogs = auditLogs?.filter((log: any) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.entityType.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      log.actorName?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Sécurité et authentification
        </h2>
        <p className="text-muted-foreground">
          Gérez les paramètres de sécurité et consultez les journaux d'audit
        </p>
      </div>

      {/* Authentication Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Authentification OAuth
          </CardTitle>
          <CardDescription>
            Statut de l'authentification et des politiques de sécurité
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-900">Authentification OAuth activée</p>
              <p className="text-sm text-green-700 mt-1">
                Tous les utilisateurs se connectent via le portail OAuth sécurisé de Manus. 
                L'authentification à deux facteurs et les politiques de mot de passe sont gérées 
                automatiquement par le système OAuth.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Délai d'expiration de session</span>
              </div>
              <p className="text-2xl font-semibold">24 heures</p>
              <p className="text-xs text-muted-foreground mt-1">Déconnexion automatique après inactivité</p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Authentification à deux facteurs</span>
              </div>
              <p className="text-2xl font-semibold">Activée</p>
              <p className="text-xs text-muted-foreground mt-1">Gérée par le système OAuth</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Journal d'audit
          </CardTitle>
          <CardDescription>
            Historique des actions effectuées dans le système (50 dernières entrées)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Rechercher par type d'entité, action ou utilisateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement des journaux d'audit...
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Heure</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Type d'entité</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>ID Entité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{log.actorName || `User #${log.actorId}`}</div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {log.entityType}
                        </code>
                      </TableCell>
                      <TableCell>
                        {getActionBadge(log.action)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        #{log.entityId}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                {searchTerm ? "Aucun journal d'audit trouvé pour cette recherche" : "Aucun journal d'audit disponible"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
