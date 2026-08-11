import { Component } from "react";
import { APP_BUILD_VERSION } from "../../appBuild.js";
import { buildDiagnosticReport, normalizeDiagnosticError, recordDiagnostic } from "../../diagnostics/diagnostics.js";

export default class GameErrorBoundary extends Component {
  state = { error: null, copied: false };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) {
    recordDiagnostic("react-fatal-error", { ...normalizeDiagnosticError(error), componentStack: info?.componentStack });
  }

  copyReport = async () => {
    try {
      await navigator.clipboard.writeText(buildDiagnosticReport());
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="rd fatal-error" role="alert">
      <section className="fatal-error__card">
        <p className="fatal-error__eyebrow">Reinos do Dragão · v{APP_BUILD_VERSION}</p>
        <h1>O jogo encontrou um erro inesperado</h1>
        <p>O progresso guardado permanece no navegador. Recarrega a página para tentar recuperar a sessão.</p>
        <div className="fatal-error__actions">
          <button onClick={() => location.reload()}>Recarregar jogo</button>
          <button onClick={this.copyReport}>{this.state.copied ? "Relatório copiado" : "Copiar relatório técnico"}</button>
        </div>
      </section>
    </main>;
  }
}
