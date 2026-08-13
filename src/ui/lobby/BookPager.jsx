import {
  BOOK_SCOPE,
  bookPageMeta,
  bookSectionMeta,
  bookSectionsForScope,
  firstBookPageForSection,
} from "./bookPages.js";
import { t } from "../../locales/i18n.js";

/*
   Navegação semântica do Book v2.

   As folhas continuam a ter uma ordem física (e as setas do teclado continuam a
   folheá-la), mas o rodapé já não apresenta "anterior / seguinte" como se todas
   as páginas formassem um wizard. O jogador navega por áreas do livro.
*/
export default function BookPager({ page, scope = BOOK_SCOPE.FOYER, onPageChange, compact = false, disabled = false }) {
  const meta = bookPageMeta(page);
  if (!meta) return null;
  const sections = bookSectionsForScope(scope);

  return (
    <nav className={`rd-book-pager${compact ? " is-compact" : ""}`} aria-label={t("book.sections")}>
      <div className="rd-book-pager__sections">
        {sections.map((section) => {
          const sectionMeta = bookSectionMeta(section);
          const target = firstBookPageForSection(section, scope);
          const active = meta.section === section;
          return (
            <button
              key={section}
              type="button"
              className={`rd-book-pager__section${active ? " is-active" : ""}`}
              disabled={disabled || !target}
              aria-current={active ? "page" : undefined}
              onClick={() => target && onPageChange?.(target)}
            >
              {sectionMeta?.label ?? section}
            </button>
          );
        })}
      </div>

      <div className="rd-book-pager__index">
        <small>{scope === BOOK_SCOPE.REALM ? t("book.realmBook") : t("book.realmsBook")}</small>
        <strong>{meta.label}</strong>
      </div>
    </nav>
  );
}
