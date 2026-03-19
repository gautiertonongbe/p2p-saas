import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, X, Clock, ArrowRight, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ApprovalStep {
  id: number;
  stepOrder: number;
  approverId: number;
  decision: "pending" | "approved" | "rejected" | "delegated";
  comment?: string | null;
  decidedAt?: Date | null;
  approver?: {
    id: number;
    name?: string | null;
    email?: string | null;
  } | null;
}

interface ApprovalChainVisualizationProps {
  approvals: ApprovalStep[];
  currentStep?: number;
}

export function ApprovalChainVisualization({ approvals, currentStep = 1 }: ApprovalChainVisualizationProps) {
  const { t } = useTranslation();

  // Group approvals by step order
  const stepGroups = approvals.reduce((acc, approval) => {
    if (!acc[approval.stepOrder]) {
      acc[approval.stepOrder] = [];
    }
    acc[approval.stepOrder].push(approval);
    return acc;
  }, {} as Record<number, ApprovalStep[]>);

  const sortedSteps = Object.keys(stepGroups)
    .map(Number)
    .sort((a, b) => a - b);

  const getStepStatus = (step: ApprovalStep[]) => {
    if (step.every(a => a.decision === "approved")) return "approved";
    if (step.some(a => a.decision === "rejected")) return "rejected";
    if (step.some(a => a.decision === "pending")) return "pending";
    return "pending";
  };

  const getStatusIcon = (decision: string) => {
    switch (decision) {
      case "approved":
        return <Check className="h-4 w-4 text-green-600" />;
      case "rejected":
        return <X className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (decision: string) => {
    switch (decision) {
      case "approved":
        return <Badge variant="default" className="bg-green-600">{t('approvals.status.approved')}</Badge>;
      case "rejected":
        return <Badge variant="destructive">{t('approvals.status.rejected')}</Badge>;
      case "pending":
        return <Badge variant="secondary">{t('approvals.status.pending')}</Badge>;
      default:
        return <Badge variant="outline">{t('approvals.status.pending')}</Badge>;
    }
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t('approvals.chain.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedSteps.map((stepOrder, index) => {
            const stepApprovals = stepGroups[stepOrder];
            const stepStatus = getStepStatus(stepApprovals);
            const isParallel = stepApprovals.length > 1;

            return (
              <div key={stepOrder} className="relative">
                {/* Step Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    stepStatus === "approved" ? "border-green-600 bg-green-50" :
                    stepStatus === "rejected" ? "border-red-600 bg-red-50" :
                    stepStatus === "pending" ? "border-yellow-600 bg-yellow-50" :
                    "border-gray-300 bg-gray-50"
                  }`}>
                    <span className="text-sm font-semibold">{stepOrder}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">
                        {t('approvals.chain.step', { number: stepOrder })}
                      </h4>
                      {isParallel && (
                        <Badge variant="outline" className="text-xs">
                          {t('approvals.chain.parallel')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Approvers */}
                <div className="ml-11 space-y-2">
                  {stepApprovals.map((approval) => (
                    <div
                      key={approval.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        approval.decision === "approved" ? "border-green-200 bg-green-50" :
                        approval.decision === "rejected" ? "border-red-200 bg-red-50" :
                        approval.decision === "pending" ? "border-yellow-200 bg-yellow-50" :
                        "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {approval.approver?.name?.substring(0, 2).toUpperCase() || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {approval.approver?.name || t('approvals.chain.unknownApprover')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {approval.approver?.email || ""}
                        </p>
                        {approval.comment && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            "{approval.comment}"
                          </p>
                        )}
                        {approval.decidedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(approval.decidedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(approval.decision)}
                        {getStatusBadge(approval.decision)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Arrow to next step */}
                {index < sortedSteps.length - 1 && (
                  <div className="flex justify-center my-2">
                    <ArrowRight className="h-5 w-5 text-gray-400" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
