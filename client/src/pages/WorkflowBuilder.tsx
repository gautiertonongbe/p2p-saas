import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp,
  User, Users, Shield, GitBranch, DollarSign, Building,
  ArrowDown, CheckCircle, XCircle, Settings, Edit2
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type ApproverType = "specific_user" | "role" | "department_manager";
type ConditionField = "amount" | "department" | "urgency";
type ConditionOp = "gte" | "lte" | "gt" | "lt" | "eq";
interface Condition { field: ConditionField; op: ConditionOp; value: string; }
interface Step {
  uid: string; dbId?: number; order: number; label: string;
  approverType: ApproverType; approverId?: number; approverRole?: string;
  isParallel: boolean; timeoutHours?: number; onTimeout: "escalate" | "auto_approve" | "reject";
}
interface Draft {
  id?: number; name: string; isActive: boolean;
  minAmount: string; maxAmount: string; steps: Step[];
}

const STEP_TYPES = [
  { type: "specific_user" as ApproverType, label: "Utilisateur spécifique", icon: User,       color: "blue"    },
  { type: "role"          as ApproverType, label: "Par rôle",               icon: Users,      color: "purple"  },
  { type: "department_manager" as ApproverType, label: "Resp. département", icon: Building,   color: "cyan"    },
];
const ROLE_OPTIONS = [
  { value: "admin",               label: "Administrateur" },
  { value: "procurement_manager", label: "Responsable achats" },
  { value: "approver",            label: "Approbateur" },
];
const COLORS: Record<string, string> = {
  blue:   "bg-blue-50 border-blue-200 text-blue-700",
  purple: "bg-purple-50 border-purple-200 text-purple-700",
  cyan:   "bg-cyan-50 border-cyan-200 text-cyan-700",
};
const BTN_COLORS: Record<string, string> = {
  blue:   "border-blue-200 text-blue-700 hover:bg-blue-50",
  purple: "border-purple-200 text-purple-700 hover:bg-purple-50",
  cyan:   "border-cyan-200 text-cyan-700 hover:bg-cyan-50",
};
function uid() { return Math.random().toString(36).slice(2, 8); }
function fmt(n: number) { return new Intl.NumberFormat("fr-FR").format(n); }
function blank(): Draft { return { name: "", isActive: true, minAmount: "", maxAmount: "", steps: [] }; }

// ── Step Card ──────────────────────────────────────────────────────────────────
function StepCard({ step, index, total, users, onChange, onDelete, onMoveUp, onMoveDown }: {
  step: Step; index: number; total: number; users: any[];
  onChange: (s: Step) => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(false);
  const info = STEP_TYPES.find(t => t.type === step.approverType) || STEP_TYPES[0];
  const Icon = info.icon;

  return (
    <div className="relative">
      <div className={`border-2 rounded-xl bg-white overflow-hidden ${open ? "border-blue-300" : "border-gray-200"}`}>
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Order controls */}
          <div className="flex flex-col items-center shrink-0">
            <button onClick={onMoveUp} disabled={index === 0}
              className="h-5 w-5 flex items-center justify-center disabled:opacity-20 hover:bg-gray-100 rounded text-muted-foreground">
              <ChevronUp className="h-3 w-3" />
            </button>
            <span className="text-xs font-bold text-gray-400 my-0.5">{index + 1}</span>
            <button onClick={onMoveDown} disabled={index === total - 1}
              className="h-5 w-5 flex items-center justify-center disabled:opacity-20 hover:bg-gray-100 rounded text-muted-foreground">
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          {/* Icon */}
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border-2 ${COLORS[info.color]}`}>
            <Icon className="h-4 w-4" />
          </div>
          {/* Label */}
          <div className="flex-1 min-w-0">
            <input value={step.label}
              onChange={e => onChange({ ...step, label: e.target.value })}
              className="text-sm font-semibold bg-transparent border-b border-dashed border-gray-300 outline-none focus:border-blue-500 px-1 w-full"
              placeholder="Nom de l'étape..." />
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${COLORS[info.color]}`}>{info.label}</span>
              {step.isParallel && <span className="text-xs text-muted-foreground">Parallèle</span>}
              {step.timeoutHours && <span className="text-xs text-muted-foreground">· {step.timeoutHours}h</span>}
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setOpen(!open)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${open ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-muted-foreground"}`}>
              <Settings className="h-3.5 w-3.5" />{open ? "Fermer" : "Config."}
            </button>
            <button onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors text-muted-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {open && (
          <div className="px-4 pb-4 pt-3 border-t bg-gray-50/60 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type d'approbateur</Label>
                <select value={step.approverType}
                  onChange={e => onChange({ ...step, approverType: e.target.value as ApproverType })}
                  className="w-full h-8 px-2 text-xs rounded border border-input bg-white">
                  {STEP_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                </select>
              </div>
              {step.approverType === "role" && (
                <div className="space-y-1">
                  <Label className="text-xs">Rôle</Label>
                  <select value={step.approverRole || ""}
                    onChange={e => onChange({ ...step, approverRole: e.target.value })}
                    className="w-full h-8 px-2 text-xs rounded border border-input bg-white">
                    <option value="">Sélectionner...</option>
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              )}
              {step.approverType === "specific_user" && (
                <div className="space-y-1">
                  <Label className="text-xs">Utilisateur</Label>
                  <select value={step.approverId || ""}
                    onChange={e => onChange({ ...step, approverId: parseInt(e.target.value) })}
                    className="w-full h-8 px-2 text-xs rounded border border-input bg-white">
                    <option value="">Sélectionner...</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Délai max (heures)</Label>
                <input type="number" value={step.timeoutHours || ""}
                  onChange={e => onChange({ ...step, timeoutHours: parseInt(e.target.value) || undefined })}
                  placeholder="Ex: 48" className="w-full h-8 px-2 text-xs rounded border border-input bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Si délai dépassé</Label>
                <select value={step.onTimeout}
                  onChange={e => onChange({ ...step, onTimeout: e.target.value as any })}
                  className="w-full h-8 px-2 text-xs rounded border border-input bg-white">
                  <option value="escalate">Escalader</option>
                  <option value="auto_approve">Auto-approuver</option>
                  <option value="reject">Rejeter</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={step.isParallel}
                onChange={e => onChange({ ...step, isParallel: e.target.checked })}
                className="h-4 w-4" />
              <span className="text-xs font-medium">Approbation parallèle</span>
              <span className="text-xs text-muted-foreground">(plusieurs approbateurs simultanément)</span>
            </label>
          </div>
        )}
      </div>
      {index < total - 1 && (
        <div className="flex flex-col items-center py-1">
          <div className="w-0.5 h-3 bg-gray-200" />
          <ArrowDown className="h-3 w-3 text-gray-300" />
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function WorkflowBuilder() {
  const utils = trpc.useUtils();
  const { data: policies = [] }  = trpc.settings.getApprovalPolicies.useQuery();
  const { data: allSteps = [] }  = trpc.settings.getApprovalSteps.useQuery();
  const { data: users = [] }     = trpc.settings.listUsers.useQuery();

  const [activeId, setActiveId] = useState<number | "new" | null>(null);
  const [draft, setDraft]       = useState<Draft>(blank());
  const [dirty, setDirty]       = useState(false);

  // Load existing workflow into draft when selected
  useEffect(() => {
    if (!activeId || activeId === "new") return;
    const p = (policies as any[]).find((x: any) => x.id === activeId);
    if (!p) return;
    const pSteps = (allSteps as any[])
      .filter((s: any) => s.policyId === activeId)
      .sort((a: any, b: any) => a.stepOrder - b.stepOrder)
      .map((s: any) => ({
        uid: uid(), dbId: s.id,
        order: s.stepOrder,
        label: s.label || STEP_TYPES.find(t => t.type === s.approverType)?.label || "Étape",
        approverType: s.approverType as ApproverType,
        approverId: s.approverId,
        approverRole: s.approverRole,
        isParallel: !!s.isParallel,
        timeoutHours: s.timeoutHours,
        onTimeout: s.onTimeout || "escalate",
      }));
    setDraft({
      id: p.id, name: p.name, isActive: p.isActive,
      minAmount: p.conditions?.minAmount?.toString() || "",
      maxAmount: p.conditions?.maxAmount?.toString() || "",
      steps: pSteps,
    });
    setDirty(false);
  }, [activeId, policies, allSteps]);

  const invalidate = () => {
    utils.settings.getApprovalPolicies.invalidate();
    utils.settings.getApprovalSteps.invalidate();
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMut = trpc.settings.createApprovalPolicy.useMutation({
    onSuccess: (data: any) => {
      toast.success("Workflow créé !");
      invalidate();
      setActiveId(data?.id || null);
      setDirty(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = trpc.settings.updateApprovalPolicy.useMutation({
    onSuccess: () => { toast.success("Workflow mis à jour"); invalidate(); setDirty(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = trpc.settings.deleteApprovalPolicy.useMutation({
    onSuccess: () => { toast.success("Workflow supprimé"); invalidate(); setActiveId(null); setDraft(blank()); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = trpc.settings.updateApprovalPolicy.useMutation({
    onSuccess: () => { toast.success("Statut mis à jour"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const addStepMut = trpc.settings.addApprovalStep.useMutation({
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message),
  });

  const delStepMut = trpc.settings.deleteApprovalStep.useMutation({
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message),
  });

  // ── Draft helpers ──────────────────────────────────────────────────────────
  const update = (patch: Partial<Draft>) => { setDraft(d => ({ ...d, ...patch })); setDirty(true); };

  const addStep = (type: ApproverType) => {
    const info = STEP_TYPES.find(t => t.type === type)!;
    update({ steps: [...draft.steps, {
      uid: uid(), order: draft.steps.length + 1,
      label: info.label, approverType: type,
      isParallel: false, onTimeout: "escalate",
    }]});
  };

  const updateStep = (uid: string, s: Step) => {
    update({ steps: draft.steps.map(x => x.uid === uid ? s : x) });
  };

  const deleteStep = (uid: string) => {
    update({ steps: draft.steps.filter(x => x.uid !== uid).map((x, i) => ({ ...x, order: i + 1 })) });
  };

  const moveStep = (uid: string, dir: "up" | "down") => {
    const steps = [...draft.steps];
    const i = steps.findIndex(s => s.uid === uid);
    if (dir === "up" && i > 0) [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]];
    if (dir === "down" && i < steps.length - 1) [steps[i + 1], steps[i]] = [steps[i], steps[i + 1]];
    update({ steps: steps.map((s, j) => ({ ...s, order: j + 1 })) });
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!draft.name.trim()) { toast.error("Nom du workflow requis"); return; }
    if (draft.steps.length === 0) { toast.error("Au moins une étape requise"); return; }

    const conditions = {
      minAmount: draft.minAmount ? parseFloat(draft.minAmount) : undefined,
      maxAmount: draft.maxAmount ? parseFloat(draft.maxAmount) : undefined,
    };

    if (draft.id) {
      // Update name/conditions
      await updateMut.mutateAsync({ id: draft.id, name: draft.name });
      // Re-sync steps: delete all existing then re-add
      const existing = (allSteps as any[]).filter((s: any) => s.policyId === draft.id);
      for (const s of existing) {
        await delStepMut.mutateAsync({ stepId: s.id });
      }
      for (const step of draft.steps) {
        const roleMap: Record<string, number> = { admin: 1, procurement_manager: 2, approver: 3 };
        await addStepMut.mutateAsync({
          policyId: draft.id, stepOrder: step.order,
          approverType: step.approverType === "department_manager" ? "manager" : step.approverType === "specific_user" ? "user" : "role",
          approverId: step.approverType === "specific_user" ? step.approverId
            : step.approverType === "role" ? (roleMap[step.approverRole || "approver"] ?? 3)
            : undefined,
          isParallel: step.isParallel,
        });
      }
      toast.success("Workflow mis à jour !");
      invalidate();
      setDirty(false);
    } else {
      // Create new
      const result = await createMut.mutateAsync({ name: draft.name, conditions, requiresAllApprovals: true });
      const policyId = (result as any)?.id;
      if (policyId) {
        for (const step of draft.steps) {
          const roleMap: Record<string, number> = { admin: 1, procurement_manager: 2, approver: 3 };
          await addStepMut.mutateAsync({
            policyId, stepOrder: step.order,
            approverType: step.approverType === "department_manager" ? "manager" : step.approverType === "specific_user" ? "user" : "role",
            approverId: step.approverType === "specific_user" ? step.approverId
              : step.approverType === "role" ? (roleMap[step.approverRole || "approver"] ?? 3)
              : undefined,
            isParallel: step.isParallel,
          });
        }
        setActiveId(policyId);
      }
    }
  };

  const isLoading = createMut.isPending || updateMut.isPending || addStepMut.isPending || delStepMut.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-purple-600" />Constructeur de workflows
        </h1>
        <p className="text-sm text-muted-foreground">Créez et gérez vos workflows d'approbation</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* ── Left: workflow list ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workflows existants</p>
            <button onClick={() => { setActiveId("new"); setDraft(blank()); setDirty(false); }}
              className="flex items-center gap-1 text-xs text-blue-700 hover:underline font-medium">
              <Plus className="h-3.5 w-3.5" />Nouveau
            </button>
          </div>

          {(policies as any[]).length === 0 ? (
            <div className="p-6 text-center border-2 border-dashed rounded-xl">
              <GitBranch className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucun workflow</p>
              <button onClick={() => setActiveId("new")}
                className="mt-3 text-sm btn-primary px-3 py-1.5 rounded-lg text-white">Créer</button>
            </div>
          ) : (policies as any[]).map((p: any) => (
            <div key={p.id}
              className={`rounded-xl border transition-all ${activeId === p.id ? "border-purple-400 bg-purple-50/40" : "bg-white hover:border-gray-300"}`}>
              {/* Click area */}
              <button onClick={() => setActiveId(p.id)} className="w-full text-left p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {p.isActive ? "Actif" : "Inactif"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.conditions?.minAmount ? `≥ ${fmt(p.conditions.minAmount)} XOF` : "Tous montants"}
                  {" · "}
                  {(allSteps as any[]).filter((s: any) => s.policyId === p.id).length} étape(s)
                </p>
              </button>
              {/* Action row */}
              <div className="flex items-center gap-1 px-3 pb-2 border-t border-gray-100 pt-2">
                <button onClick={() => setActiveId(p.id)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">
                  <Edit2 className="h-3 w-3" />Modifier
                </button>
                <button onClick={() => toggleMut.mutate({ id: p.id, isActive: !p.isActive })}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${p.isActive ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
                  {p.isActive ? "Désactiver" : "Activer"}
                </button>
                <button onClick={() => { if (confirm(`Supprimer "${p.name}" ?`)) deleteMut.mutate({ id: p.id }); }}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3 w-3" />Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Right: editor canvas ── */}
        {activeId !== null ? (
          <div className="lg:col-span-2 space-y-4">
            {/* Header */}
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <div className="flex items-center gap-3">
                <GitBranch className="h-5 w-5 text-purple-600 shrink-0" />
                <h2 className="font-semibold">{activeId === "new" ? "Nouveau workflow" : "Modifier le workflow"}</h2>
                {dirty && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Non sauvegardé</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Nom du workflow *</Label>
                  <Input value={draft.name} onChange={e => update({ name: e.target.value })}
                    placeholder="Ex: Approbation DG — achats > 5M XOF" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Montant minimum (XOF)</Label>
                  <Input type="number" value={draft.minAmount} onChange={e => update({ minAmount: e.target.value })}
                    placeholder="0 = tous montants" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Montant maximum (XOF)</Label>
                  <Input type="number" value={draft.maxAmount} onChange={e => update({ maxAmount: e.target.value })}
                    placeholder="Vide = illimité" className="h-9 text-sm" />
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                💡 Sans conditions de montant, ce workflow s'applique à <strong>toutes les demandes</strong>.
                Plusieurs workflows actifs = le premier qui correspond est utilisé.
              </div>
            </div>

            {/* Steps */}
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  Étapes d'approbation
                  {draft.steps.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      {draft.steps.length} étape{draft.steps.length > 1 ? "s" : ""}
                    </span>
                  )}
                </h3>
              </div>

              {/* Step type buttons */}
              <div className="flex flex-wrap gap-2 pb-3 border-b">
                <p className="w-full text-xs text-muted-foreground mb-1">+ Ajouter une étape :</p>
                {STEP_TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.type} onClick={() => addStep(t.type)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${BTN_COLORS[t.color]}`}>
                      <Plus className="h-3 w-3" /><Icon className="h-3.5 w-3.5" />{t.label}
                    </button>
                  );
                })}
              </div>

              {/* Steps list */}
              {draft.steps.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl">
                  <GitBranch className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Aucune étape — ajoutez des approbateurs ci-dessus</p>
                  <p className="text-xs text-muted-foreground mt-1">Ex : Responsable achats → Directeur Général</p>
                </div>
              ) : (
                <div>
                  {draft.steps.map((step, i) => (
                    <StepCard key={step.uid} step={step} index={i} total={draft.steps.length} users={users}
                      onChange={s => updateStep(step.uid, s)}
                      onDelete={() => deleteStep(step.uid)}
                      onMoveUp={() => moveStep(step.uid, "up")}
                      onMoveDown={() => moveStep(step.uid, "down")} />
                  ))}
                </div>
              )}
            </div>

            {/* Save bar */}
            <div className="flex gap-3 justify-end sticky bottom-4 bg-white/95 backdrop-blur py-3 px-4 rounded-xl border shadow-md">
              <button onClick={() => { setActiveId(null); setDraft(blank()); setDirty(false); }}
                className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={save} disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold btn-primary text-white disabled:opacity-50">
                {isLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</>
                  : <><Save className="h-4 w-4" />{activeId === "new" ? "Créer le workflow" : "Sauvegarder les modifications"}</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2">
            <div className="rounded-2xl border bg-white py-16 text-center">
              <GitBranch className="h-14 w-14 text-muted-foreground/20 mx-auto mb-4" />
              <p className="font-semibold text-muted-foreground">Sélectionnez un workflow à modifier</p>
              <p className="text-sm text-muted-foreground mt-1">ou créez-en un nouveau</p>
              <button onClick={() => { setActiveId("new"); setDraft(blank()); }}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold btn-primary text-white mx-auto">
                <Plus className="h-4 w-4" />Créer un workflow
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
