import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AvatarUpload } from "@/components/AvatarUpload";
import { useTheme, COLOR_PRESETS } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, Users, GitBranch, DollarSign, Bell, Shield, Settings as Gear,
  ChevronRight, Sliders, Workflow, Globe, Hash, Package, CheckCircle2,
  Plus, Edit, Trash2, Loader2, Save, RotateCcw, AlertTriangle, Info, TrendingUp,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SECTION_ICONS: Record<string, React.FC<any>> = {
  organization: Building2, users: Users, departments: GitBranch,
  lookups: Hash, coding: Hash, approvals: Shield, budgets: DollarSign, workflow: Workflow,
  tolerance: Sliders, paymentterms: DollarSign, taxrates: DollarSign,
  exchangerates: Globe, customfields: Package,
  notifications: Bell, localization: Globe, numbering: Hash, security: Gear,
  profile: Users,
};

const SECTION_DEFS = [
  { id: "organization", group: "Organisation", desc: "Identité, adresse, branding" },
  { id: "users",        group: "Organisation", desc: "Utilisateurs et rôles" },
  { id: "departments",  group: "Organisation", desc: "Structure organisationnelle" },
  { id: "lookups",      group: "Organisation", desc: "Catégories, centres de coût, comptes GL" },
  { id: "coding",       group: "Organisation", desc: "Plan comptable, centres de coût, projets" },
  { id: "approvals",    group: "Flux de travail", desc: "Politiques et étapes d'approbation" },
  { id: "workflow",     group: "Flux de travail", desc: "Automatisation et seuils" },
  { id: "budgets",      group: "Contrôle budgétaire", desc: "Politiques budgétaires" },
  { id: "tolerance",    group: "Contrôle budgétaire", desc: "Tolérances rapprochement 3 voies" },
  { id: "paymentterms", group: "Finance", desc: "Conditions de paiement fournisseurs" },
  { id: "taxrates",     group: "Finance", desc: "Taux de TVA et taxes applicables" },
  { id: "exchangerates",group: "Finance", desc: "Taux de change vs devise principale" },
  { id: "customfields", group: "Personnalisation", desc: "Champs sur PR, BC, factures, fournisseurs" },
  { id: "profile",       group: "Mon Compte", desc: "Photo et informations personnelles" },
  { id: "notifications",group: "Système", desc: "Alertes et événements" },
  { id: "numbering",    group: "Système", desc: "Séquences de numérotation" },
  { id: "localization", group: "Système", desc: "Langue et format" },
  { id: "security",     group: "Système", desc: "Audit et sécurité" },
];

const groups = [...new Set(SECTION_DEFS.map(s => s.group))];

// ─── Labels ───────────────────────────────────────────────────────────────────
const SECTION_LABELS: Record<string, string> = {
  organization: "Organisation", users: "Utilisateurs", departments: "Départements",
  lookups: "Valeurs de référence",
  coding: "Codification comptable", approvals: "Approbations", workflow: "Flux de travail",
  budgets: "Politiques budgétaires", tolerance: "Tolérances 3 voies",
  paymentterms: "Conditions de paiement", taxrates: "Taux de taxes",
  exchangerates: "Taux de change", customfields: "Champs personnalisés",
  profile: "Mon Profil", notifications: "Notifications",
  numbering: "Numérotation", localization: "Localisation", security: "Sécurité",
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [section, setSection] = useState("organization");
  const isAdmin = user?.role === "admin";
  const { colorPreset } = useTheme();
  const activeColor = COLOR_PRESETS.find(p => p.id === colorPreset)?.primary || "221 83% 53%";

  const activeSection = SECTION_DEFS.find(s => s.id === section);
  const ActiveIcon = SECTION_ICONS[section] ?? Gear;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r flex flex-col shrink-0 bg-gray-50/50">
        {/* Header */}
        <div className="px-4 py-4 border-b bg-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `hsl(${activeColor} / 0.15)` }}>
              <Gear className="h-4 w-4" style={{ color: `hsl(${activeColor})` }} />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Paramètres</h1>
              <p className="text-xs text-muted-foreground">Configuration</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {groups.map(group => (
            <div key={group} className="mb-1">
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-4 py-2">{group}</p>
              {SECTION_DEFS.filter(s => s.group === group).map(s => {
                const Icon = SECTION_ICONS[s.id] ?? Gear;
                const active = section === s.id;
                return (
                  <button key={s.id} onClick={() => setSection(s.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 mx-1 py-2 rounded-lg text-left transition-all text-sm",
                      "w-[calc(100%-8px)]",
                      active ? "text-white shadow-sm" : "hover:bg-white hover:shadow-sm text-gray-600"
                    )}
                    style={active ? { backgroundColor: `hsl(${activeColor})` } : {}}>
                    <div className={cn(
                      "h-7 w-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                      active ? "bg-white/20" : "bg-white border border-gray-200"
                    )}>
                      <Icon className={cn("h-3.5 w-3.5", active ? "text-white" : "text-gray-500")} />
                    </div>
                    <span className={cn("font-medium text-sm", active ? "text-white" : "text-gray-700")}>
                      {SECTION_LABELS[s.id] ?? s.id}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        {!isAdmin && (
          <div className="p-3 border-t bg-white">
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">Accès admin requis</p>
            </div>
          </div>
        )}
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-white">
        {section === "organization"  && <OrgSection isAdmin={isAdmin} />}
        {section === "users"         && <UsersSection isAdmin={isAdmin} />}
        {section === "departments"   && <DepartmentsSection isAdmin={isAdmin} />}
        {section === "lookups"       && <LookupsSection isAdmin={isAdmin} />}
        {section === "coding"        && <CodingSection isAdmin={isAdmin} />}
        {section === "approvals"     && <ApprovalsSection isAdmin={isAdmin} />}
        {section === "workflow"      && <WorkflowSection isAdmin={isAdmin} />}
        {section === "budgets"       && <BudgetsSection isAdmin={isAdmin} />}
        {section === "tolerance"     && <ToleranceSection isAdmin={isAdmin} />}
        {section === "paymentterms"  && <PaymentTermsSection isAdmin={isAdmin} />}
        {section === "taxrates"      && <TaxRatesSection isAdmin={isAdmin} />}
        {section === "exchangerates" && <ExchangeRatesSection isAdmin={isAdmin} />}
        {section === "customfields"  && <CustomFieldsSection isAdmin={isAdmin} />}
        {section === "profile"       && <ProfileSection />}
        {section === "notifications" && <NotificationsSection isAdmin={isAdmin} />}
        {section === "numbering"     && <NumberingSection isAdmin={isAdmin} />}
        {section === "localization"  && <LocalizationSection isAdmin={isAdmin} />}
        {section === "security"      && <SecuritySection />}
      </main>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, desc }: { icon: React.FC<any>; title: string; desc: string }) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center gap-3">
      <div><h2 className="text-base font-semibold text-gray-900">{title}</h2><p className="text-xs text-muted-foreground mt-0.5">{desc}</p></div>
    </div>
  );
}

function SaveBar({ onSave, pending, onReset }: { onSave: () => void; pending: boolean; onReset?: () => void }) {
  return (
    <div className="flex justify-end gap-3 pt-6 border-t mt-6">
      {onReset && <Button variant="outline" onClick={onReset} disabled={pending}><RotateCcw className="mr-2 h-4 w-4" />Réinitialiser</Button>}
      <button onClick={onSave} disabled={pending} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
        {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : <><Save className="mr-2 h-4 w-4" />Enregistrer</>}
      </button>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg mt-4">
      <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
      <p className="text-sm text-blue-800">{children}</p>
    </div>
  );
}

// ─── Organisation ─────────────────────────────────────────────────────────────
function OrgSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org, isLoading } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    legalName: "", tradeName: "", country: "Benin", baseCurrency: "XOF",
    fiscalYearStart: "01-01", address: "", city: "", phone: "", email: "",
    website: "", taxId: "", primaryColor: "#2563eb", logoUrl: "",
  });

  useEffect(() => {
    if (org) setForm(f => ({
      ...f,
      legalName: org.legalName ?? "",
      tradeName: (org as any).tradeName ?? "",
      country: org.country ?? "Benin",
      baseCurrency: org.baseCurrency ?? "XOF",
      fiscalYearStart: org.fiscalYearStart ?? "01-01",
      address: (org as any).address ?? "",
      city: (org as any).city ?? "",
      phone: (org as any).phone ?? "",
      email: (org as any).email ?? "",
      website: (org as any).website ?? "",
      taxId: (org as any).taxId ?? "",
      primaryColor: (org as any).primaryColor ?? "#2563eb",
      logoUrl: (org as any).logoUrl ?? "",
    }));
  }, [org]);

  const mut = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Organisation mise à jour"); utils.settings.getOrganization.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const COUNTRIES = ["Bénin", "Côte d'Ivoire", "Togo", "Sénégal", "Mali", "Burkina Faso", "Niger", "Guinée", "Ghana", "Nigeria", "Cameroun"];
  const CURRENCIES = [{ code: "XOF", label: "Franc CFA BCEAO (XOF)" }, { code: "XAF", label: "Franc CFA BEAC (XAF)" }, { code: "GHS", label: "Cedi ghanéen (GHS)" }, { code: "NGN", label: "Naira nigérian (NGN)" }, { code: "EUR", label: "Euro (EUR)" }, { code: "USD", label: "Dollar US (USD)" }];

  if (isLoading) return <div className="p-6 max-w-3xl space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>;

  return (
    <div>
      <SectionHeader icon={Building2} title="Organisation" desc="Informations légales, contact et branding" />
      <div className="p-6 space-y-6 max-w-3xl">

        <Card>
          <CardHeader><CardTitle>Identité légale</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Raison sociale *</Label><Input value={form.legalName} onChange={e => setForm(f => ({...f, legalName: e.target.value}))} disabled={!isAdmin} /></div>
              <div className="space-y-2"><Label>Nom commercial</Label><Input value={form.tradeName} onChange={e => setForm(f => ({...f, tradeName: e.target.value}))} disabled={!isAdmin} /></div>
              <div className="space-y-2"><Label>Pays</Label>
                <Select value={form.country} onValueChange={v => setForm(f => ({...f, country: v}))} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Identifiant fiscal (IFU)</Label><Input value={form.taxId} onChange={e => setForm(f => ({...f, taxId: e.target.value}))} placeholder="IFU / RCCM" disabled={!isAdmin} /></div>
              <div className="space-y-2"><Label>Devise principale</Label>
                <Select value={form.baseCurrency} onValueChange={v => setForm(f => ({...f, baseCurrency: v}))} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Début d'exercice fiscal (MM-JJ)</Label><Input value={form.fiscalYearStart} onChange={e => setForm(f => ({...f, fiscalYearStart: e.target.value}))} placeholder="01-01" pattern="\d{2}-\d{2}" disabled={!isAdmin} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2"><Label>Adresse</Label><Input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="Rue, Quartier..." disabled={!isAdmin} /></div>
              <div className="space-y-2"><Label>Ville</Label><Input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} placeholder="Cotonou" disabled={!isAdmin} /></div>
              <div className="space-y-2"><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+229 XX XX XX XX" disabled={!isAdmin} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="contact@entreprise.com" disabled={!isAdmin} /></div>
              <div className="space-y-2"><Label>Site web</Label><Input value={form.website} onChange={e => setForm(f => ({...f, website: e.target.value}))} placeholder="https://www.entreprise.com" disabled={!isAdmin} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Branding</CardTitle><CardDescription>Logo et couleur principale de l'interface</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            {/* Logo upload */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Logo de l'organisation</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-52 border-2 border-dashed rounded-xl flex items-center justify-center bg-white overflow-hidden shadow-sm">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="Logo" className="max-h-16 max-w-48 object-contain p-2" />
                  ) : (
                    <div className="text-center">
                      <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-xs text-muted-foreground mt-1.5">Aucun logo chargé</p>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden" id="logo-upload"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) { toast.error("Logo trop grand. Max 2 Mo."); return; }
                        const reader = new FileReader();
                        reader.onload = (ev) => setForm(f => ({...f, logoUrl: ev.target?.result as string}));
                        reader.readAsDataURL(file);
                      }}
                    />
                    <label htmlFor="logo-upload"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                      <Plus className="h-4 w-4" />Choisir un logo
                    </label>
                    {form.logoUrl && (
                      <button onClick={() => setForm(f => ({...f, logoUrl: ""}))}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                        <Trash2 className="h-3 w-3" />Supprimer
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">PNG, SVG, WebP · max 2 Mo<br/>Recommandé: fond transparent, min 200×60px</p>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Couleur principale</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">Appliquée sur les boutons et éléments actifs de l'interface</p>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_PRESETS.map(preset => (
                  <button key={preset.id} type="button" disabled={!isAdmin}
                    onClick={() => setForm(f => ({...f, primaryColor: `hsl(${preset.primary})`}))}
                    className="flex flex-col items-center gap-1.5 group disabled:opacity-50 disabled:cursor-not-allowed">
                    <div className={`h-9 w-9 rounded-full transition-all ${form.primaryColor === `hsl(${preset.primary})` ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: `hsl(${preset.primary})` }}>
                      {form.primaryColor === `hsl(${preset.primary})` && (
                        <div className="h-full w-full flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{preset.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Couleur actuelle: <strong>{COLOR_PRESETS.find(p => `hsl(${p.primary})` === form.primaryColor)?.label || form.primaryColor}</strong></p>
            </div>
          </CardContent>
        </Card>

        {isAdmin && <SaveBar onSave={() => mut.mutate(form as any)} pending={mut.isPending} />}
      </div>
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
function UsersSection({ isAdmin }: { isAdmin: boolean }) {
  const { user: currentUser } = useAuth();
  const { data: users = [], isLoading } = trpc.settings.listUsers.useQuery();
  const { data: departments = [] } = trpc.settings.listDepartments.useQuery();
  const utils = trpc.useUtils();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [tempPwd, setTempPwd] = useState<{open:boolean;password:string;email:string}>({open:false,password:"",email:""});
  const [inviteForm, setInviteForm] = useState({ name:"", email:"", role:"requester", departmentId:"", approvalLimit:"" });
  const [editForm, setEditForm] = useState({ role:"", departmentId:"", approvalLimit:"", status:"active" });

  const inviteMut = trpc.settings.inviteUser.useMutation({
    onSuccess: (data) => { setInviteOpen(false); setTempPwd({open:true,password:data.tempPassword,email:inviteForm.email}); setInviteForm({name:"",email:"",role:"requester",departmentId:"",approvalLimit:""}); utils.settings.listUsers.invalidate(); },
    onError: (e:any) => toast.error(e.message),
  });
  const updateMut = trpc.settings.updateUser.useMutation({
    onSuccess: () => { toast.success("Utilisateur mis à jour"); utils.settings.listUsers.invalidate(); setEditUser(null); },
    onError: (e:any) => toast.error(e.message),
  });
  const resetPwdMut = trpc.settings.resetUserPassword.useMutation({
    onSuccess: (data) => setTempPwd({open:true,password:data.tempPassword,email:editUser?.email||""}),
    onError: (e:any) => toast.error(e.message),
  });
  const startImpersonate = trpc.impersonate.start.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: (e:any) => toast.error(e.message),
  });
  const stopImpersonate = trpc.impersonate.stop.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: (e:any) => toast.error(e.message),
  });
  const { data: impStatus } = trpc.impersonate.status.useQuery(undefined, { refetchOnWindowFocus: false });

  const ROLE_LABELS: Record<string,string> = { admin:"Administrateur", procurement_manager:"Resp. achats", approver:"Approbateur", requester:"Demandeur" };
  const ROLE_COLORS: Record<string,string> = { admin:"bg-purple-100 text-purple-800", procurement_manager:"bg-blue-100 text-blue-800", approver:"bg-green-100 text-green-800", requester:"bg-gray-100 text-gray-700" };

  return (
    <div>
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Users className="h-5 w-5" />Utilisateurs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Gérer les accès, rôles et limites d'approbation</p>
        </div>
        {isAdmin && (
          <button onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{backgroundColor: "#2563eb"}}>
            <Plus className="h-4 w-4" />Inviter un utilisateur
          </button>
        )}
      </div>
      <div className="p-6 pt-2 max-w-5xl">
        <Card>
          <CardContent className="p-0">
            {isLoading ? <div className="p-8 text-center text-muted-foreground">Chargement...</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Département</TableHead>
                    <TableHead className="text-right">Limite approbation</TableHead>
                    <TableHead>Statut</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u:any) => (
                    <TableRow key={u.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{u.email || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || ""}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {departments.find((d:any) => d.id === u.departmentId)?.name || "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {u.approvalLimit ? `${new Intl.NumberFormat("fr-FR").format(parseFloat(u.approvalLimit))} XOF` : "Illimité"}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${u.status === "active" ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {u.status === "active" ? "Actif" : "Désactivé"}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {currentUser?.id !== u.id && (
                              impStatus?.isImpersonating ? (
                                <Button variant="outline" size="sm" className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                                  onClick={() => stopImpersonate.mutate()} disabled={stopImpersonate.isPending}>
                                  Quitter
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" className="h-7 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                                  onClick={() => startImpersonate.mutate({ targetUserId: u.id })} disabled={startImpersonate.isPending}>
                                  Agir en tant que
                                </Button>
                              )
                            )}
                            <Button size="sm" variant="ghost" title="Réinitialiser le mot de passe"
                              onClick={() => { setEditUser(u); resetPwdMut.mutate({ userId: u.id }); }}>
                              🔑
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditUser(u);
                              setEditForm({ role: u.role, departmentId: u.departmentId?.toString()||"", approvalLimit: u.approvalLimit||"", status: u.status });
                            }}><Edit className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Invite Dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Inviter un utilisateur</DialogTitle>
              <DialogDescription>Créez un compte avec un mot de passe temporaire.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Nom complet *</Label>
                <Input value={inviteForm.name} onChange={e => setInviteForm(f=>({...f,name:e.target.value}))} placeholder="Jean Dupont" />
              </div>
              <div className="space-y-2"><Label>Email *</Label>
                <Input type="email" value={inviteForm.email} onChange={e => setInviteForm(f=>({...f,email:e.target.value}))} placeholder="jean@exemple.com" />
              </div>
              <div className="space-y-2"><Label>Rôle *</Label>
                <Select value={inviteForm.role} onValueChange={v => setInviteForm(f=>({...f,role:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="procurement_manager">Responsable achats</SelectItem>
                    <SelectItem value="approver">Approbateur</SelectItem>
                    <SelectItem value="requester">Demandeur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Département</Label>
                <Select value={inviteForm.departmentId || "none"} onValueChange={v => setInviteForm(f=>({...f,departmentId:v === "none" ? "" : v}))}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {departments.map((d:any) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Limite d'approbation (XOF)</Label>
                <Input type="number" value={inviteForm.approvalLimit} onChange={e => setInviteForm(f=>({...f,approvalLimit:e.target.value}))} placeholder="Laisser vide = illimité" />
              </div>
            </div>
            <DialogFooter>
              <button onClick={() => setInviteOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={() => inviteMut.mutate({ name:inviteForm.name, email:inviteForm.email, role:inviteForm.role as any, departmentId:inviteForm.departmentId?Number(inviteForm.departmentId):undefined, approvalLimit:inviteForm.approvalLimit||undefined })}
                disabled={inviteMut.isPending||!inviteForm.name||!inviteForm.email}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 btn-primary">
                {inviteMut.isPending ? "Création..." : "Créer et inviter"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Temp Password Dialog */}
        <Dialog open={tempPwd.open} onOpenChange={o => setTempPwd(d=>({...d,open:o}))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mot de passe temporaire</DialogTitle>
              <DialogDescription>Communiquez ces identifiants à {tempPwd.email} de façon sécurisée.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-xs font-medium text-amber-800 mb-1">Email: {tempPwd.email}</p>
                <p className="text-xs font-medium text-amber-800 mb-1">Mot de passe temporaire:</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xl font-bold text-amber-900 tracking-widest">{tempPwd.password}</p>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(tempPwd.password); toast.success("Copié!"); }}>📋</Button>
                </div>
              </div>
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-3">L'utilisateur devra changer son mot de passe via Paramètres → Mon Profil.</p>
              <p className="text-xs text-muted-foreground">Lien: <strong>{window.location.origin}/login</strong></p>
            </div>
            <DialogFooter><button onClick={() => setTempPwd(d=>({...d,open:false}))} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">Fermer</button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editUser && !resetPwdMut.isPending && !tempPwd.open} onOpenChange={() => setEditUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier l'utilisateur</DialogTitle>
              <DialogDescription>{editUser?.name} — {editUser?.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Rôle</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm(f=>({...f,role:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="procurement_manager">Responsable achats</SelectItem>
                    <SelectItem value="approver">Approbateur</SelectItem>
                    <SelectItem value="requester">Demandeur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Département</Label>
                <Select value={editForm.departmentId || "none"} onValueChange={v => setEditForm(f=>({...f,departmentId:v === "none" ? "" : v}))}>
                  <SelectTrigger><SelectValue placeholder="Aucun département" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {departments.map((d:any) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Limite d'approbation (XOF)</Label>
                <Input type="number" value={editForm.approvalLimit} onChange={e => setEditForm(f=>({...f,approvalLimit:e.target.value}))} placeholder="Laisser vide = illimité" />
              </div>
              <div className="space-y-2"><Label>Statut</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f=>({...f,status:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="disabled">Désactivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUser(null)}>Annuler</Button>
              <button disabled={updateMut.isPending} onClick={() => updateMut.mutate({ userId:editUser.id, role:editForm.role as any, departmentId:editForm.departmentId?parseInt(editForm.departmentId):undefined, approvalLimit:editForm.approvalLimit||undefined, status:editForm.status as any })} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {updateMut.isPending ? "Enregistrement..." : "Enregistrer"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
// ─── Departments ──────────────────────────────────────────────────────────────
function DepartmentsSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: departments = [], isLoading } = trpc.settings.listDepartments.useQuery();
  const { data: users = [] } = trpc.settings.listUsers.useQuery();
  const utils = trpc.useUtils();
  const [newOpen, setNewOpen] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [managerId, setManagerId] = useState("");

  const createMut = trpc.settings.createDepartment.useMutation({
    onSuccess: () => { toast.success("Département créé"); utils.settings.listDepartments.invalidate(); setNewOpen(false); setCode(""); setName(""); setManagerId(""); },
    onError: (e: any) => toast.error(e.message),
  });
  const [deptIsActive, setDeptIsActive] = useState(true);
  const updateMut = trpc.settings.updateDepartment.useMutation({
    onSuccess: () => { toast.success("Département mis à jour"); utils.settings.listDepartments.invalidate(); setEditDept(null); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <SectionHeader icon={GitBranch} title="Départements" desc="Structure organisationnelle et centres de coût" />
      <div className="p-6 max-w-3xl">
        {isAdmin && (
          <div className="flex justify-end mb-4">
            <button onClick={() => setNewOpen(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"><Plus className="h-4 w-4" />Nouveau département</button>
          </div>
        )}
        <Card>
          <CardContent className="p-0">
            {isLoading ? <div className="p-8 text-center text-muted-foreground">Chargement...</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Statut</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((d: any) => (
                    <TableRow key={d.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{d.code}</TableCell>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {users.find((u: any) => u.id === d.managerId)?.name || "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${d.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {d.isActive ? "Actif" : "Inactif"}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => { setEditDept(d); setCode(d.code); setName(d.name); setManagerId(d.managerId?.toString() || ""); setDeptIsActive(d.isActive !== false); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {departments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun département</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* New / Edit dialog */}
        <Dialog open={newOpen || !!editDept} onOpenChange={v => { if (!v) { setNewOpen(false); setEditDept(null); }}}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editDept ? "Modifier le département" : "Nouveau département"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Code *</Label><Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="IT" /></div>
                <div className="space-y-2"><Label>Nom *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Informatique" /></div>
              </div>
              <div className="space-y-2"><Label>Responsable</Label>
                <Select value={managerId || "none"} onValueChange={v => setManagerId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un responsable" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {users.filter((u: any) => u.status === "active").map((u: any) => (
                      <SelectItem key={u.id} value={u.id.toString()}>{u.name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editDept && (
              <div className="flex items-center justify-between px-1 py-2 border-t mt-2">
                <div>
                  <p className="text-sm font-medium">Statut du département</p>
                  <p className="text-xs text-muted-foreground">Les départements inactifs ne peuvent plus être sélectionnés</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${deptIsActive ? "text-emerald-700" : "text-gray-500"}`}>{deptIsActive ? "Actif" : "Inactif"}</span>
                  <button onClick={() => setDeptIsActive(!deptIsActive)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${deptIsActive ? "bg-emerald-500" : "bg-gray-300"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${deptIsActive ? "translate-x-4.5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setNewOpen(false); setEditDept(null); }}>Annuler</Button>
              <button disabled={!code || !name || createMut.isPending || updateMut.isPending} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                onClick={() => editDept
                  ? updateMut.mutate({ id: editDept.id, code, name, managerId: managerId ? parseInt(managerId) : undefined, isActive: deptIsActive })
                  : createMut.mutate({ code, name, managerId: managerId ? parseInt(managerId) : undefined })}>
                {(createMut.isPending || updateMut.isPending) ? "Enregistrement..." : "Enregistrer"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ─── Approvals (with steps builder) ──────────────────────────────────────────
function PolicyStepsPanel({ policyId, isAdmin, users }: { policyId: number; isAdmin: boolean; users: any[] }) {
  const utils = trpc.useUtils();
  const { data: allSteps = [] } = trpc.settings.getApprovalSteps.useQuery();
  const steps = allSteps.filter((s: any) => s.policyId === policyId).sort((a: any, b: any) => a.stepOrder - b.stepOrder);
  const [addOpen, setAddOpen] = useState(false);
  const [stepForm, setStepForm] = useState({ stepOrder: steps.length + 1, approverType: "user", approverId: "", isParallel: false });

  const addMut = trpc.settings.addApprovalStep.useMutation({
    onSuccess: () => { toast.success("Étape ajoutée"); utils.settings.getApprovalSteps.invalidate(); setAddOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = trpc.settings.deleteApprovalStep.useMutation({
    onSuccess: () => { toast.success("Étape supprimée"); utils.settings.getApprovalSteps.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const ROLE_LABELS: Record<string, string> = { admin: "Administrateur", procurement_manager: "Resp. achats", approver: "Approbateur" };

  return (
    <div className="mt-3 pl-10 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Étapes d'approbation</p>
      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Aucune étape — les demandes passent directement.</p>
      ) : (
        <div className="space-y-1.5">
          {steps.map((s: any, i: number) => (
            <div key={s.id} className="flex items-center gap-3 p-2 bg-muted/40 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">{i + 1}</div>
              <div className="flex-1 text-sm">
                {s.approverType === "user" && s.approverId
                  ? users.find(u => u.id === s.approverId)?.name || `Utilisateur #${s.approverId}`
                  : s.approverType === "role" ? `Tous les ${ROLE_LABELS[s.approverId] || s.approverId}`
                  : "Responsable direct"}
                {s.isParallel && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Parallèle</span>}
              </div>
              {isAdmin && (
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => delMut.mutate({ stepId: s.id })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {isAdmin && (
        <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => { setStepForm(f => ({...f, stepOrder: steps.length + 1})); setAddOpen(true); }}>
          <Plus className="mr-1 h-3 w-3" />Ajouter une étape
        </Button>
      )}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ajouter une étape d'approbation</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2"><Label>Type d'approbateur</Label>
              <Select value={stepForm.approverType} onValueChange={v => setStepForm(f => ({...f, approverType: v, approverId: ""}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Utilisateur spécifique</SelectItem>
                  <SelectItem value="role">Par rôle (premier disponible)</SelectItem>
                  <SelectItem value="manager">Responsable direct du demandeur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {stepForm.approverType === "user" && (
              <div className="space-y-2"><Label>Approbateur *</Label>
                <Select value={stepForm.approverId} onValueChange={v => setStepForm(f => ({...f, approverId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un utilisateur" /></SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.status === "active").map((u: any) => (
                      <SelectItem key={u.id} value={u.id.toString()}>{u.name || u.email} <span className="text-muted-foreground text-xs ml-1">— {ROLE_LABELS[u.role] || u.role}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {stepForm.approverType === "role" && (
              <div className="space-y-2"><Label>Rôle *</Label>
                <Select value={stepForm.approverId} onValueChange={v => setStepForm(f => ({...f, approverId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div><Label>Approbation parallèle</Label><p className="text-xs text-muted-foreground">S'exécute en même temps que l'étape précédente</p></div>
              <button type="button" onClick={() => setStepForm(f => ({...f, isParallel: !f.isParallel}))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${stepForm.isParallel ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${stepForm.isParallel ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <button disabled={addMut.isPending || (stepForm.approverType !== "manager" && !stepForm.approverId)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              onClick={() => addMut.mutate({
                policyId,
                stepOrder: stepForm.stepOrder,
                approverType: stepForm.approverType as any,
                approverId: stepForm.approverType === "user" ? parseInt(stepForm.approverId) : undefined,
                roleRef: stepForm.approverType === "role" ? stepForm.approverId as any : undefined,
                isParallel: stepForm.isParallel,
              })}>
              {addMut.isPending ? "Ajout..." : "Ajouter"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApprovalsSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: policies = [], isLoading } = trpc.settings.getApprovalPolicies.useQuery();
  const { data: users = [] } = trpc.settings.listUsers.useQuery();
  const utils = trpc.useUtils();
  const [newOpen, setNewOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pName, setPName] = useState(""); const [minAmt, setMinAmt] = useState(""); const [maxAmt, setMaxAmt] = useState("");
  const [deptIds, setDeptIds] = useState("");

  const createMut = trpc.settings.createApprovalPolicy.useMutation({
    onSuccess: () => { toast.success("Politique créée"); utils.settings.getApprovalPolicies.invalidate(); setNewOpen(false); setPName(""); setMinAmt(""); setMaxAmt(""); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = trpc.settings.deleteApprovalPolicy.useMutation({
    onSuccess: () => { toast.success("Politique supprimée"); utils.settings.getApprovalPolicies.invalidate(); if (expanded && expanded === policies.find((p: any) => p.id === expanded)?.id) setExpanded(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const togglePolicyMut = trpc.settings.updateApprovalPolicy.useMutation({
    onSuccess: () => { toast.success("Statut de la politique mis à jour"); utils.settings.getApprovalPolicies.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  return (
    <div>
      <SectionHeader icon={Shield} title="Politiques d'approbation" desc="Définir les règles de routage et les étapes d'approbation par condition" />
      <div className="p-6 max-w-4xl">
        <InfoBox>
          Chaque politique définit (1) les <strong>conditions</strong> de déclenchement (montant, département, urgence) et (2) les <strong>étapes</strong> séquentielles d'approbation. Cliquez sur une politique pour gérer ses étapes.
        </InfoBox>

        {isAdmin && (
          <div className="flex justify-end mt-4 mb-4">
            <button onClick={() => setNewOpen(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"><Plus className="h-4 w-4" />Nouvelle politique</button>
          </div>
        )}

        <div className="space-y-3">
          {isLoading ? <div className="p-8 text-center text-muted-foreground">Chargement...</div> :
            policies.length === 0 ? (
              <Card><CardContent className="p-8 text-center">
                <Shield className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Aucune politique — toutes les demandes sont auto-approuvées</p>
                {isAdmin && <button onClick={() => setNewOpen(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mt-4"><Plus className="h-4 w-4" />Créer la première politique</button>}
              </CardContent></Card>
            ) : policies.map((p: any, i: number) => (
              <Card key={p.id} className={cn("transition-shadow", expanded === p.id ? "border-primary shadow-sm" : "hover:shadow-sm")}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">{i + 1}</div>
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {p.conditions?.minAmount != null && <span className="text-xs bg-muted px-2 py-0.5 rounded">≥ {fmt(p.conditions.minAmount)} XOF</span>}
                          {p.conditions?.maxAmount != null && <span className="text-xs bg-muted px-2 py-0.5 rounded">≤ {fmt(p.conditions.maxAmount)} XOF</span>}
                          {!p.conditions?.minAmount && !p.conditions?.maxAmount && <span className="text-xs text-muted-foreground">Tous montants</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.isActive ? "default" : "outline"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); togglePolicyMut.mutate({ id: p.id, isActive: !p.isActive }); }}
                          className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${p.isActive ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
                          {p.isActive ? "Désactiver" : "Activer"}
                        </button>
                      )}
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded === p.id ? "rotate-90" : "")} />
                    </div>
                  </div>
                  {expanded === p.id && (
                    <PolicyStepsPanel policyId={p.id} isAdmin={isAdmin} users={users as any[]} />
                  )}
                </CardContent>
              </Card>
            ))
          }
        </div>

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle politique d'approbation</DialogTitle><DialogDescription>Définissez les conditions de déclenchement. Vous pourrez ajouter les étapes après création.</DialogDescription></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Nom de la politique *</Label><Input value={pName} onChange={e => setPName(e.target.value)} placeholder="Ex: Approbation DG — Montants > 5M XOF" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Montant minimum (XOF)</Label><Input type="number" value={minAmt} onChange={e => setMinAmt(e.target.value)} placeholder="0 = pas de minimum" /></div>
                <div className="space-y-2"><Label>Montant maximum (XOF)</Label><Input type="number" value={maxAmt} onChange={e => setMaxAmt(e.target.value)} placeholder="Vide = illimité" /></div>
              </div>
              <InfoBox>Après création, cliquez sur la politique pour ajouter des étapes d'approbation (approbateurs séquentiels ou parallèles).</InfoBox>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewOpen(false)}>Annuler</Button>
              <button disabled={!pName || createMut.isPending} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                onClick={() => createMut.mutate({ name: pName, conditions: { minAmount: minAmt ? parseFloat(minAmt) : undefined, maxAmount: maxAmt ? parseFloat(maxAmt) : undefined }, requiresAllApprovals: true })}>
                {createMut.isPending ? "Création..." : "Créer la politique"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ─── Workflow ─────────────────────────────────────────────────────────────────
function WorkflowSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();
  const defaults = { autoApproveAmount: 0, requireJustification: false, minRFQVendors: 3, rfqDeadlineDays: 14, poAutoIssue: false, slaHours: 48, escalationEnabled: true, segregationOfDuties: true };
  const [cfg, setCfg] = useState(defaults);

  useEffect(() => {
    const w = (org as any)?.settings?.workflowSettings;
    if (w) setCfg({ ...defaults, ...w });
  }, [org]);

  const mut = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Configuration du flux mise à jour"); utils.settings.getOrganization.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const Row = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-start justify-between py-4 border-b last:border-0">
      <div className="flex-1 mr-8">
        <p className="font-medium text-sm">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  return (
    <div>
      <SectionHeader icon={Workflow} title="Flux de travail" desc="Automatisation, seuils et règles métier" />
      <div className="p-6 max-w-3xl space-y-6">
        <Card>
          <CardHeader><CardTitle>Approbations automatiques</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <Row label="Seuil d'auto-approbation (XOF)" desc="Les demandes inférieures à ce montant sont approuvées automatiquement (0 = désactivé)">
              <Input type="number" value={cfg.autoApproveAmount} onChange={e => setCfg(c => ({...c, autoApproveAmount: parseFloat(e.target.value) || 0}))} disabled={!isAdmin} className="w-44" />
            </Row>
            <Row label="SLA d'approbation (heures)" desc="Délai avant escalade automatique">
              <Input type="number" value={cfg.slaHours} onChange={e => setCfg(c => ({...c, slaHours: parseInt(e.target.value) || 48}))} disabled={!isAdmin} className="w-24" />
            </Row>
            <Row label="Escalade automatique" desc="Notifier les managers si le délai est dépassé">
              <button type="button" disabled={!isAdmin}
                onClick={() => setCfg(c => ({...c, escalationEnabled: !c.escalationEnabled}))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${cfg.escalationEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${cfg.escalationEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </Row>
            <Row label="Séparation des tâches" desc="Bloquer l'auto-approbation d'une demande par son créateur">
              <button type="button" disabled={!isAdmin}
                onClick={() => setCfg(c => ({...c, segregationOfDuties: !c.segregationOfDuties}))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${cfg.segregationOfDuties ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${cfg.segregationOfDuties ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Demandes d'achat</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <Row label="Justification obligatoire" desc="Exiger un texte de justification sur toutes les demandes">
              <button type="button" disabled={!isAdmin}
                onClick={() => setCfg(c => ({...c, requireJustification: !c.requireJustification}))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${cfg.requireJustification ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${cfg.requireJustification ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </Row>
            <Row label="Émettre le BC automatiquement" desc="Créer et émettre le bon de commande dès approbation complète">
              <button type="button" disabled={!isAdmin}
                onClick={() => setCfg(c => ({...c, poAutoIssue: !c.poAutoIssue}))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${cfg.poAutoIssue ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${cfg.poAutoIssue ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Appels d'offres (RFQ)</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <Row label="Nombre minimum de fournisseurs" desc="Nombre minimum de fournisseurs à inviter par RFQ">
              <Input type="number" value={cfg.minRFQVendors} onChange={e => setCfg(c => ({...c, minRFQVendors: parseInt(e.target.value) || 3}))} disabled={!isAdmin} className="w-24" min={1} max={20} />
            </Row>
            <Row label="Délai de réponse par défaut (jours)" desc="Délai par défaut pour les réponses aux RFQ">
              <Input type="number" value={cfg.rfqDeadlineDays} onChange={e => setCfg(c => ({...c, rfqDeadlineDays: parseInt(e.target.value) || 14}))} disabled={!isAdmin} className="w-24" min={1} max={90} />
            </Row>
          </CardContent>
        </Card>

        {isAdmin && <SaveBar onSave={() => mut.mutate({ settings: { workflowSettings: cfg } } as any)} pending={mut.isPending} />}
      </div>
    </div>
  );
}

// ─── Budgets ──────────────────────────────────────────────────────────────────
function BudgetsSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();
  const defaults = { enforceBudgetCheck: true, warningThresholdPercent: 80, criticalThresholdPercent: 95, allowOverspend: false, requireBudgetCode: false, carryForwardUnspent: false };
  const [cfg, setCfg] = useState(defaults);

  useEffect(() => {
    const b = (org as any)?.settings?.budgetPolicies;
    if (b) setCfg({ ...defaults, ...b });
  }, [org]);

  const mut = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Politiques budgétaires mises à jour"); utils.settings.getOrganization.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const Row = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-start justify-between py-4 border-b last:border-0">
      <div className="flex-1 mr-8"><p className="font-medium text-sm">{label}</p>{desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  return (
    <div>
      <SectionHeader icon={DollarSign} title="Politiques budgétaires" desc="Contrôle des dépenses et gestion des dépassements" />
      <div className="p-6 max-w-3xl space-y-6">
        <Card>
          <CardHeader><CardTitle>Contrôle budgétaire</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <Row label="Vérification budgétaire obligatoire" desc="Bloquer les demandes qui dépassent le budget disponible">
              <button type="button" disabled={!isAdmin}
                onClick={() => setCfg(c => ({...c, enforceBudgetCheck: !c.enforceBudgetCheck}))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${cfg.enforceBudgetCheck ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${cfg.enforceBudgetCheck ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </Row>
            <Row label="Autoriser les dépassements avec justification" desc="Permettre les dépassements si une raison est fournie">
              <button type="button" disabled={!isAdmin}
                onClick={() => setCfg(c => ({...c, allowOverspend: !c.allowOverspend}))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${cfg.allowOverspend ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${cfg.allowOverspend ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </Row>
            <Row label="Code budget obligatoire" desc="Exiger un centre de coût sur chaque demande d'achat">
              <button type="button" disabled={!isAdmin}
                onClick={() => setCfg(c => ({...c, requireBudgetCode: !c.requireBudgetCode}))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${cfg.requireBudgetCode ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${cfg.requireBudgetCode ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </Row>
            <Row label="Reporter le solde non consommé" desc="Transférer automatiquement les budgets non utilisés à la période suivante">
              <button type="button" disabled={!isAdmin}
                onClick={() => setCfg(c => ({...c, carryForwardUnspent: !c.carryForwardUnspent}))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${cfg.carryForwardUnspent ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${cfg.carryForwardUnspent ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Seuils d'alerte</CardTitle><CardDescription>Quand déclencher les notifications de dépassement</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            {[
              { key: "warningThresholdPercent" as const, label: "Seuil d'avertissement (%)", desc: "Alerte orange dès que ce pourcentage du budget est consommé", color: "text-orange-600" },
              { key: "criticalThresholdPercent" as const, label: "Seuil critique (%)", desc: "Alerte rouge critique dès que ce pourcentage du budget est consommé", color: "text-red-600" },
            ].map(({ key, label, desc, color }) => (
              <div key={key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div><p className="font-medium text-sm">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <span className={`text-lg font-bold ${color}`}>{cfg[key]}%</span>
                </div>
                <input type="range" min="50" max="100" step="5" value={cfg[key]}
                  onChange={e => setCfg(c => ({...c, [key]: parseInt(e.target.value)}))}
                  disabled={!isAdmin} className="w-full accent-primary" />
                <div className="flex justify-between text-xs text-muted-foreground"><span>50%</span><span>75%</span><span>100%</span></div>
              </div>
            ))}
          </CardContent>
        </Card>

        {isAdmin && <SaveBar onSave={() => mut.mutate({ settings: { budgetPolicies: cfg } } as any)} pending={mut.isPending} />}
      </div>
    </div>
  );
}

// ─── Tolerance ────────────────────────────────────────────────────────────────
function ToleranceSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();
  const [cfg, setCfg] = useState({ priceVariance: 5, quantityVariance: 2, amountVariance: 5, autoApproveBelow: 0 });

  useEffect(() => {
    const t = (org as any)?.settings?.toleranceRules;
    if (t) setCfg(c => ({ ...c, ...t }));
  }, [org]);

  const mut = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Tolérances mises à jour"); utils.settings.getOrganization.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const tolerances = [
    { key: "priceVariance" as const, label: "Tolérance prix", desc: "Écart acceptable entre le prix unitaire du BC et de la facture" },
    { key: "quantityVariance" as const, label: "Tolérance quantité", desc: "Écart acceptable entre la quantité commandée et reçue" },
    { key: "amountVariance" as const, label: "Tolérance montant total", desc: "Écart acceptable entre le total BC et le total facture" },
  ];

  return (
    <div>
      <SectionHeader icon={Sliders} title="Tolérances de rapprochement" desc="Seuils pour le rapprochement à 3 voies (BC ↔ Réception ↔ Facture)" />
      <div className="p-6 max-w-3xl space-y-6">
        <InfoBox>Ces tolérances définissent les écarts acceptables lors du rapprochement 3 voies. Au-delà de ces seuils, une validation manuelle sera requise.</InfoBox>

        <Card>
          <CardHeader><CardTitle>Seuils de tolérance</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {tolerances.map(({ key, label, desc }) => (
              <div key={key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div><p className="font-medium text-sm">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <div className="flex items-center gap-2">
                    <Input type="text" inputMode="decimal" value={cfg[key] === 0 ? "" : String(cfg[key])} onChange={e => { const v = parseFloat(e.target.value.replace(",",".")); setCfg(c => ({...c, [key]: isNaN(v) ? 0 : v})); }} onFocus={e => { if (cfg[key] === 0) setCfg(c => ({...c, [key]: 0})); e.target.select(); }} onBlur={e => { if (e.target.value === "") setCfg(c => ({...c, [key]: 0})); }} placeholder="0" disabled={!isAdmin} className="w-20 text-center" />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(cfg[key], 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Auto-approbation facture</CardTitle><CardDescription>Approuver automatiquement les factures sous ce montant si le rapprochement réussit</CardDescription></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Input type="text" inputMode="decimal" value={cfg.autoApproveBelow === 0 ? "" : String(cfg.autoApproveBelow)} onChange={e => { const v = parseFloat(e.target.value.replace(/\s/g,"").replace(",",".")); setCfg(c => ({...c, autoApproveBelow: isNaN(v) ? 0 : v})); }} onBlur={e => { if (e.target.value === "") setCfg(c => ({...c, autoApproveBelow: 0})); }} placeholder="0 = désactivé" disabled={!isAdmin} className="w-48" />
              <span className="text-sm text-muted-foreground">XOF (0 = désactivé)</span>
            </div>
          </CardContent>
        </Card>

        {isAdmin && <SaveBar onSave={() => mut.mutate({ settings: { toleranceRules: cfg } } as any)} pending={mut.isPending} />}
      </div>
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

function ProfileSection() {
  const { user } = useAuth();
  const { data: profile, refetch } = trpc.settings.getMyProfile.useQuery();
  const { colorPreset, setColorPreset } = useTheme();
  const utils = trpc.useUtils();
  const updateProfileMut = trpc.settings.updateMyProfile.useMutation({
    onSuccess: () => { toast.success("Profil mis à jour !"); utils.auth.me.invalidate(); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Initialize form with current profile data
  useEffect(() => {
    if (profile) {
      setEditName((profile as any).name || "");
      setEditEmail((profile as any).email || "");
    }
  }, [profile]);

  const handleSaveProfile = () => {
    if (!editName.trim()) { toast.error("Le nom est requis"); return; }
    updateProfileMut.mutate({ name: editName.trim() });
  };

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const handlePasswordChange = async () => {
    if (newPwd !== confirmPwd) { toast.error("Les mots de passe ne correspondent pas"); return; }
    if (newPwd.length < 8) { toast.error("Minimum 8 caractères"); return; }
    setPwdLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Mot de passe modifié avec succès");
        setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setPwdLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader icon={Users} title="Mon Profil" desc="Gérez votre photo de profil et vos informations personnelles" />
      <div className="p-6">
        {/* Name & Email */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Informations personnelles</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nom complet</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Votre nom" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={editEmail} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié ici</p>
              </div>
            </div>
            <button onClick={handleSaveProfile} disabled={updateProfileMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 btn-primary">
              {updateProfileMut.isPending ? "Enregistrement..." : "Enregistrer les informations"}
            </button>
          </CardContent>
        </Card>

        {/* Avatar section */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Photo de profil</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <AvatarUpload
                currentUrl={(profile as any)?.avatarUrl}
                name={profile?.name || user?.name}
                size="lg"
                onUploaded={() => refetch()}
              />
              <div>
                <p className="font-semibold text-lg">{profile?.name || user?.name}</p>
                <p className="text-muted-foreground text-sm">{profile?.email || user?.email}</p>
                <Badge className="mt-2" variant="outline">{profile?.role === "admin" ? "Administrateur" : profile?.role === "procurement_manager" ? "Resp. Achats" : profile?.role === "approver" ? "Approbateur" : "Demandeur"}</Badge>
                <p className="text-xs text-muted-foreground mt-3">Survolez la photo et cliquez pour la modifier.<br/>Formats acceptés: JPG, PNG, WebP · max 5 Mo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Color theme */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Couleur de l'interface</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Choisissez votre couleur préférée pour personnaliser l'interface.</p>
            <div className="grid grid-cols-6 gap-3">
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  title={preset.label}
                  onClick={() => setColorPreset(preset.id)}
                  className={`relative h-10 w-10 rounded-full border-4 transition-transform hover:scale-110 ${colorPreset === preset.id ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: `hsl(${preset.primary})` }}
                >
                  {colorPreset === preset.id && (
                    <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Couleur actuelle: <strong>{COLOR_PRESETS.find(p => p.id === colorPreset)?.label || "Bleu"}</strong> — La préférence est sauvegardée automatiquement dans votre navigateur.
            </p>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader><CardTitle className="text-base">Changer le mot de passe</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mot de passe actuel</Label>
              <Input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>Confirmer le nouveau mot de passe</Label>
              <Input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="••••••••" />
            </div>
            <button onClick={handlePasswordChange} disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {pwdLoading ? "Modification..." : "Changer le mot de passe"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NotificationsSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();
  const defaultEvents = { newPurchaseRequest: true, approvalRequired: true, approvalApproved: true, approvalRejected: true, approvalOverdue: true, budgetAlert: true, invoiceReceived: true, invoiceOverdue: true, poIssued: false, contractExpiring: true, lowStock: true, rfqResponse: true };
  const [cfg, setCfg] = useState({ emailEnabled: true, inAppEnabled: true, events: defaultEvents });

  useEffect(() => {
    const n = (org as any)?.settings?.notificationSettings;
    if (n) setCfg(c => ({ ...c, ...n, events: { ...defaultEvents, ...(n.events || {}) } }));
  }, [org]);

  const mut = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Paramètres de notification mis à jour"); utils.settings.getOrganization.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const EVENT_LABELS: Record<keyof typeof defaultEvents, { label: string; category: string }> = {
    newPurchaseRequest:  { label: "Nouvelle demande d'achat créée",           category: "Achats" },
    approvalRequired:    { label: "Approbation requise (votre action)",        category: "Approbations" },
    approvalApproved:    { label: "Demande approuvée",                         category: "Approbations" },
    approvalRejected:    { label: "Demande rejetée",                           category: "Approbations" },
    approvalOverdue:     { label: "Approbation en retard (SLA dépassé)",       category: "Approbations" },
    budgetAlert:         { label: "Budget consommé à plus de 80%",             category: "Budgets" },
    invoiceReceived:     { label: "Nouvelle facture reçue",                    category: "Factures" },
    invoiceOverdue:      { label: "Facture en retard de paiement",             category: "Factures" },
    poIssued:            { label: "Bon de commande émis",                      category: "Commandes" },
    contractExpiring:    { label: "Contrat fournisseur expirant (30 jours)",   category: "Fournisseurs" },
    lowStock:            { label: "Article en rupture de stock imminente",     category: "Inventaire" },
    rfqResponse:         { label: "Nouvelle réponse à un appel d'offres",      category: "RFQ" },
  };

  const categories = [...new Set(Object.values(EVENT_LABELS).map(e => e.category))];

  return (
    <div>
      <SectionHeader icon={Bell} title="Notifications" desc="Configurer les alertes in-app par type d'événement" />
      <div className="p-6 max-w-3xl space-y-6">
        <Card>
          <CardHeader><CardTitle>Canaux de notification</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "inAppEnabled" as const, label: "Notifications in-app", desc: "Cloche en haut à droite de l'interface" },
              { key: "emailEnabled" as const, label: "Notifications par email", desc: "Emails envoyés aux adresses utilisateurs (nécessite configuration SMTP)" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div><p className="font-medium text-sm">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                <button type="button" onClick={() => isAdmin && setCfg(c => ({...c, [key]: !c[key]}))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${!isAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${cfg[key] ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${cfg[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        {categories.map(cat => (
          <Card key={cat}>
            <CardHeader><CardTitle className="text-base">{cat}</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {Object.entries(EVENT_LABELS).filter(([, v]) => v.category === cat).map(([key, { label }]) => (
                <div key={key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <p className="text-sm">{label}</p>
                  <button type="button" onClick={() => isAdmin && setCfg(c => ({...c, events: {...c.events, [key]: !c.events[key as keyof typeof defaultEvents]}}))}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${!isAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${cfg.events[key as keyof typeof defaultEvents] ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${cfg.events[key as keyof typeof defaultEvents] ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {isAdmin && <SaveBar onSave={() => mut.mutate({ settings: { notificationSettings: cfg } } as any)} pending={mut.isPending} />}
      </div>
    </div>
  );
}

// ─── Numbering ────────────────────────────────────────────────────────────────
function NumberingSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();
  const [cfg, setCfg] = useState({ prPrefix: "DA", poPrefix: "BC", invoicePrefix: "FAC", rfqPrefix: "AO" });

  useEffect(() => {
    const n = (org as any)?.settings?.numberingSequences;
    if (n) setCfg(c => ({ ...c, ...n }));
  }, [org]);

  const mut = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Séquences de numérotation mises à jour"); utils.settings.getOrganization.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const fields = [
    { key: "prPrefix" as const, label: "Demandes d'achat", example: `${cfg.prPrefix}-20260001`, desc: "Préfixe des numéros de demandes (ex: DA, PR, REQ)" },
    { key: "poPrefix" as const, label: "Bons de commande", example: `${cfg.poPrefix}-20260001`, desc: "Préfixe des numéros de bons de commande" },
    { key: "invoicePrefix" as const, label: "Factures", example: `${cfg.invoicePrefix}-20260001`, desc: "Préfixe des numéros de factures" },
    { key: "rfqPrefix" as const, label: "Appels d'offres", example: `${cfg.rfqPrefix}-20260001`, desc: "Préfixe des numéros d'appels d'offres" },
  ];

  return (
    <div>
      <SectionHeader icon={Hash} title="Numérotation" desc="Préfixes des séquences de numéros de documents" />
      <div className="p-6 max-w-2xl space-y-6">
        <InfoBox>Les numéros de documents sont générés automatiquement. Modifiez les préfixes pour correspondre à vos conventions internes.</InfoBox>
        <Card>
          <CardContent className="pt-6 space-y-6">
            {fields.map(({ key, label, example, desc }) => (
              <div key={key} className="flex items-start gap-6">
                <div className="flex-1 space-y-1">
                  <Label>{label}</Label>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  <p className="text-xs font-mono bg-muted rounded px-2 py-1 mt-2 inline-block">Exemple: {example}</p>
                </div>
                <Input value={cfg[key]} onChange={e => setCfg(c => ({...c, [key]: e.target.value.toUpperCase()}))} disabled={!isAdmin} className="w-28 font-mono text-center" maxLength={6} />
              </div>
            ))}
          </CardContent>
        </Card>
        {isAdmin && <SaveBar onSave={() => mut.mutate({ settings: { numberingSequences: cfg } } as any)} pending={mut.isPending} />}
      </div>
    </div>
  );
}

// ─── Localization ─────────────────────────────────────────────────────────────
function LocalizationSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();
  const [cfg, setCfg] = useState({ language: "fr", dateFormat: "DD/MM/YYYY", numberFormat: "fr-FR", timezone: "Africa/Porto-Novo" });

  useEffect(() => {
    const l = (org as any)?.settings?.localization;
    if (l) setCfg(c => ({ ...c, ...l }));
  }, [org]);

  const mut = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Localisation mise à jour"); utils.settings.getOrganization.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const TIMEZONES = ["Africa/Porto-Novo", "Africa/Abidjan", "Africa/Dakar", "Africa/Lagos", "Africa/Accra", "Africa/Douala", "Africa/Nairobi", "Europe/Paris", "UTC"];

  return (
    <div>
      <SectionHeader icon={Globe} title="Localisation" desc="Langue, format de dates et fuseau horaire" />
      <div className="p-6 max-w-2xl space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-2"><Label>Langue de l'interface</Label>
              <Select value={cfg.language} onValueChange={v => setCfg(c => ({...c, language: v}))} disabled={!isAdmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Format de date</Label>
              <Select value={cfg.dateFormat} onValueChange={v => setCfg(c => ({...c, dateFormat: v}))} disabled={!isAdmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (17/03/2026)</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (03/17/2026)</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-03-17)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Format des nombres</Label>
              <Select value={cfg.numberFormat} onValueChange={v => setCfg(c => ({...c, numberFormat: v}))} disabled={!isAdmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr-FR">Français — 1 500 000,50 XOF</SelectItem>
                  <SelectItem value="en-US">English — 1,500,000.50 XOF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Fuseau horaire</Label>
              <Select value={cfg.timezone} onValueChange={v => setCfg(c => ({...c, timezone: v}))} disabled={!isAdmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Utilisé pour les notifications et l'affichage des dates</p>
            </div>
          </CardContent>
        </Card>
        {isAdmin && <SaveBar onSave={() => mut.mutate({ settings: { localization: cfg } } as any)} pending={mut.isPending} />}
      </div>
    </div>
  );
}

// ─── Security / Audit ─────────────────────────────────────────────────────────
function SecuritySection() {
  const { data: logs, isLoading } = trpc.settings.getAuditLogs.useQuery({ limit: 50 });
  const [search, setSearch] = useState("");

  const filtered = logs?.filter((l: any) => !search || l.action?.includes(search.toLowerCase()) || l.entityType?.includes(search.toLowerCase()) || l.actorName?.toLowerCase().includes(search.toLowerCase()));

  const ACTION_COLORS: Record<string, string> = { created: "bg-green-100 text-green-800", updated: "bg-blue-100 text-blue-800", deleted: "bg-red-100 text-red-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-orange-100 text-orange-800" };

  return (
    <div>
      <SectionHeader icon={Gear} title="Sécurité & Audit" desc="Journal de toutes les actions réalisées dans le système" />
      <div className="p-6 max-w-5xl">
        <div className="mb-4 max-w-sm">
          <Input placeholder="Filtrer par action, entité, utilisateur…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Card>
          <CardContent className="p-0">
            {isLoading ? <div className="p-8 text-center text-muted-foreground">Chargement...</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entité</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((log: any) => (
                    <TableRow key={log.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{log.actorName || `#${log.actorId}`}</TableCell>
                      <TableCell><span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-800"}`}>{log.action}</span></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.entityType} #{log.entityId ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.createdAt ? new Date(log.createdAt).toLocaleString("fr-FR") : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!filtered?.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun journal trouvé</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Lookups (cost centers, categories, GL accounts, projects) ─────────────
function LookupsSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: types = [], isLoading: typesLoading } = trpc.settings.getLookupTypes.useQuery();
  const utils = trpc.useUtils();
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [newValue, setNewValue] = useState({ code: "", label: "" });
  const [addOpen, setAddOpen] = useState(false);

  const { data: values = [], isLoading: valLoading } = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: selectedTypeId! }, { enabled: !!selectedTypeId }
  );

  const createMut = trpc.settings.createLookupValue.useMutation({
    onSuccess: () => { toast.success("Valeur ajoutée"); utils.settings.getLookupValues.invalidate(); setAddOpen(false); setNewValue({ code: "", label: "" }); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = trpc.settings.updateLookupValue.useMutation({
    onSuccess: () => { toast.success("Valeur mise à jour"); utils.settings.getLookupValues.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const TYPE_LABELS: Record<string, string> = {
    ExpenseCategory: "Catégories de dépenses",
    CostCenter: "Centres de coût",
    GLAccount: "Comptes GL",
    BillingString: "Codes de facturation",
    Project: "Projets",
    category: "Catégories d'achat",
    cost_center: "Centres de coût",
    gl_account: "Comptes GL",
    project: "Projets",
  };

  return (
    <div>
      <SectionHeader icon={Hash} title="Valeurs de référence" desc="Gérer les catégories, centres de coût, comptes GL et projets utilisés dans les demandes d'achat" />
      <div className="p-6 max-w-4xl">
        <InfoBox>Ces valeurs alimentent les listes déroulantes dans les formulaires de demandes d'achat, bons de commande et factures. Chaque modification est immédiatement disponible aux utilisateurs.</InfoBox>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {/* Type selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Types</p>
            {typesLoading ? <div className="text-muted-foreground text-sm">Chargement...</div> :
              types.map((t: any) => (
                <button key={t.id} onClick={() => setSelectedTypeId(t.id)}
                  className={cn("w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-all",
                    selectedTypeId === t.id ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/50")}>
                  <p className="font-medium">{TYPE_LABELS[t.name] || t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description || ""}</p>
                </button>
              ))
            }
          </div>

          {/* Values list */}
          <div className="md:col-span-2">
            {!selectedTypeId ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
                Sélectionnez un type à gauche
              </div>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">{TYPE_LABELS[types.find((t: any) => t.id === selectedTypeId)?.name] || "Valeurs"}</CardTitle>
                  {isAdmin && (
                    <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"><Plus className="h-3.5 w-3.5" />Ajouter</button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {valLoading ? <div className="p-6 text-center text-muted-foreground">Chargement...</div> : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Libellé</TableHead>
                          <TableHead>Statut</TableHead>
                          {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {values.map((v: any) => (
                          <TableRow key={v.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-sm">{v.code}</TableCell>
                            <TableCell className="font-medium">{v.label}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded-full text-xs border ${v.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                {v.isActive ? "Actif" : "Inactif"}
                              </span>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <Button size="sm" variant="ghost"
                                  onClick={() => updateMut.mutate({ id: v.id, isActive: !v.isActive })}>
                                  {v.isActive ? "Désactiver" : "Activer"}
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        {values.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucune valeur définie</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle valeur</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Code *</Label><Input value={newValue.code} onChange={e => setNewValue(v => ({...v, code: e.target.value.toUpperCase()}))} placeholder="CC001" /></div>
                <div className="space-y-2"><Label>Libellé *</Label><Input value={newValue.label} onChange={e => setNewValue(v => ({...v, label: e.target.value}))} placeholder="Direction Générale" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
              <button disabled={!newValue.code || !newValue.label || createMut.isPending} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                onClick={() => createMut.mutate({ lookupTypeId: selectedTypeId!, ...newValue })}>
                {createMut.isPending ? "Ajout..." : "Ajouter"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ─── Approval steps builder ───────────────────────────────────────────────────
// (Extends ApprovalsSection - integrated below as a sub-panel)
// Updated ApprovalsSection with steps management is in the main component above.
// The steps panel opens inline when a policy is selected.

// ─── Payment Terms ────────────────────────────────────────────────────────────
function PaymentTermsSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();
  const defaultTerms = [
    { code: "IMMEDIATE", label: "Paiement immédiat", days: 0 },
    { code: "NET15", label: "Net 15 jours", days: 15 },
    { code: "NET30", label: "Net 30 jours", days: 30 },
    { code: "NET45", label: "Net 45 jours", days: 45 },
    { code: "NET60", label: "Net 60 jours", days: 60 },
  ];
  const [terms, setTerms] = useState(defaultTerms);
  const [addOpen, setAddOpen] = useState(false);
  const [newTerm, setNewTerm] = useState({ code: "", label: "", days: 30, discountPercent: "", discountDays: "" });

  useEffect(() => {
    const t = (org as any)?.settings?.paymentTerms;
    if (t?.length) setTerms(t);
  }, [org]);

  const mut = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Conditions de paiement mises à jour"); utils.settings.getOrganization.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const save = (newTerms: typeof terms) => {
    mut.mutate({ settings: { paymentTerms: newTerms } } as any);
  };

  return (
    <div>
      <SectionHeader icon={DollarSign} title="Conditions de paiement" desc="Termes de paiement disponibles pour les bons de commande et profils fournisseurs" />
      <div className="p-6 max-w-3xl">
        {isAdmin && (
          <div className="flex justify-end mb-4">
            <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"><Plus className="h-4 w-4" />Ajouter</button>
          </div>
        )}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Délai (jours)</TableHead>
                  <TableHead>Escompte</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms.map((t, i) => (
                  <TableRow key={t.code} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">{t.code}</TableCell>
                    <TableCell className="font-medium">{t.label}</TableCell>
                    <TableCell className="text-right">{t.days}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(t as any).discountPercent ? `${(t as any).discountPercent}% si payé dans ${(t as any).discountDays}j` : "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => { const updated = terms.filter((_, idx) => idx !== i); setTerms(updated); save(updated); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle condition de paiement</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Code *</Label><Input value={newTerm.code} onChange={e => setNewTerm(t => ({...t, code: e.target.value.toUpperCase()}))} placeholder="NET30" /></div>
                <div className="space-y-2"><Label>Délai (jours) *</Label><Input type="number" value={newTerm.days} onChange={e => setNewTerm(t => ({...t, days: parseInt(e.target.value) || 0}))} /></div>
              </div>
              <div className="space-y-2"><Label>Libellé *</Label><Input value={newTerm.label} onChange={e => setNewTerm(t => ({...t, label: e.target.value}))} placeholder="Net 30 jours" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Escompte (%)</Label><Input type="number" value={newTerm.discountPercent} onChange={e => setNewTerm(t => ({...t, discountPercent: e.target.value}))} placeholder="2" /></div>
                <div className="space-y-2"><Label>Si payé dans (jours)</Label><Input type="number" value={newTerm.discountDays} onChange={e => setNewTerm(t => ({...t, discountDays: e.target.value}))} placeholder="10" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
              <button disabled={!newTerm.code || !newTerm.label || mut.isPending} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                onClick={() => {
                  const updated = [...terms, { code: newTerm.code, label: newTerm.label, days: newTerm.days, ...(newTerm.discountPercent ? { discountPercent: parseFloat(newTerm.discountPercent), discountDays: parseInt(newTerm.discountDays) || 0 } : {}) }];
                  setTerms(updated); save(updated); setAddOpen(false);
                }}>Ajouter</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ─── Tax Rates ────────────────────────────────────────────────────────────────
function TaxRatesSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();
  const defaultRates = [
    { code: "EXONERE", label: "Exonéré (0%)", rate: 0, isDefault: false },
    { code: "TVA18", label: "TVA 18%", rate: 18, isDefault: true },
    { code: "RSFD", label: "Retenue à la source 5%", rate: 5, isDefault: false },
  ];
  const [rates, setRates] = useState(defaultRates);
  const [addOpen, setAddOpen] = useState(false);
  const [newRate, setNewRate] = useState({ code: "", label: "", rate: 18, isDefault: false });

  useEffect(() => {
    const r = (org as any)?.settings?.taxRates;
    if (r?.length) setRates(r);
  }, [org]);

  const mut = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Taux de taxes mis à jour"); utils.settings.getOrganization.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const save = (newRates: typeof rates) => mut.mutate({ settings: { taxRates: newRates } } as any);

  return (
    <div>
      <SectionHeader icon={DollarSign} title="Taux de taxes" desc="TVA, retenues à la source et autres taxes applicables sur les achats" />
      <div className="p-6 max-w-3xl">
        <InfoBox>Bénin: TVA 18% (standard). Côte d'Ivoire: TVA 18%. Ces taux sont appliqués automatiquement lors de la création de factures selon la configuration du fournisseur.</InfoBox>
        {isAdmin && <div className="flex justify-end mt-4 mb-4"><button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"><Plus className="h-4 w-4" />Ajouter un taux</button></div>}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Libellé</TableHead>
                <TableHead className="text-right">Taux (%)</TableHead><TableHead>Par défaut</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {rates.map((r, i) => (
                  <TableRow key={r.code} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="text-right font-semibold">{r.rate}%</TableCell>
                    <TableCell>{r.isDefault && <Badge className="bg-blue-100 text-blue-800">Défaut</Badge>}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right gap-2 flex justify-end">
                        {!r.isDefault && (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => { const u = rates.map((x, j) => ({...x, isDefault: j === i})); setRates(u); save(u); }}>
                            Définir par défaut
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => { const u = rates.filter((_, j) => j !== i); setRates(u); save(u); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau taux de taxe</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Code *</Label><Input value={newRate.code} onChange={e => setNewRate(r => ({...r, code: e.target.value.toUpperCase()}))} placeholder="TVA18" /></div>
                <div className="space-y-2"><Label>Taux (%) *</Label><Input type="number" value={newRate.rate} onChange={e => setNewRate(r => ({...r, rate: parseFloat(e.target.value) || 0}))} min={0} max={100} step={0.5} /></div>
              </div>
              <div className="space-y-2"><Label>Libellé *</Label><Input value={newRate.label} onChange={e => setNewRate(r => ({...r, label: e.target.value}))} placeholder="TVA 18%" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
              <button disabled={!newRate.code || !newRate.label || mut.isPending} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                onClick={() => { const u = [...rates, {...newRate}]; setRates(u); save(u); setAddOpen(false); }}>Ajouter</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ─── Exchange Rates ───────────────────────────────────────────────────────────
function ExchangeRatesSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();
  const CURRENCIES = ["EUR", "USD", "GBP", "GHS", "NGN", "MAD", "TND", "ZAR", "CNY"];
  const [rates, setRates] = useState<Record<string, string>>({ EUR: "655.957", USD: "605.00" });
  const [fetching, setFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const r = (org as any)?.settings?.exchangeRates;
    if (r) setRates(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])));
    const lu = (org as any)?.settings?.exchangeRatesUpdatedAt;
    if (lu) setLastUpdated(lu);
    const src = (org as any)?.settings?.exchangeRatesSource;
    if (src) setSource(src);
  }, [org]);

  const mut = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Taux de change mis à jour"); utils.settings.getOrganization.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const baseCurrency = org?.baseCurrency ?? "XOF";

  const fetchLiveRates = async () => {
    setFetching(true);
    try {
      // Using exchangerate-api.com free tier (no key needed for basic)
      const res = await fetch(`https://open.er-api.com/v6/latest/EUR`);
      const data = await res.json();
      if (data.result !== "success") throw new Error("API error");
      // XOF is pegged to EUR at 655.957
      const eurToXof = 655.957;
      const newRates: Record<string, string> = {};
      for (const cur of CURRENCIES) {
        if (cur === "EUR") { newRates["EUR"] = "655.957"; continue; }
        const eurToCur = data.rates[cur];
        if (eurToCur) {
          // Convert: 1 CUR = ? XOF => (1/eurToCur) EUR * 655.957
          newRates[cur] = ((1 / eurToCur) * eurToXof).toFixed(3);
        }
      }
      setRates(newRates);
      const now = new Date().toISOString();
      setLastUpdated(now);
      setSource("open.er-api.com");
      // Auto-save
      mut.mutate({ settings: { 
        exchangeRates: Object.fromEntries(Object.entries(newRates).map(([k, v]) => [k, parseFloat(v) || 0])),
        exchangeRatesUpdatedAt: now,
        exchangeRatesSource: "open.er-api.com"
      } } as any);
      toast.success("Taux mis à jour en temps réel !");
    } catch (e: any) {
      toast.error("Impossible de récupérer les taux. Vérifiez votre connexion.");
    } finally {
      setFetching(false);
    }
  };

  const saveManual = () => {
    mut.mutate({ settings: { 
      exchangeRates: Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, parseFloat(v) || 0])),
      exchangeRatesUpdatedAt: lastUpdated,
      exchangeRatesSource: source,
    } } as any);
  };

  return (
    <div>
      <SectionHeader icon={Globe} title="Taux de change" desc={`Taux de change vs devise principale (${baseCurrency})`} />
      <div className="p-6 max-w-2xl">
        {/* Source info */}
        <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
          <div>
            <p className="text-sm font-medium text-blue-800">Taux de change en temps réel</p>
            <p className="text-xs text-blue-600 mt-0.5">
              {lastUpdated
                ? <>Dernière mise à jour: <strong>{new Date(lastUpdated).toLocaleString("fr-FR")}</strong> · Source: <strong>{source || "Manuel"}</strong></>
                : "Cliquez sur \"Actualiser\" pour récupérer les taux actuels"}
            </p>
          </div>
          {isAdmin && (
            <button onClick={fetchLiveRates} disabled={fetching}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 btn-primary shrink-0 ml-4">
              {fetching
                ? <><Loader2 className="h-4 w-4 animate-spin" />Actualisation...</>
                : <><TrendingUp className="h-4 w-4" />Actualiser</>}
            </button>
          )}
        </div>

        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            {CURRENCIES.filter(cur => cur !== baseCurrency).map(currency => (
              <div key={currency} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                <div className="w-12 font-semibold text-sm">{currency}</div>
                <span className="text-sm text-muted-foreground w-24">1 {currency} =</span>
                <Input type="number" value={rates[currency] || ""} onChange={e => setRates(r => ({...r, [currency]: e.target.value}))}
                  disabled={!isAdmin} className="w-32 text-right" step="0.001" min={0} placeholder="0.000" />
                <span className="text-sm font-medium text-muted-foreground">{baseCurrency}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {isAdmin && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Vous pouvez aussi modifier les taux manuellement puis enregistrer.</p>
            <button onClick={saveManual} disabled={mut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {mut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</> : <><Save className="h-4 w-4" />Enregistrer manuellement</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Coding Section ───────────────────────────────────────────────────────────
function CodingSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: lookupTypes = [] } = trpc.settings.getLookupTypes.useQuery();
  const utils = trpc.useUtils();
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newValue, setNewValue] = useState({ code: "", label: "", isActive: true });

  const CODING_SEGMENTS = [
    { name: "gl_account",  label: "Comptes GL", desc: "Plan comptable général", icon: "💰" },
    { name: "cost_center", label: "Centres de coût", desc: "Unités organisationnelles de coût", icon: "🏢" },
    { name: "project",     label: "Projets", desc: "Projets et programmes", icon: "📁" },
    { name: "activity",    label: "Activités", desc: "Nature de dépense", icon: "🏷️" },
  ];

  const codingTypes = (lookupTypes as any[]).filter((t: any) =>
    CODING_SEGMENTS.map(s => s.name).includes(t.name)
  );

  const activeType = codingTypes.find((t: any) => t.id === selectedTypeId);
  const activeSegment = CODING_SEGMENTS.find(s => s.name === activeType?.name);

  const { data: values = [], refetch: refetchValues } = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: selectedTypeId! },
    { enabled: !!selectedTypeId }
  );

  const createMut = trpc.settings.createLookupValue.useMutation({
    onSuccess: () => { toast.success("Valeur ajoutée"); refetchValues(); setAddOpen(false); setNewValue({ code: "", label: "", isActive: true }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = trpc.settings.updateLookupValue.useMutation({
    onSuccess: () => refetchValues(),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <SectionHeader icon={Hash} title="Codification comptable" desc="Définissez les codes utilisés sur les demandes, bons de commande et factures" />
      <div className="p-6 max-w-4xl space-y-4">
        <InfoBox>
          Ces codes permettent aux utilisateurs de rattacher leurs dépenses aux bons comptes GL, centres de coût et projets.
          Finance configure les listes ici, les utilisateurs les sélectionnent sur chaque document.
        </InfoBox>

        {/* Segment tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CODING_SEGMENTS.map(seg => {
            const type = codingTypes.find((t: any) => t.name === seg.name);
            const count = type ? "..." : "0";
            const isActive = type?.id === selectedTypeId;
            return (
              <button key={seg.name} onClick={() => type && setSelectedTypeId(type.id)}
                disabled={!type}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  isActive ? "border-blue-500 bg-blue-50" :
                  type ? "border-gray-200 hover:border-gray-300 hover:bg-gray-50" :
                  "border-gray-100 opacity-50 cursor-not-allowed"
                }`}>
                <div className="text-xl mb-1">{seg.icon}</div>
                <div className="text-sm font-semibold">{seg.label}</div>
                <div className="text-xs text-muted-foreground">{seg.desc}</div>
                {!type && <div className="text-xs text-amber-600 mt-1">Non configuré</div>}
              </button>
            );
          })}
        </div>

        {/* Segment not initialized message */}
        {CODING_SEGMENTS.some(s => !codingTypes.find((t: any) => t.name === s.name)) && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            ⚠️ Certains segments ne sont pas encore initialisés. Exécutez le script SQL d'initialisation dans TiDB.
          </div>
        )}

        {/* Values list */}
        {selectedTypeId && activeSegment && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{activeSegment.icon} {activeSegment.label}</CardTitle>
                  <CardDescription>{activeSegment.desc}</CardDescription>
                </div>
                {isAdmin && (
                  <button onClick={() => setAddOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium btn-primary">
                    <Plus className="h-4 w-4" />Ajouter
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(values as any[]).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Hash className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucune valeur configurée</p>
                  {isAdmin && <button onClick={() => setAddOpen(true)} className="mt-3 text-sm text-blue-600 hover:underline">Ajouter la première valeur →</button>}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Code</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead className="w-24 text-center">Statut</TableHead>
                      {isAdmin && <TableHead className="w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(values as any[]).map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell><code className="text-sm bg-muted px-2 py-0.5 rounded font-mono">{v.code}</code></TableCell>
                        <TableCell className="font-medium">{v.label}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={v.isActive ? "default" : "secondary"} className="text-xs">
                            {v.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Switch checked={v.isActive}
                              onCheckedChange={checked => toggleMut.mutate({ id: v.id, isActive: checked })} />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add value dialog */}
        {addOpen && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une valeur — {activeSegment?.label}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Code *</Label>
                  <Input value={newValue.code} onChange={e => setNewValue(v => ({...v, code: e.target.value.toUpperCase()}))}
                    placeholder="Ex: 601100, CC-TECH, PROJ-001" className="font-mono" />
                  <p className="text-xs text-muted-foreground">Code court utilisé pour la codification</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Libellé *</Label>
                  <Input value={newValue.label} onChange={e => setNewValue(v => ({...v, label: e.target.value}))}
                    placeholder="Ex: Achats de fournitures, Centre IT, Projet Alpha" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
                <button disabled={!newValue.code || !newValue.label || createMut.isPending}
                  onClick={() => createMut.mutate({ lookupTypeId: selectedTypeId!, ...newValue })}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary">
                  {createMut.isPending ? "Ajout..." : "Ajouter"}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// ─── Custom Fields ────────────────────────────────────────────────────────────
function CustomFieldsSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();
  const [fields, setFields] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newField, setNewField] = useState({ label: "", entity: "purchaseRequest", type: "text", required: false, options: "" });
  const [filterEntity, setFilterEntity] = useState("all");

  useEffect(() => {
    const cf = (org as any)?.settings?.customFields;
    if (cf) setFields(cf);
  }, [org]);

  const mut = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => { toast.success("Champs personnalisés mis à jour"); utils.settings.getOrganization.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const save = (newFields: any[]) => mut.mutate({ settings: { customFields: newFields } } as any);

  const ENTITY_LABELS: Record<string, string> = { purchaseRequest: "Demande d'achat", purchaseOrder: "Bon de commande", invoice: "Facture", vendor: "Fournisseur" };
  const TYPE_LABELS: Record<string, string> = { text: "Texte", number: "Nombre", date: "Date", select: "Liste déroulante", boolean: "Case à cocher" };

  const displayed = filterEntity === "all" ? fields : fields.filter(f => f.entity === filterEntity);

  return (
    <div>
      <SectionHeader icon={Package} title="Champs personnalisés" desc="Ajouter des champs métier sur les demandes, commandes, factures et fournisseurs" />
      <div className="p-6 max-w-4xl">
        <InfoBox>Les champs personnalisés apparaissent dans les formulaires et rapports. Les champs obligatoires doivent être remplis avant soumission.</InfoBox>

        <div className="flex items-center justify-between mt-6 mb-4">
          <div className="flex gap-2">
            {["all", "purchaseRequest", "purchaseOrder", "invoice", "vendor"].map(e => (
              <button key={e} onClick={() => setFilterEntity(e)}
                className={cn("px-3 py-1.5 rounded-lg text-sm border transition-all",
                  filterEntity === e ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50")}>
                {e === "all" ? "Tous" : ENTITY_LABELS[e]}
              </button>
            ))}
          </div>
          {isAdmin && <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"><Plus className="h-4 w-4" />Nouveau champ</button>}
        </div>

        <Card>
          <CardContent className="p-0">
            {displayed.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <Package className="mx-auto h-10 w-10 mb-3 opacity-30" />
                <p>Aucun champ personnalisé</p>
                {isAdmin && <Button className="mt-4" variant="outline" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Créer le premier champ</Button>}
              </div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Libellé</TableHead><TableHead>Entité</TableHead><TableHead>Type</TableHead>
                  <TableHead>Obligatoire</TableHead><TableHead>Statut</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {displayed.map((f: any) => (
                    <TableRow key={f.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{f.label}</TableCell>
                      <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded">{ENTITY_LABELS[f.entity] || f.entity}</span></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{TYPE_LABELS[f.type] || f.type}{f.type === "select" && f.options?.length ? ` (${f.options.length} options)` : ""}</TableCell>
                      <TableCell>{f.required ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${f.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {f.isActive ? "Actif" : "Inactif"}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => { const u = fields.map(x => x.id === f.id ? {...x, isActive: !x.isActive} : x); setFields(u); save(u); }}>
                            {f.isActive ? "Désactiver" : "Activer"}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0"
                            onClick={() => { const u = fields.filter(x => x.id !== f.id); setFields(u); save(u); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nouveau champ personnalisé</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Libellé *</Label><Input value={newField.label} onChange={e => setNewField(f => ({...f, label: e.target.value}))} placeholder="Ex: Numéro de projet interne" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Entité</Label>
                  <Select value={newField.entity} onValueChange={v => setNewField(f => ({...f, entity: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(ENTITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Type</Label>
                  <Select value={newField.type} onValueChange={v => setNewField(f => ({...f, type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {newField.type === "select" && (
                <div className="space-y-2"><Label>Options (une par ligne)</Label><textarea value={newField.options} onChange={e => setNewField(f => ({...f, options: e.target.value}))} className="w-full border rounded-md p-2 text-sm h-24 resize-none" placeholder="Option 1&#10;Option 2&#10;Option 3" /></div>
              )}
              <div className="flex items-center justify-between">
                <Label>Champ obligatoire</Label>
                <button type="button" onClick={() => setNewField(f => ({...f, required: !f.required}))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${newField.required ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${newField.required ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
              <button disabled={!newField.label || mut.isPending} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                onClick={() => {
                  const id = `cf_${Date.now()}`;
                  const options = newField.type === "select" ? newField.options.split('\n').map(s => s.trim()).filter(Boolean) : undefined;
                  const u = [...fields, { id, label: newField.label, entity: newField.entity, type: newField.type, required: newField.required, options, isActive: true }];
                  setFields(u); save(u); setAddOpen(false);
                  setNewField({ label: "", entity: "purchaseRequest", type: "text", required: false, options: "" });
                }}>Créer</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
