import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Hash } from "lucide-react";

export type CodingValues = {
  glAccountId?: string;
  costCenterId?: string;
  projectId?: string;
  departmentId?: string;
  activityId?: string;
};

interface Props {
  value: CodingValues;
  onChange: (val: CodingValues) => void;
  disabled?: boolean;
  compact?: boolean; // inline compact mode vs full card
}

const SEGMENT_KEYS = [
  { key: "gl_account",  field: "glAccountId",   label: "Compte GL",       required: false },
  { key: "cost_center", field: "costCenterId",   label: "Centre de coût",  required: false },
  { key: "project",     field: "projectId",      label: "Projet",          required: false },
  { key: "activity",    field: "activityId",     label: "Activité",        required: false },
] as const;

export function CodingWidget({ value, onChange, disabled = false, compact = false }: Props) {
  const { data: lookupTypes = [] } = trpc.settings.getLookupTypes.useQuery();

  // Get lookup type IDs for each segment
  const getTypeId = (name: string) =>
    (lookupTypes as any[]).find((t: any) => t.name === name)?.id;

  const glTypeId = getTypeId("gl_account");
  const ccTypeId = getTypeId("cost_center");
  const projTypeId = getTypeId("project");
  const actTypeId = getTypeId("activity");

  const { data: glAccounts = [] } = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: glTypeId! }, { enabled: !!glTypeId }
  );
  const { data: costCenters = [] } = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: ccTypeId! }, { enabled: !!ccTypeId }
  );
  const { data: projects = [] } = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: projTypeId! }, { enabled: !!projTypeId }
  );
  const { data: activities = [] } = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: actTypeId! }, { enabled: !!actTypeId }
  );

  const segments = [
    { field: "glAccountId" as const, label: "Compte GL", values: glAccounts, hasType: !!glTypeId },
    { field: "costCenterId" as const, label: "Centre de coût", values: costCenters, hasType: !!ccTypeId },
    { field: "projectId" as const, label: "Projet", values: projects, hasType: !!projTypeId },
    { field: "activityId" as const, label: "Activité", values: activities, hasType: !!actTypeId },
  ].filter(s => s.hasType && (s.values as any[]).length > 0);

  if (segments.length === 0) return null;

  const activeCodings = segments.filter(s => value[s.field]);

  if (compact && activeCodings.length > 0 && disabled) {
    return (
      <div className="flex flex-wrap gap-1">
        {activeCodings.map(s => {
          const val = (s.values as any[]).find((v: any) => String(v.id) === String(value[s.field]));
          if (!val) return null;
          return (
            <Badge key={s.field} variant="outline" className="text-xs font-mono gap-1">
              <Hash className="h-2.5 w-2.5" />
              {val.code} — {val.label}
            </Badge>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Codification comptable</span>
        <span className="text-xs text-muted-foreground">(optionnel)</span>
      </div>
      <div className={`grid gap-3 ${segments.length > 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {segments.map(seg => (
          <div key={seg.field} className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">{seg.label}</label>
            <Select
              value={value[seg.field] || "none"}
              onValueChange={v => onChange({ ...value, [seg.field]: v === "none" ? "" : v })}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={`— ${seg.label} —`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Non spécifié —</SelectItem>
                {(seg.values as any[]).filter((v: any) => v.isActive).map((v: any) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    <span className="font-mono text-xs text-muted-foreground mr-2">{v.code}</span>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CodingWidget;
