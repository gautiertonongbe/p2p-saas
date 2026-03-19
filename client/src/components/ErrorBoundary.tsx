import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; errorInfo: string | null; }

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    this.setState({ errorInfo: info?.componentStack ?? null });
    // In production you'd send this to a logging service
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env?.DEV;
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-lg text-center">
            <div className="p-4 bg-red-100 rounded-2xl mb-6">
              <AlertTriangle className="h-12 w-12 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Une erreur inattendue s'est produite</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              L'application a rencontré un problème. Rechargez la page ou retournez à l'accueil.
            </p>

            {isDev && this.state.error && (
              <div className="w-full mb-6 p-4 rounded-lg bg-muted text-left overflow-auto max-h-48">
                <p className="text-xs font-mono text-destructive font-semibold mb-1">{this.state.error.message}</p>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {this.state.error.stack?.split('\n').slice(1, 6).join('\n')}
                </pre>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
              >
                <Home size={15} />
                Accueil
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm"
              >
                <RotateCcw size={15} />
                Recharger
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
