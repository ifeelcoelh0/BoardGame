import GameIcon from "../../assets/GameIcon.jsx";
import { bookFolio, bookPageMeta } from "../bookPages.js";

/*
   Folha do livro.

   As nove páginas repetiam o mesmo `<header><small>…</small><h2>…</h2></header>`
   à mão, cada uma com o seu texto de capítulo escrito no sítio. Isso significa
   que qualquer decisão tipográfica tinha de ser repetida dezoito vezes (duas
   folhas por página) e que a numeração do livro podia divergir da paginação.

   Agora a moldura é uma só: ícone, capítulo, título, filete ornamental e número
   de fólio. O capítulo e o fólio vêm do registo, portanto acompanham a ordem do
   livro automaticamente. As páginas só fornecem conteúdo.
*/

export default function Leaf({ page, side, title, chapter = null, icon = null, children, folio = true }) {
  const meta = bookPageMeta(page);
  const resolvedChapter = chapter ?? meta?.chapter ?? "";
  const resolvedIcon = icon ?? meta?.icon ?? null;
  // O ícone marca a página, portanto aparece só na folha da esquerda: repetido
  // nas duas leria como decoração e não como identificação.
  const showIcon = side === "left" && resolvedIcon;

  return (
    <article className={`rd-lobby-book-ui__page is-${side}`}>
      <header className="rd-leaf__head">
        {showIcon && (
          <span className="rd-leaf__mark" aria-hidden="true">
            <GameIcon name={resolvedIcon} size={40} />
          </span>
        )}
        <small>{resolvedChapter}</small>
        <h2>{title}</h2>
        <span className="rd-leaf__rule" aria-hidden="true">
          <i />
          <b>❧</b>
          <i />
        </span>
      </header>

      <div className="rd-leaf__body">{children}</div>

      {folio && (
        <span className="rd-leaf__folio" aria-hidden="true">
          {bookFolio(page)}
          {side === "right" ? "·b" : "·a"}
        </span>
      )}
    </article>
  );
}

/** Primeiro parágrafo com capitular, para abrir um capítulo. */
export function Opening({ children }) {
  return <p className="rd-leaf__opening">{children}</p>;
}
