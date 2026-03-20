import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, PenLine, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export default function SignaturePage() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") || "";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signed, setSigned] = useState(false);
  const [mode, setMode] = useState<"draw"|"type">("draw");
  const [typedName, setTypedName] = useState("");

  const { data: sigData, isLoading, error } = trpc.esignature.getSignaturePage.useQuery({ token }, { enabled: !!token });
  const submitMutation = trpc.esignature.submitSignature.useMutation({
    onSuccess: () => setSigned(true),
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
  }, []);

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getSignatureData = () => {
    if (mode === "type") {
      const canvas = document.createElement("canvas");
      canvas.width = 400; canvas.height = 120;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 400, 120);
      ctx.font = "italic 48px Georgia, serif";
      ctx.fillStyle = "#1e40af";
      ctx.fillText(typedName, 20, 80);
      return canvas.toDataURL("image/png");
    }
    return canvasRef.current!.toDataURL("image/png");
  };

  const handleSign = () => {
    if (mode === "draw" && !hasSignature) { toast.error("Veuillez signer dans le cadre ci-dessus"); return; }
    if (mode === "type" && !typedName.trim()) { toast.error("Veuillez saisir votre nom"); return; }
    const signatureData = getSignatureData();
    submitMutation.mutate({ token, signatureData, signatoryName: sigData?.signatoryName || "" });
  };

  if (!token) return <div className="min-h-screen flex items-center justify-center"><p className="text-red-600">Lien de signature invalide.</p></div>;
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center"><p className="text-red-600">Lien invalide ou expiré.</p></div>;

  if (signed || sigData?.alreadySigned) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-xl">
          <CardContent className="pt-8 pb-8">
            <div className="flex justify-center mb-4"><CheckCircle className="h-16 w-16 text-emerald-500" /></div>
            <h2 className="text-2xl font-bold text-emerald-700 mb-2">Document signé !</h2>
            <p className="text-muted-foreground">Votre signature a été enregistrée avec succès. Vous pouvez fermer cette fenêtre.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center py-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <PenLine className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-semibold text-blue-700">Signature électronique</span>
          </div>
          <p className="text-xs text-muted-foreground">Document légalement contraignant</p>
        </div>

        {/* Contract info */}
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Détails du contrat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Référence</p><p className="font-medium">{sigData?.contractNumber}</p></div>
              <div><p className="text-muted-foreground">Intitulé</p><p className="font-medium">{sigData?.title}</p></div>
              <div><p className="text-muted-foreground">Signataire</p><p className="font-medium">{sigData?.signatoryName}</p></div>
              <div><p className="text-muted-foreground">Rôle</p><p className="font-medium">{sigData?.signatoryRole || "—"}</p></div>
            </div>
            {sigData?.description && <p className="text-muted-foreground text-xs border-t pt-2">{sigData.description}</p>}
          </CardContent>
        </Card>

        {/* Signature area */}
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Votre signature</CardTitle>
              <div className="flex gap-2">
                <button onClick={() => setMode("draw")} className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${mode === "draw" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>Dessiner</button>
                <button onClick={() => setMode("type")} className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${mode === "type" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>Taper</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {mode === "draw" ? (
              <div className="space-y-2">
                <div className="border-2 border-dashed border-blue-200 rounded-xl bg-white relative">
                  <canvas
                    ref={canvasRef}
                    width={560}
                    height={150}
                    className="w-full touch-none cursor-crosshair"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                  />
                  {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-muted-foreground/50 text-sm">Signez ici...</p>
                    </div>
                  )}
                </div>
                <button onClick={clearCanvas} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="h-3 w-3" />Effacer
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={typedName}
                  onChange={e => setTypedName(e.target.value)}
                  placeholder="Votre nom complet"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
                {typedName && (
                  <div className="border rounded-xl bg-white p-4 flex items-center justify-center h-24">
                    <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "2rem", color: "#1e40af" }}>{typedName}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              En signant ce document, vous acceptez son contenu et confirmez avoir l'autorité pour le signer. Cette signature électronique a la même valeur légale qu'une signature manuscrite.
            </div>

            <button
              onClick={handleSign}
              disabled={submitMutation.isPending}
              className="w-full mt-4 py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: "#2563eb" }}
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
              {submitMutation.isPending ? "Enregistrement..." : "Signer le document"}
            </button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Powered by votre plateforme P2P · Signature sécurisée et horodatée
        </p>
      </div>
    </div>
  );
}
