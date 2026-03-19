import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Shield, DollarSign, Users, ArrowRight, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ApprovalPolicies() {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);

  const { data: policies = [], isLoading } = trpc.settings.getApprovalPolicies.useQuery();
  const { data: steps } = trpc.settings.getApprovalSteps.useQuery();
  const createPolicy = trpc.settings.createApprovalPolicy.useMutation();
  const deletePolicy = trpc.settings.deleteApprovalPolicy.useMutation();
  const utils = trpc.useUtils();

  const [formData, setFormData] = useState({
    name: "",
    minAmount: "",
    maxAmount: "",
    requiresAllApprovals: true,
  });

  const handleCreatePolicy = async () => {
    try {
      const conditions: any = {};
      if (formData.minAmount) conditions.minAmount = parseFloat(formData.minAmount);
      if (formData.maxAmount) conditions.maxAmount = parseFloat(formData.maxAmount);
      
      await createPolicy.mutateAsync({
        name: formData.name,
        conditions,
        requiresAllApprovals: formData.requiresAllApprovals,
      });
      toast.success(t("settings.approvals.policyCreated"));
      setIsCreateDialogOpen(false);
      setFormData({ name: "", minAmount: "", maxAmount: "", requiresAllApprovals: true });
      utils.settings.getApprovalPolicies.invalidate();
    } catch (error) {
      toast.error(t("common.error"));
    }
  };

  const handleDeletePolicy = async (id: number) => {
    if (!confirm(t("settings.approvals.confirmDelete"))) return;
    try {
      await deletePolicy.mutateAsync({ id });
      toast.success(t("settings.approvals.policyDeleted"));
      utils.settings.getApprovalPolicies.invalidate();
    } catch (error) {
      toast.error(t("common.error"));
    }
  };

  const getPolicySteps = (policyId: number) => {
    return steps?.filter((s: any) => s.policyId === policyId).sort((a: any, b: any) => a.stepOrder - b.stepOrder) || [];
  };

  const getApproverTypeLabel = (type: string) => {
    switch (type) {
      case "role":
        return t("settings.approvals.approverTypes.role");
      case "user":
        return t("settings.approvals.approverTypes.user");
      case "manager":
        return t("settings.approvals.approverTypes.manager");
      default:
        return type;
    }
  };

  const getRoleLabel = (roleId: number) => {
    const roleMap: Record<number, string> = {
      1: t("roles.admin"),
      2: t("roles.procurementManager"),
      3: t("roles.approver"),
    };
    return roleMap[roleId] || `Role ${roleId}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            {t("settings.approvals.title")}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t("settings.approvals.description")}
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("settings.approvals.createPolicy")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("settings.approvals.createPolicy")}</DialogTitle>
              <DialogDescription>{t("settings.approvals.createPolicyDesc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="policyName">{t("settings.approvals.policyName")}</Label>
                <Input
                  id="policyName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("settings.approvals.policyNamePlaceholder")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minAmount">{t("settings.approvals.minAmount")}</Label>
                  <Input
                    id="minAmount"
                    type="number"
                    value={formData.minAmount}
                    onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxAmount">{t("settings.approvals.maxAmount")}</Label>
                  <Input
                    id="maxAmount"
                    type="number"
                    value={formData.maxAmount}
                    onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                    placeholder="∞"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleCreatePolicy} disabled={!formData.name || createPolicy.isPending}>
                {createPolicy.isPending ? t("common.creating") : t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {policies && policies.length > 0 ? (
          policies.map((policy: any) => {
            const policySteps = getPolicySteps(policy.id);
            return (
              <Card key={policy.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {policy.name}
                        {policy.isActive && (
                          <Badge variant="default" className="ml-2">
                            {t("common.active")}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {policy.conditions?.minAmount ? `${policy.conditions.minAmount.toLocaleString()} XOF` : "0 XOF"} - {policy.conditions?.maxAmount ? `${policy.conditions.maxAmount.toLocaleString()} XOF` : "∞"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {policySteps.length} {t("settings.approvals.steps")}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setEditingPolicy(policy)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeletePolicy(policy.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {policySteps.length > 0 && (
                  <CardContent>
                    <div className="flex items-center gap-3 flex-wrap">
                      {policySteps.map((step: any, index: number) => (
                        <div key={step.id} className="flex items-center gap-3">
                          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                              {step.stepOrder}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{getApproverTypeLabel(step.approverType)}</div>
                              {step.approverType === "role" && step.approverId && (
                                <div className="text-xs text-muted-foreground">{getRoleLabel(step.approverId)}</div>
                              )}
                            </div>
                          </div>
                          {index < policySteps.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-4">
                {t("settings.approvals.noPolicies")}
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t("settings.approvals.createFirstPolicy")}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
