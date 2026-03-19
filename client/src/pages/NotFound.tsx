import { Button } from "@/components/ui/button";
import { FileSearch, Home, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center px-6 max-w-md">
        <div className="text-8xl font-bold text-muted-foreground/20 leading-none mb-4">404</div>
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-muted rounded-2xl">
            <FileSearch className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold mb-2">Page introuvable</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <Button onClick={() => setLocation("/")}>
            <Home className="mr-2 h-4 w-4" />
            Tableau de bord
          </Button>
        </div>
      </div>
    </div>
  );
}
