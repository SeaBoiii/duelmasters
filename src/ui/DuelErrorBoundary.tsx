import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";

interface DuelErrorBoundaryProps {
  children: ReactNode;
  onResetDuel: () => void;
}

interface DuelErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

export class DuelErrorBoundary extends Component<DuelErrorBoundaryProps, DuelErrorBoundaryState> {
  public constructor(props: DuelErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      message: null
    };
  }

  public static getDerivedStateFromError(error: unknown): DuelErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown duel runtime error."
    };
  }

  public override componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    console.error("Duel runtime error:", error, errorInfo);
  }

  public override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <section className="panel">
        <h2>Duel Runtime Error</h2>
        <p>The duel UI hit an unexpected error and stopped rendering.</p>
        <p className="error-banner">{this.state.message ?? "Unknown error."}</p>
        <div className="row wrap gap">
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, message: null });
              this.props.onResetDuel();
            }}
          >
            Reset Duel
          </button>
          <Link to="/deck-builder" className="inline-link-button">
            Back to Deck Builder
          </Link>
        </div>
      </section>
    );
  }
}
