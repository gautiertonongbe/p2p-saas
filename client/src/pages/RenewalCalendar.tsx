import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertTriangle, CheckCircle, Clock, ChevronLeft, ChevronRight, Bell, FileText, Building, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday-first
}

function urgencyColor(daysLeft: number, expired: boolean) {
  if (expired) return { dot: "bg-red-500", badge: "bg-red-100 text-red-700 border-red-200", bar: "bg-red-500" };
  if (daysLeft <= 30) return { dot: "bg-red-500", badge: "bg-red-100 text-red-700 border-red-200", bar: "bg-red-500" };
  if (daysLeft <= 60) return { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200", bar: "bg-amber-500" };
  return { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" };
}

export default function RenewalCalendar() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [sentReminders, setSentReminders] = useState<Set<number>>(new Set());

  const { data: contracts = [] } = trpc.contracts.list.useQuery();

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  // Build contract events with days until expiry
  const events = (contracts as any[])
    .filter((c: any) => c.status !== "terminated")
    .map((c: any) => {
      const end = new Date(c.endDate);
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
      const expired = daysLeft < 0;
      return { ...c, endDate: end, daysLeft, expired, colors: urgencyColor(daysLeft, expired) };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Expiring in next 90 days
  const upcoming = events.filter(e => !e.expired && e.daysLeft <= 90);
  const expired = events.filter(e => e.expired);

  // Calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const eventsForDay = (day: number) => events.filter(e => {
    const d = e.endDate;
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day;
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  const sendReminder = (contractId: number, contractTitle: string) => {
    setSentReminders(prev => new Set([...prev, contractId]));
    toast.success(`Rappel envoyé pour "${contractTitle}"`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="h-6 w-6 text-blue-600" />Calendrier des renouvellements</h1>
          <p className="text-sm text-muted-foreground">Suivez les expirations de contrats et planifiez les renégociations</p>
        </div>
        <button onClick={() => setLocation("/contracts/new")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold btn-primary text-white">
          <FileText className="h-4 w-4" />Nouveau contrat
        </button>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-3 pb-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4.5 w-4.5 text-red-600" style={{width:18,height:18}} />
            </div>
            <div>
              <p className="text-xl font-bold text-red-700">{expired.length + events.filter(e=>!e.expired&&e.daysLeft<=30).length}</p>
              <p className="text-xs text-red-600">Expirés ou &lt; 30j</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-3 pb-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="h-4.5 w-4.5 text-amber-600" style={{width:18,height:18}} />
            </div>
            <div>
              <p className="text-xl font-bold text-amber-700">{events.filter(e=>!e.expired&&e.daysLeft>30&&e.daysLeft<=90).length}</p>
              <p className="text-xs text-amber-600">Expirent dans 31-90j</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-3 pb-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-600" style={{width:18,height:18}} />
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-700">{events.filter(e=>!e.expired&&e.daysLeft>90).length}</p>
              <p className="text-xs text-emerald-600">OK (&gt; 90j)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 items-start max-h-[600px]">
        {/* Calendar */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-1 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-blue-700 flex items-center gap-2">
                <Calendar className="h-4 w-4" />{MONTHS_FR[viewMonth]} {viewYear}
              </CardTitle>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelectedDay(null); }}
                  className="px-2 py-1 text-xs rounded-lg hover:bg-muted transition-colors">Auj.</button>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-0 mb-0.5">
              {DAYS_FR.map(d => <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-0.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5 px-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dayEvents = eventsForDay(day);
                const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
                const isSelected = selectedDay === day && dayEvents.length > 0;
                return (
                  <button key={day}
                    onClick={() => dayEvents.length > 0 ? setSelectedDay(isSelected ? null : day) : undefined}
                    className={`relative h-10 flex flex-col items-center justify-start pt-1.5 rounded-lg text-xs transition-colors
                      ${isToday ? "bg-blue-600 text-white font-bold" : ""}
                      ${isSelected ? "ring-2 ring-blue-400" : ""}
                      ${dayEvents.length > 0 && !isToday ? "hover:bg-muted cursor-pointer" : ""}
                    `}>
                    <span className={isToday ? "text-white" : "text-foreground"}>{day}</span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                        {dayEvents.slice(0, 3).map((e, i) => (
                          <span key={i} className={`h-1.5 w-1.5 rounded-full ${e.colors.dot}`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Selected day detail */}
            {selectedDay && eventsForDay(selectedDay).length > 0 && (
              <div className="mt-3 pt-3 border-t space-y-2">
                {eventsForDay(selectedDay).map((e: any) => (
                  <div key={e.id} className={`p-3 rounded-lg border ${e.colors.badge}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{e.title}</p>
                        <p className="text-xs mt-0.5 flex items-center gap-1">
                          <Building className="h-3 w-3" />{e.vendorName}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${e.colors.badge}`}>
                        {e.expired ? "Expiré" : `J-${e.daysLeft}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming renewals list */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />Actions requises
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            {expired.length === 0 && upcoming.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucun contrat expirant sous 90 jours</p>
              </div>
            ) : (
              <>
                {[...expired, ...upcoming].map((contract: any) => (
                  <div key={contract.id} className={`p-3 rounded-xl border ${contract.colors.badge}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{contract.title}</p>
                        <p className="text-xs mt-0.5 flex items-center gap-1 opacity-80">
                          <Building className="h-3 w-3" />{contract.vendorName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold">{contract.expired ? "Expiré" : `J-${contract.daysLeft}`}</p>
                        {contract.value && <p className="text-xs opacity-70">{fmt(contract.value)} XOF</p>}
                      </div>
                    </div>
                    {/* Urgency bar */}
                    <div className="h-1 bg-white/50 rounded-full mb-2">
                      <div className={`h-full rounded-full ${contract.colors.bar} transition-all`}
                        style={{ width: contract.expired ? "100%" : `${Math.max(0, Math.min(100, ((90 - contract.daysLeft) / 90) * 100))}%` }} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setLocation(`/contracts/${contract.id}`)}
                        className="flex-1 text-xs py-1.5 rounded-md border bg-white/60 hover:bg-white transition-colors font-medium">
                        Voir le contrat
                      </button>
                      <button
                        onClick={() => sendReminder(contract.id, contract.title)}
                        disabled={sentReminders.has(contract.id)}
                        className={`flex items-center gap-1 text-xs py-1.5 px-2 rounded-md border font-medium transition-colors ${sentReminders.has(contract.id) ? "bg-white/40 opacity-50 cursor-default" : "bg-white/60 hover:bg-white"}`}>
                        {sentReminders.has(contract.id) ? <><CheckCircle className="h-3 w-3" />Envoyé</> : <><Bell className="h-3 w-3" />Rappel</>}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
