import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, Clock, Shield, MessageSquare, AlertCircle, Users, Turtle } from "lucide-react";

interface ApprovalStep {
  id: number;
  stepOrder: number;
  approverId: number;
  decision: "pending" | "approved" | "rejected" | "delegated" | "voided";
  comment?: string | null;
  decidedAt?: Date | null;
  dueAt?: Date | null;
  delegatedFrom?: string | null; // "on behalf of X"
  approver?: {
    id: number;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    avatarUrl?: string | null;
    approvalLimit?: string | null;
  } | null;
  policyName?: string | null;
  approverType?: "role" | "user" | "manager" | null;
  isParallel?: boolean;
}

interface Props {
  approvals: ApprovalStep[];
  currentStep?: number;
  requestAmount?: number;
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" });
}

function pendingDuration(createdAt?: Date | string | null): string | null {
  if (!createdAt) return null;
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}j`;
}

function StepNode({ approval, isActive, isLast, idx }: {
  approval: ApprovalStep; isActive: boolean; isLast: boolean; idx: number;
}) {
  const done     = approval.decision === "approved";
  const rejected = approval.decision === "rejected";
  const voided   = approval.decision === "voided";
  const waiting  = approval.decision === "pending" && isActive;
  const future   = approval.decision === "pending" && !isActive;

  const ring  = done ? "#10b981" : rejected ? "#ef4444" : waiting ? "#3b82f6" : voided ? "#9ca3af" : "#d1d5db";
  const bg    = done ? "#ecfdf5" : rejected ? "#fef2f2" : waiting ? "#eff6ff" : "#f9fafb";
  const label = done ? "Approuvé" : rejected ? "Rejeté" : waiting ? "En attente" : voided ? "Annulé" : "À venir";

  const duration = waiting ? pendingDuration((approval as any).createdAt) : null;

  return (
    <TooltipProvider delayDuration={80}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-1 cursor-default select-none" style={{ minWidth: 82, maxWidth: 108 }}>
            {/* Avatar ring */}
            <div className="relative">
              <div className="rounded-full p-[2px]" style={{ background: ring }}>
                <Avatar className="h-11 w-11" style={{ background: bg }}>
                  <AvatarImage src={(approval.approver as any)?.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs font-bold" style={{ background: bg, color: ring }}>
                    {getInitials(approval.approver?.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              {/* Status icon badge */}
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center"
                style={{ background: ring }}>
                {done     && <Check className="h-2.5 w-2.5 text-white" />}
                {rejected && <X     className="h-2.5 w-2.5 text-white" />}
                {waiting  && <Clock className="h-2.5 w-2.5 text-white animate-pulse" />}
                {future   && <span className="text-white text-[9px] font-bold">{idx + 1}</span>}
              </div>
            </div>

            {/* Name */}
            <p className="text-[11px] font-semibold text-center leading-tight line-clamp-2 mt-1"
              style={{ color: future || voided ? "#9ca3af" : "#111827" }}>
              {approval.approver?.name || "Approbateur"}
            </p>

            {/* On behalf of */}
            {approval.delegatedFrom && (
              <p className="text-[10px] text-muted-foreground text-center italic leading-tight">
                au nom de<br />{approval.delegatedFrom}
              </p>
            )}

            {/* Date / status */}
            {done && approval.decidedAt && (
              <p className="text-[10px] text-emerald-600 font-medium">{fmtDate(approval.decidedAt)}</p>
            )}
            {rejected && approval.decidedAt && (
              <p className="text-[10px] text-red-500 font-medium">{fmtDate(approval.decidedAt)}</p>
            )}
            {waiting && (
              <p className="text-[10px] text-blue-500 font-medium">
                En attente{duration ? ` · ${duration}` : ""}
              </p>
            )}
            {future && (
              <p className="text-[10px] text-gray-400">À venir</p>
            )}
          </div>
        </TooltipTrigger>

        {/* Tooltip detail */}
        <TooltipContent side="bottom" className="w-60 p-0 overflow-hidden rounded-xl shadow-xl border-0">
          <div className="px-3 py-2.5 text-white" style={{ background: ring }}>
            <p className="font-semibold text-sm">{approval.approver?.name || "Approbateur"}</p>
            <p className="text-xs opacity-80">{approval.approver?.email}</p>
            <p className="text-[11px] opacity-70 mt-0.5">{label}</p>
          </div>
          <div className="p-3 space-y-1.5 text-xs bg-white">
            {approval.delegatedFrom && (
              <div className="flex gap-2 items-start">
                <Users className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Au nom de <strong>{approval.delegatedFrom}</strong></span>
              </div>
            )}
            {approval.approver?.approvalLimit && (
              <div className="flex gap-2 items-start">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Limite : <strong>{Number(approval.approver.approvalLimit).toLocaleString("fr-FR")} XOF</strong></span>
              </div>
            )}
            {approval.decidedAt && (
              <div className="flex gap-2 items-start">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Décidé le <strong>{fmtDate(approval.decidedAt)}</strong></span>
              </div>
            )}
            {waiting && duration && (
              <div className="flex gap-2 items-start">
                <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">En attente depuis <strong>{duration}</strong></span>
              </div>
            )}
            {approval.comment && (
              <div className="flex gap-2 items-start pt-1 border-t mt-1">
                <MessageSquare className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                <span className="text-muted-foreground italic">"{approval.comment}"</span>
              </div>
            )}
            <div className="pt-1.5 border-t text-muted-foreground text-[10px]">
              Étape {approval.stepOrder}{approval.isParallel ? " · Parallèle" : ""}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ApprovalChainVisualization({ approvals, currentStep = 1, requestAmount }: Props) {
  if (!approvals || approvals.length === 0) return null;

  const sorted = [...approvals].sort((a, b) => a.stepOrder - b.stepOrder);
  const approvedCount = sorted.filter(a => a.decision === "approved").length;
  const allApproved = approvedCount === sorted.length;
  const anyRejected = sorted.some(a => a.decision === "rejected");
  const activeStep = sorted.find(a => a.decision === "pending")?.stepOrder ?? -1;

  // Slow approver warning (any pending step > 48h)
  const slowStep = sorted.find(a => {
    if (a.decision !== "pending") return false;
    const h = (Date.now() - new Date((a as any).createdAt || Date.now()).getTime()) / 3600000;
    return h > 48;
  });

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50/60">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-sm">Approbateurs</span>
        </div>
        <div className="flex items-center gap-3">
          {slowStep && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <Turtle className="h-3 w-3" />
              En attente depuis +48h
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {allApproved ? (
              <span className="text-emerald-600 font-medium">✓ Entièrement approuvé</span>
            ) : anyRejected ? (
              <span className="text-red-600 font-medium">✗ Rejeté</span>
            ) : (
              <span>{approvedCount}/{sorted.length} approuvé{approvedCount !== 1 ? "s" : ""}</span>
            )}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-6 py-5">
        <div className="relative flex items-start gap-0 overflow-x-auto">
          {sorted.map((approval, idx) => {
            const isActive = approval.stepOrder === activeStep && approval.decision === "pending";
            const isLast = idx === sorted.length - 1;
            const lineGreen = approval.decision === "approved";

            return (
              <div key={approval.id} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center shrink-0" style={{ zIndex: 1 }}>
                  <StepNode approval={approval} isActive={isActive} isLast={isLast} idx={idx} />
                </div>
                {/* Connector */}
                {!isLast && (
                  <div className="flex-1 mx-0.5 mt-[-30px] flex items-center" style={{ minWidth: 20 }}>
                    <div className="h-0.5 w-full transition-colors"
                      style={{ background: lineGreen ? "#10b981" : "#e5e7eb" }} />
                    <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0 -ml-0.5"
                      style={{ color: lineGreen ? "#10b981" : "#e5e7eb" }}>
                      <path d="M0 4 L8 4 M5 1 L8 4 L5 7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    </svg>
                  </div>
                )}
              </div>
            );
          })}

          {/* Final "Approved" node */}
          {allApproved && (
            <div className="flex items-center flex-shrink-0">
              <div className="h-0.5 w-6 bg-emerald-400 mt-[-30px]" />
              <div className="flex flex-col items-center gap-1 mt-[-30px] shrink-0">
                <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-white shadow">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1">Complet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Policy / bottom note */}
      {sorted[0]?.policyName && (
        <div className="px-5 pb-3">
          <p className="text-xs text-muted-foreground">
            Politique : <span className="font-medium text-foreground">{sorted[0].policyName}</span>
          </p>
        </div>
      )}
    </div>
  );
}
