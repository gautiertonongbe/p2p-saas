import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Save, Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

interface BankAccount { bankName: string; accountNumber: string; iban?: string }
interface MobileMoneyAccount { provider: string; number: string }

export default function VendorForm() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [country, setCountry] = useState("BJ");
  const [taxId, setTaxId] = useState("");
  const [isFormal, setIsFormal] = useState(true);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [mobileMoneyAccounts, setMobileMoneyAccounts] = useState<MobileMoneyAccount[]>([]);

  const createMutation = trpc.vendors.create.useMutation({
    onSuccess: (data) => {
      toast.success("Fournisseur créé avec succès");
      utils.vendors.list.invalidate();
      setLocation(`/vendors/${data.id}`);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handleSubmit = async () => {
    if (!legalName.trim()) {
      toast.error("Le nom légal est requis");
      return;
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      toast.error("Adresse email invalide");
      return;
    }
    await createMutation.mutateAsync({
      legalName: legalName.trim(),
      tradeName: tradeName.trim() || undefined,
      country: country || undefined,
      taxId: taxId.trim() || undefined,
      isFormal,
      contactName: contactName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      bankAccounts: bankAccounts.filter(b => b.bankName && b.accountNumber),
      mobileMoneyAccounts: mobileMoneyAccounts.filter(m => m.provider && m.number),
    });
  };

  const addBankAccount = () => setBankAccounts(prev => [...prev, { bankName: "", accountNumber: "", iban: "" }]);
  const removeBankAccount = (i: number) => setBankAccounts(prev => prev.filter((_, idx) => idx !== i));
  const updateBankAccount = (i: number, field: keyof BankAccount, value: string) =>
    setBankAccounts(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b));

  const addMobileMoney = () => setMobileMoneyAccounts(prev => [...prev, { provider: "", number: "" }]);
  const removeMobileMoney = (i: number) => setMobileMoneyAccounts(prev => prev.filter((_, idx) => idx !== i));
  const updateMobileMoney = (i: number, field: keyof MobileMoneyAccount, value: string) =>
    setMobileMoneyAccounts(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/vendors")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("vendors.new")}</h1>
          <p className="text-muted-foreground mt-1">Ajouter un nouveau fournisseur au registre</p>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informations légales</CardTitle>
          <CardDescription>Identité légale et commerciale du fournisseur</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="legalName">{t("vendors.legalName")} *</Label>
            <Input id="legalName" value={legalName} onChange={e => setLegalName(e.target.value)}
              placeholder="Nom légal de l'entreprise" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tradeName">{t("vendors.tradeName")}</Label>
            <Input id="tradeName" value={tradeName} onChange={e => setTradeName(e.target.value)}
              placeholder="Nom commercial (si différent du nom légal)" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">{t("vendors.country")}</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="country"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BJ">🇧🇯 Bénin</SelectItem>
                  <SelectItem value="CI">🇨🇮 Côte d'Ivoire</SelectItem>
                  <SelectItem value="TG">🇹🇬 Togo</SelectItem>
                  <SelectItem value="GH">🇬🇭 Ghana</SelectItem>
                  <SelectItem value="NG">🇳🇬 Nigéria</SelectItem>
                  <SelectItem value="SN">🇸🇳 Sénégal</SelectItem>
                  <SelectItem value="ML">🇲🇱 Mali</SelectItem>
                  <SelectItem value="BF">🇧🇫 Burkina Faso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">{t("vendors.taxId")}</Label>
              <Input id="taxId" value={taxId} onChange={e => setTaxId(e.target.value)}
                placeholder="IFU / Numéro fiscal" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Type de fournisseur</Label>
            <Select value={isFormal ? "formal" : "informal"} onValueChange={v => setIsFormal(v === "formal")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formel (entreprise enregistrée)</SelectItem>
                <SelectItem value="informal">Semi-formel / Informel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Contact principal</CardTitle>
          <CardDescription>Interlocuteur de référence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contactName">{t("vendors.contactPerson")}</Label>
            <Input id="contactName" value={contactName} onChange={e => setContactName(e.target.value)}
              placeholder="Prénom et nom du contact" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">{t("vendors.email")}</Label>
              <Input id="contactEmail" type="email" value={contactEmail}
                onChange={e => setContactEmail(e.target.value)} placeholder="email@entreprise.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">{t("vendors.phone")}</Label>
              <Input id="contactPhone" type="tel" value={contactPhone}
                onChange={e => setContactPhone(e.target.value)} placeholder="+229 XX XX XX XX" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Comptes bancaires</CardTitle>
            <CardDescription>Coordonnées bancaires pour les paiements</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addBankAccount}>
            <Plus className="mr-2 h-4 w-4" />Ajouter
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {bankAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun compte bancaire. Cliquez sur «Ajouter» pour en ajouter un.
            </p>
          ) : (
            bankAccounts.map((account, i) => (
              <div key={i} className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Compte {i + 1}</span>
                  <Button type="button" size="sm" variant="ghost"
                    className="text-destructive h-7 w-7 p-0"
                    onClick={() => removeBankAccount(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Banque *</Label>
                    <Input value={account.bankName} onChange={e => updateBankAccount(i, "bankName", e.target.value)}
                      placeholder="Nom de la banque" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Numéro de compte *</Label>
                    <Input value={account.accountNumber} onChange={e => updateBankAccount(i, "accountNumber", e.target.value)}
                      placeholder="Numéro de compte" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">IBAN (optionnel)</Label>
                    <Input value={account.iban || ""} onChange={e => updateBankAccount(i, "iban", e.target.value)}
                      placeholder="IBAN" />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Mobile Money */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mobile Money</CardTitle>
            <CardDescription>Comptes de paiement mobile (MTN, Moov, Orange Money, etc.)</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addMobileMoney}>
            <Plus className="mr-2 h-4 w-4" />Ajouter
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {mobileMoneyAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun compte mobile money.
            </p>
          ) : (
            mobileMoneyAccounts.map((account, i) => (
              <div key={i} className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Compte Mobile Money {i + 1}</span>
                  <Button type="button" size="sm" variant="ghost"
                    className="text-destructive h-7 w-7 p-0"
                    onClick={() => removeMobileMoney(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Opérateur *</Label>
                    <Select value={account.provider} onValueChange={v => updateMobileMoney(i, "provider", v)}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MTN Mobile Money">MTN Mobile Money</SelectItem>
                        <SelectItem value="Moov Money">Moov Money</SelectItem>
                        <SelectItem value="Orange Money">Orange Money</SelectItem>
                        <SelectItem value="Wave">Wave</SelectItem>
                        <SelectItem value="Airtel Money">Airtel Money</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Numéro *</Label>
                    <Input value={account.number} onChange={e => updateMobileMoney(i, "number", e.target.value)}
                      placeholder="+229 XX XX XX XX" />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => setLocation("/vendors")} className="w-full sm:w-auto">
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending} className="w-full sm:w-auto">
          <Save className="mr-2 h-4 w-4" />
          {createMutation.isPending ? "Enregistrement..." : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
