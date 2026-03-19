import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, FileText } from "lucide-react";

interface HistoryEntry {
  id: number;
  action: string;
  actorName: string | null;
  actorId: number;
  createdAt: Date;
  oldValue?: any;
  newValue?: any;
}

interface EntityHistoryProps {
  entries: HistoryEntry[];
  isLoading?: boolean;
}

export function EntityHistory({ entries, isLoading }: EntityHistoryProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      created: "Créé",
      updated: "Modifié",
      submitted: "Soumis pour approbation",
      approved: "Approuvé",
      rejected: "Rejeté",
      issued: "Émis",
      received: "Reçu",
      paid: "Payé",
      cancelled: "Annulé",
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string): string => {
    const colors: Record<string, string> = {
      created: "bg-blue-100 text-blue-800",
      updated: "bg-gray-100 text-gray-800",
      submitted: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      issued: "bg-purple-100 text-purple-800",
      received: "bg-indigo-100 text-indigo-800",
      paid: "bg-emerald-100 text-emerald-800",
      cancelled: "bg-orange-100 text-orange-800",
    };
    return colors[action] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historique
          </CardTitle>
          <CardDescription>Chargement de l'historique...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historique
          </CardTitle>
          <CardDescription>Historique des actions effectuées sur cet enregistrement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p>Aucun historique disponible</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historique
        </CardTitle>
        <CardDescription>
          Historique des actions effectuées sur cet enregistrement ({entries.length} {entries.length > 1 ? 'entrées' : 'entrée'})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex gap-4 pb-4 ${
                index !== entries.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                {index !== entries.length - 1 && (
                  <div className="w-0.5 flex-1 bg-border mt-2" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getActionColor(entry.action)}>
                      {getActionLabel(entry.action)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {entry.actorName || `Utilisateur #${entry.actorId}`}
                  </span>
                </div>

                {/* Show changes if available */}
                {entry.newValue && typeof entry.newValue === 'object' && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {Object.keys(entry.newValue).length > 0 && (
                      <div className="bg-muted/50 rounded p-2 mt-1">
                        <p className="font-medium mb-1">Modifications:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {Object.entries(entry.newValue).slice(0, 3).map(([key, value]) => (
                            <li key={key}>
                              <span className="font-medium">{key}:</span> {String(value)}
                            </li>
                          ))}
                          {Object.keys(entry.newValue).length > 3 && (
                            <li className="text-xs">
                              ... et {Object.keys(entry.newValue).length - 3} autres modifications
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
