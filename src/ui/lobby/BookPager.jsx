import { BOOK_SCOPE, bookPageMeta } from "./bookPages.js";
import { getBookNavigation } from "./bookState.js";

/*
   Folheador.

   Tinha um mapa de rótulos próprio e uma lista de páginas de reino escrita à mão
   para derivar o contexto: duas fontes de verdade que iam divergir na primeira
   página nova, e a página de diagnóstico era exactamente esse caso. Agora tudo
   vem do registo.
*/

export default function BookPager({ page, scope = BOOK_SCOPE.FOYER, onPageChange, compact = false, disabled = false }) {
  const navigation = getBookNavigation(page, scope);
  const meta = bookPageMeta(page);
  if (navigation.index < 0 || !meta) return null;

  return (
    <nav className={`rd-book-pager${compact ? " is-compact" : ""}`} aria-label="Folhear livro">
      <button
        type="button"
        className="rd-book-pager__turn is-previous"
        disabled={disabled || !navigation.previous}
        onClick={() => navigation.previous && onPageChange?.(navigation.previous)}
        aria-label="Folhear para trás"
      >
        ← {navigation.previous ? bookPageMeta(navigation.previous).label : "Início do livro"}
      </button>

      <div className="rd-book-pager__index" aria-label={`Página ${navigation.index + 1} de ${navigation.total}`}>
        <small>{scope === BOOK_SCOPE.REALM ? "LIVRO DO REINO" : "LIVRO DOS REINOS"}</small>
        <strong>{meta.label}</strong>
        <span>{navigation.index + 1} / {navigation.total}</span>
      </div>

      <button
        type="button"
        className="rd-book-pager__turn is-next"
        disabled={disabled || !navigation.next}
        onClick={() => navigation.next && onPageChange?.(navigation.next)}
        aria-label="Folhear para a frente"
      >
        {navigation.next ? bookPageMeta(navigation.next).label : "Fim do livro"} →
      </button>
    </nav>
  );
}
