import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, Clock, ArrowDown, Users, MessageSquare, Calendar, Shield, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ApprovalStep {
  id: number;
  stepOrder: number;
  approverId: number;
  decision: "pending" | "approved" | "rejected" | "delegated";
  comment?: string | null;
  decidedAt?: Date | null;
  dueAt?: Date | null;
  approver?: {
    id: number;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    avatarUrl?: string | null;
    approvalLimit?: string | null;
    departmentId?: number | null;
  } | null;
  // Why this approver was brought in
  policyName?: string | null;
  approverType?: "role" | "user" | "manager" | null;
  isParallel?: boolean;
}

interface ApprovalChainVisualizationProps {
  approvals: ApprovalStep[];
  currentStep?: number;
  requestAmount?: number;
}

function getInitials(name?: string | null) {
  if (!name) return "??";
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

function getRoleLabel(role?: string | null) {
  const map: Record<string, string> = {
    admin: "Administrateur",
    procurement_manager: "Resp. Achats",
    approver: "Approbateur",
    requester: "Demandeur",
  };
  return role ? (map[role] || role) : "—";
}

function getApproverTypeLabel(type?: string | null) {
  const map: Record<string, string> = {
    role: "Sélectionné par rôle",
    user: "Désigné nominativement",
    manager: "Responsable hiérarchique",
  };
  return type ? (map[type] || type) : "Règle d'approbation";
}

function ApproverCard({ approval, isActive }: { approval: ApprovalStep; isActive: boolean }) {
  const { t } = useTranslation();
  const avatarUrl = (approval.approver as any)?.avatarUrl;

  const borderColor =
    approval.decision === "approved" ? "border-emerald-300 bg-emerald-50" :
    approval.decision === "rejected" ? "border-rose-300 bg-rose-50" :
    isActive ? "border-primary/40 bg-primary/5 ring-2 ring-primary/20" :
    "border-slate-200 bg-slate-50";

  const avatarRing =
    approval.decision === "approved" ? "ring-2 ring-emerald-400" :
    approval.decision === "rejected" ? "ring-2 ring-rose-400" :
    isActive ? "ring-2 ring-primary" : "";

  const statusIcon =
    approval.decision === "approved" ? <Check className="h-3.5 w-3.5 text-white" /> :
    approval.decision === "rejected" ? <X className="h-3.5 w-3.5 text-white" /> :
    isActive ? <Clock className="h-3.5 w-3.5 text-white" /> : null;

  const statusColor =
    approval.decision === "approved" ? "bg-emerald-500" :
    approval.decision === "rejected" ? "bg-rose-500" :
    isActive ? "bg-primary" : "bg-slate-300";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-default ${borderColor}`}>
            {/* Avatar with status dot */}
            <div className="relative shrink-0">
              <Avatar className={`h-10 w-10 ${avatarRing} transition-all`}>
                <AvatarImage src={avatarUrl} alt={approval.approver?.name || ""} />
                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                  {getInitials(approval.approver?.name)}
                </AvatarFallback>
              </Avatar>
              {statusIcon && (
                <div className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full ${statusColor} flex items-center justify-center border-2 border-white shadow-sm`}>
                  {statusIcon}
                </div>
              )}
            </div>

            {/* Name + role */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {approval.approver?.name || t('approvals.chain.unknownApprover')}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {getRoleLabel(approval.approver?.role)}
              </p>
              {approval.comment && (
                <p className="text-xs text-muted-foreground mt-0.5 italic truncate">
                  "{approval.comment}"
                </p>
              )}
            </div>

            {/* Status badge */}
            <div className="shrink-0">
              {approval.decision === "approved" && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">Approuvé</Badge>}
              {approval.decision === "rejected" && <Badge className="bg-rose-100 text-rose-700 border-rose-300 text-xs">Rejeté</Badge>}
              {approval.decision === "pending" && isActive && <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">En attente</Badge>}
              {approval.decision === "pending" && !isActive && <Badge variant="outline" className="text-xs text-muted-foreground">À venir</Badge>}
            </div>
          </div>
        </TooltipTrigger>

        {/* Rich tooltip */}
        <TooltipContent side="right" className="w-72 p-0 shadow-xl rounded-xl overflow-hidden" sideOffset={8}>
          {/* Header with avatar */}
          <div className="bg-gradient-to-br from-primary/90 to-primary/70 p-4 flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-white/50">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-sm font-bold bg-white/20 text-white">
                {getInitials(approval.approver?.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold text-white">{approval.approver?.name || "Approbateur"}</p>
              <p className="text-white/70 text-xs">{approval.approver?.email}</p>
              <Badge className="mt-1 bg-white/20 text-white border-0 text-xs">
                {getRoleLabel(approval.approver?.role)}
              </Badge>
            </div>
          </div>

          <div className="p-3 space-y-2.5 bg-background">
            {/* Why brought in */}
            <div className="flex items-start gap-2">
              <Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Pourquoi cet approbateur ?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {getApproverTypeLabel(approval.approverType)}
                  {approval.policyName && ` — Politique: ${approval.policyName}`}
                </p>
              </div>
            </div>

            {/* Approval limit */}
            {approval.approver?.approvalLimit && (
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Limite d'approbation</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(approval.approver.approvalLimit).toLocaleString()} XOF
                  </p>
                </div>
              </div>
            )}

            {/* Decision date */}
            {approval.decidedAt && (
              <div className="flex items-start gap-2">
                <Calendar className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Décision prise le</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(approval.decidedAt).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
            )}

            {/* Due date */}
            {approval.dueAt && approval.decision === "pending" && (
              <div className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-rose-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Délai d'approbation</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(approval.dueAt).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
            )}

            {/* Comment */}
            {approval.comment && (
              <div className="flex items-start gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Commentaire</p>
                  <p className="text-xs text-muted-foreground italic">"{approval.comment}"</p>
                </div>
              </div>
            )}

            {/* Step info */}
            <div className="pt-1.5 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Étape {approval.stepOrder}</span>
              {approval.isParallel && (
                <Badge variant="outline" className="text-xs">Parallèle</Badge>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ApprovalChainVisualization({ approvals, currentStep = 1, requestAmount }: ApprovalChainVisualizationProps) {
  const { t } = useTranslation();

  const stepGroups = approvals.reduce((acc, approval) => {
    if (!acc[approval.stepOrder]) acc[approval.stepOrder] = [];
    acc[approval.stepOrder].push(approval);
    return acc;
  }, {} as Record<number, ApprovalStep[]>);

  const sortedSteps = Object.keys(stepGroups).map(Number).sort((a, b) => a - b);

  const getStepStatus = (step: ApprovalStep[]) => {
    if (step.every(a => a.decision === "approved")) return "approved";
    if (step.some(a => a.decision === "rejected")) return "rejected";
    if (step.some(a => a.decision === "pending")) return "pending";
    return "pending";
  };

  if (approvals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('approvals.chain.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('approvals.chain.noApprovals')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="bg-primary/10 rounded-lg p-1.5">
            <Users className="h-4 w-4 text-primary" />
          </div>
          Chaîne d'approbation
          <Badge variant="outline" className="ml-auto text-xs">
            {sortedSteps.length} étape{sortedSteps.length > 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sortedSteps.map((stepOrder, index) => {
            const stepApprovals = stepGroups[stepOrder];
            const stepStatus = getStepStatus(stepApprovals);
            const isCurrentStep = stepOrder === currentStep;
            const isParallel = stepApprovals.length > 1;

            return (
              <div key={stepOrder}>
                {/* Step label */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border-2 ${
                    stepStatus === "approved" ? "border-emerald-500 bg-emerald-500 text-white" :
                    stepStatus === "rejected" ? "border-rose-500 bg-rose-500 text-white" :
                    isCurrentStep ? "border-primary bg-primary text-white" :
                    "border-slate-300 bg-white text-slate-500"
                  }`}>
                    {stepStatus === "approved" ? <Check className="h-3 w-3" /> :
                     stepStatus === "rejected" ? <X className="h-3 w-3" /> :
                     stepOrder}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Étape {stepOrder}
                    {isParallel && " · Approbation parallèle"}
                    {isCurrentStep && " · En cours"}
                  </span>
                </div>

                {/* Approver cards */}
                <div className="ml-8 space-y-1.5">
                  {stepApprovals.map(approval => (
                    <ApproverCard
                      key={approval.id}
                      approval={{ ...approval, isParallel }}
                      isActive={isCurrentStep && approval.decision === "pending"}
                    />
                  ))}
                </div>

                {/* Arrow between steps */}
                {index < sortedSteps.length - 1 && (
                  <div className="flex justify-start ml-11 my-1">
                    <ArrowDown className="h-4 w-4 text-slate-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary footer */}
        <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>{approvals.filter(a => a.decision === "approved").length}/{approvals.length} approbations reçues</span>
          {requestAmount && <span className="font-medium text-foreground">{Number(requestAmount).toLocaleString()} XOF</span>}
        </div>
      </CardContent>
    </Card>
  );
}
