import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Zap, Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp,
  User, Users, Shield, GitBranch, DollarSign, Building, Tag,
  ArrowDown, CheckCircle, XCircle, Settings, Copy, Eye
} from "lucide-react";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────
type TriggerType = "purchase_request" | "purchase_order" | "invoice" | "expense";
type ConditionField = "amount" | "department" | "category" | "urgency" | "vendor_risk";
type ConditionOp = "gt" | "lt" | "gte" | "lte" | "eq" | "in";
type ApproverType = "specific_user" | "role" | "department_manager" | "cfo" | "ceo";

interface Condition { field: ConditionField; op: ConditionOp; value: string | number; }
interface Step {
  id: string; order: number; label: string; approverType: ApproverType;
  approverId?: number; approverRole?: string; isParallel: boolean;
  timeoutHours?: number; onTimeout: "escalate" | "auto_approve" | "reject";
  escalateTo?: number;
}
interface Workflow {
  id?: number; name: string; trigger: TriggerType; isActive: boolean;
  conditions: Condition[]; steps: Step[]; description?: string;
}

// ── Step types palette ────────────────────────────────────────────────────────
const STEP_TYPES = [
  { type: "specific_user", label: "Utilisateur spécifique", icon: User, color: "blue" },
  { type: "role", label: "Par rôle", icon: Users, color: "purple" },
  { type: "department_manager", label: "Resp. département", icon: Building, color: "cyan" },
  { type: "cfo", label: "Directeur Financier", icon: DollarSign, color: "emerald" },
  { type: "ceo", label: "Directeur Général", icon: Shield, color: "red" },
];

const TRIGGER_LABELS: Record<TriggerType, string> = {
  purchase_request: "Demande d'achat", purchase_order: "Bon de commande",
  invoice: "Facture", expense: "Note de frais",
};

const CONDITION_FIELDS: { value: ConditionField; label: string; icon: any }[] = [
  { value: "amount", label: "Montant (XOF)", icon: DollarSign },
  { value: "department", label: "Département", icon: Building },
  { value: "category", label: "Catégorie", icon: Tag },
  { value: "urgency", label: "Niveau d'urgence", icon: Zap },
  { value: "vendor_risk", label: "Risque fournisseur", icon: Shield },
];

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrateur" },
  { value: "procurement_manager", label: "Responsable achats" },
  { value: "approver", label: "Approbateur" },
];

// ── Condition Builder ─────────────────────────────────────────────────────────
function ConditionRow({ cond, onChange, onDelete }: { cond: Condition; onChange: (c: Condition) => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg">
      <select value={cond.field} onChange={e => onChange({ ...cond, field: e.target.value as ConditionField })}
        className="h-8 px-2 text-xs rounded border border-input bg-background flex-1">
        {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select value={cond.op} onChange={e => onChange({ ...cond, op: e.target.value as ConditionOp })}
        className="h-8 px-2 text-xs rounded border border-input bg-background w-20">
        <option value="gte">≥</option><option value="lte">≤</option>
        <option value="gt">&gt;</option><option value="lt">&lt;</option>
        <option value="eq">=</option>
      </select>
      <input value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })}
        placeholder="Valeur" className="h-8 px-2 text-xs rounded border border-input bg-background flex-1" />
      <button onClick={onDelete} className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors rounded">
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Step Card ─────────────────────────────────────────────────────────────────
function StepCard({ step, index, total, users, onChange, onDelete, onMoveUp, onMoveDown }: any) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = STEP_TYPES.find(t => t.type === step.approverType) || STEP_TYPES[0];
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <div className="relative">
      <div className="border rounded-xl bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <button onClick={onMoveUp} disabled={index === 0} className="h-4 w-4 flex items-center justify-center disabled:opacity-30 hover:text-foreground text-muted-foreground transition-colors">
              <ChevronUp className="h-3 w-3" />
            </button>
            <button onClick={onMoveDown} disabled={index === total - 1} className="h-4 w-4 flex items-center justify-center disabled:opacity-30 hover:text-foreground text-muted-foreground transition-colors">
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${colors[typeInfo.color]}`}>
            <typeInfo.icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <input value={step.label} onChange={e => onChange({ ...step, label: e.target.value })}
              className="text-sm font-semibold bg-transparent border-none outline-none focus:bg-muted/50 rounded px-1 w-full" />
            <p className="text-xs text-muted-foreground">{typeInfo.label}{step.isParallel ? " · Parallèle" : " · Séquentielle"}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors text-muted-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Expanded settings */}
        {expanded && (
          <div className="px-4 pb-4 border-t pt-3 space-y-3 bg-muted/20">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type d'approbateur</Label>
                <select value={step.approverType} onChange={e => onChange({ ...step, approverType: e.target.value as ApproverType })}
                  className="w-full h-8 px-2 text-xs rounded border border-input bg-background">
                  {STEP_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                </select>
              </div>
              {step.approverType === "role" && (
                <div className="space-y-1">
                  <Label className="text-xs">Rôle requis</Label>
                  <select value={step.approverRole || ""} onChange={e => onChange({ ...step, approverRole: e.target.value })}
                    className="w-full h-8 px-2 text-xs rounded border border-input bg-background">
                    <option value="">Sélectionner...</option>
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              )}
              {step.approverType === "specific_user" && (
                <div className="space-y-1">
                  <Label className="text-xs">Utilisateur</Label>
                  <select value={step.approverId || ""} onChange={e => onChange({ ...step, approverId: parseInt(e.target.value) })}
                    className="w-full h-8 px-2 text-xs rounded border border-input bg-background">
                    <option value="">Sélectionner...</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Délai (heures)</Label>
                <input type="number" value={step.timeoutHours || ""} onChange={e => onChange({ ...step, timeoutHours: parseInt(e.target.value) || undefined })}
                  placeholder="Ex: 48" className="w-full h-8 px-2 text-xs rounded border border-input bg-background" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Si délai dépassé</Label>
                <select value={step.onTimeout} onChange={e => onChange({ ...step, onTimeout: e.target.value as any })}
                  className="w-full h-8 px-2 text-xs rounded border border-input bg-background">
                  <option value="escalate">Escalader</option>
                  <option value="auto_approve">Auto-approuver</option>
                  <option value="reject">Rejeter</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={step.isParallel} onChange={e => onChange({ ...step, isParallel: e.target.checked })} className="h-4 w-4" />
                <span className="text-xs font-medium">Approbation parallèle</span>
              </label>
              <span className="text-xs text-muted-foreground">(tous les approbateurs de ce type valident simultanément)</span>
            </div>
          </div>
        )}
      </div>
      {/* Connector */}
      {index < total - 1 && (
        <div className="flex flex-col items-center py-1">
          <div className="w-0.5 h-3 bg-border" />
          <ArrowDown className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WorkflowBuilder() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: policies = [] } = trpc.settings.getApprovalPolicies.useQuery();
  const { data: users = [] } = trpc.settings.listUsers.useQuery();

  const [activeId, setActiveId] = useState<number | "new" | null>(null);
  const [workflow, setWorkflow] = useState<Workflow>({
    name: "", trigger: "purchase_request", isActive: true, conditions: [], steps: [], description: "",
  });

  const createMut = trpc.settings.createApprovalPolicy.useMutation({
    onSuccess: () => { toast.success("Workflow créé !"); utils.settings.getApprovalPolicies.invalidate(); setActiveId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const addStep = (type: ApproverType) => {
    const newStep: Step = {
      id: Math.random().toString(36).slice(2),
      order: workflow.steps.length + 1,
      label: STEP_TYPES.find(t => t.type === type)?.label || "Approbation",
      approverType: type, isParallel: false, onTimeout: "escalate",
    };
    setWorkflow(w => ({ ...w, steps: [...w.steps, newStep] }));
  };

  const updateStep = (id: string, updated: Step) => {
    setWorkflow(w => ({ ...w, steps: w.steps.map(s => s.id === id ? updated : s) }));
  };

  const deleteStep = (id: string) => {
    setWorkflow(w => ({ ...w, steps: w.steps.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })) }));
  };

  const moveStep = (id: string, dir: "up" | "down") => {
    setWorkflow(w => {
      const steps = [...w.steps];
      const idx = steps.findIndex(s => s.id === id);
      if (dir === "up" && idx > 0) [steps[idx - 1], steps[idx]] = [steps[idx], steps[idx - 1]];
      if (dir === "down" && idx < steps.length - 1) [steps[idx + 1], steps[idx]] = [steps[idx], steps[idx + 1]];
      return { ...w, steps: steps.map((s, i) => ({ ...s, order: i + 1 })) };
    });
  };

  const addCondition = () => {
    setWorkflow(w => ({ ...w, conditions: [...w.conditions, { field: "amount", op: "gte", value: 0 }] }));
  };

  const saveWorkflow = () => {
    if (!workflow.name.trim()) { toast.error("Nom du workflow requis"); return; }
    if (workflow.steps.length === 0) { toast.error("Au moins une étape d'approbation requise"); return; }
    createMut.mutate({
      name: workflow.name,
      conditions: {
        trigger: workflow.trigger,
        conditions: workflow.conditions,
        description: workflow.description,
      } as any,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><GitBranch className="h-6 w-6 text-purple-600" />Constructeur de workflows</h1>
          <p className="text-sm text-muted-foreground">Créez des workflows d'approbation visuels sans écrire de code</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Existing workflows list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Workflows existants</h2>
            <button onClick={() => { setActiveId("new"); setWorkflow({ name: "", trigger: "purchase_request", isActive: true, conditions: [], steps: [], description: "" }); }}
              className="flex items-center gap-1 text-xs text-blue-700 hover:underline">
              <Plus className="h-3.5 w-3.5" />Nouveau
            </button>
          </div>
          {(policies as any[]).length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <GitBranch className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucun workflow</p>
              <button onClick={() => setActiveId("new")} className="mt-3 text-sm btn-primary px-3 py-1.5 rounded-lg text-white">+ Créer</button>
            </CardContent></Card>
          ) : (policies as any[]).map((p: any) => (
            <button key={p.id} onClick={() => setActiveId(p.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all hover:shadow-sm ${activeId === p.id ? "border-purple-300 bg-purple-50/50" : "bg-card"}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{p.name}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  {p.isActive ? "Actif" : "Inactif"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.conditions?.minAmount ? `≥ ${new Intl.NumberFormat("fr-FR").format(p.conditions.minAmount)} XOF` : "Tous montants"}
              </p>
            </button>
          ))}
        </div>

        {/* Builder canvas */}
        {activeId === "new" ? (
          <div className="lg:col-span-2 space-y-4">
            {/* Workflow metadata */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />Configuration du workflow
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nom du workflow *</Label>
                    <Input value={workflow.name} onChange={e => setWorkflow(w => ({ ...w, name: e.target.value }))}
                      placeholder="Ex: Approbation achats IT > 1M XOF" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Déclencheur</Label>
                    <select value={workflow.trigger} onChange={e => setWorkflow(w => ({ ...w, trigger: e.target.value as TriggerType }))}
                      className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background">
                      {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Conditions de déclenchement</Label>
                    <button onClick={addCondition} className="text-xs text-blue-700 flex items-center gap-1 hover:underline">
                      <Plus className="h-3 w-3" />Ajouter
                    </button>
                  </div>
                  {workflow.conditions.length === 0 ? (
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">Sans conditions = s'applique à tous les documents</p>
                  ) : (
                    <div className="space-y-1.5">
                      {workflow.conditions.map((cond, i) => (
                        <ConditionRow key={i} cond={cond}
                          onChange={c => setWorkflow(w => ({ ...w, conditions: w.conditions.map((x, j) => j === i ? c : x) }))}
                          onDelete={() => setWorkflow(w => ({ ...w, conditions: w.conditions.filter((_, j) => j !== i) }))} />
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Steps builder */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />Étapes d'approbation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Step type palette */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {STEP_TYPES.map(type => {
                    const colorClasses: Record<string, string> = {
                      blue: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
                      purple: "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100",
                      cyan: "bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100",
                      emerald: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
                      red: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
                    };
                    return (
                      <button key={type.type} onClick={() => addStep(type.type as ApproverType)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${colorClasses[type.color]}`}>
                        <Plus className="h-3 w-3" /><type.icon className="h-3.5 w-3.5" />{type.label}
                      </button>
                    );
                  })}
                </div>

                {workflow.steps.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed rounded-xl">
                    <GitBranch className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Ajoutez des étapes en cliquant sur les boutons ci-dessus</p>
                    <p className="text-xs text-muted-foreground mt-1">Chaque étape correspond à un niveau d'approbation</p>
                  </div>
                ) : (
                  <div>
                    {workflow.steps.map((step, i) => (
                      <StepCard key={step.id} step={step} index={i} total={workflow.steps.length}
                        users={users} onChange={(s: Step) => updateStep(step.id, s)}
                        onDelete={() => deleteStep(step.id)}
                        onMoveUp={() => moveStep(step.id, "up")}
                        onMoveDown={() => moveStep(step.id, "down")} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save */}
            <div className="flex gap-3 justify-end sticky bottom-4 bg-background/95 backdrop-blur py-3 px-4 rounded-xl border shadow-md">
              <button onClick={() => setActiveId(null)} className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
              <button onClick={saveWorkflow} disabled={createMut.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold btn-primary text-white disabled:opacity-50">
                {createMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</> : <><Save className="h-4 w-4" />Enregistrer le workflow</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2">
            <Card><CardContent className="py-16 text-center">
              <GitBranch className="h-14 w-14 text-muted-foreground/20 mx-auto mb-4" />
              <p className="font-semibold text-muted-foreground">Sélectionnez un workflow à modifier</p>
              <p className="text-sm text-muted-foreground mt-1">ou créez-en un nouveau</p>
              <button onClick={() => setActiveId("new")} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold btn-primary text-white mx-auto">
                <Plus className="h-4 w-4" />Créer un workflow
              </button>
            </CardContent></Card>
          </div>
        )}
      </div>
    </div>
  );
}
