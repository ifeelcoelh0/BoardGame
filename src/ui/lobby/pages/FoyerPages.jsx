import { BOOK_PAGE } from "../bookPages.js";
import { ROOM_CODE_LENGTH, normalizeRoomCode } from "../../../game/roomCode.js";
import Leaf, { Opening } from "./Leaf.jsx";
import { formatSavedRealmDate, savedRealmStatus } from "../savedRealmsModel.js";
import GameIcon from "../../assets/GameIcon.jsx";

/*
   Páginas do foyer.

   Estas quatro viviam como JSX inline dentro do `ReinosDoDragao.jsx`, na
   variável `entryContent`: cerca de 7000 caracteres com o layout feito por
   `style={{...}}`. Como as páginas do reino já usavam a folha dupla com classes
   próprias, o livro eram dois sistemas visuais diferentes, e três regras de CSS
   existiam só para desfazer os estilos inline com `!important`. Agora as nove
   páginas usam a mesma marcação: duas `article` por página, esquerda e direita.

   Nenhuma destas páginas conhece a rede nem o estado da aplicação. Recebem dados
   e callbacks no `foyer` do contexto do livro.
*/

const MODES = [
  { id: "dragao", n: "Modo Dragão", icon: "RDD_ModeDragon", d: "A campanha completa, com o dragão a interferir na mesa." },
  // O palácio serve temporariamente de emblema do Clássico; quando existir um
  // castelo dedicado basta trocar este ID sem tocar no layout do códice.
  { id: "classico", n: "Modo Clássico", icon: "RDD_Palace", d: "Construção e comércio, sem eventos de dragão." },
  { id: "rapido", n: "Cerco Relâmpago", icon: "S_Thunder03", d: "Partida curta, pontuação reduzida." },
  { id: "guerra", n: "Guerra dos Reinos", icon: "W_Sword006", d: "Combate directo e poderes de casa." },
  { id: "exploracao", n: "Terras do Além", icon: "I_Map", d: "Mapa maior, com regiões por descobrir." },
];

export function HomePage({ foyer, goTo }) {
  const savedCount = foyer.savedRealms?.length ?? 0;
  return (
    <>
      <Leaf page={BOOK_PAGE.HOME} side="left" chapter="O SALÃO" title="Reinos do Dragão">
        <Opening>Oito casas. Um trono. E um dragão que não escolhe lados.</Opening>
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>Jogadores</dt><dd>2 a 4</dd></div>
          <div><dt>Casas</dt><dd>8 disponíveis</dd></div>
          <div><dt>Reinos guardados</dt><dd>{savedCount}</dd></div>
        </dl>
        <p className="rd-lobby-book-ui__folio-copy">
          Folheia o livro para consultar regras, opções e diagnóstico a qualquer momento.
        </p>
      </Leaf>
      <Leaf page={BOOK_PAGE.HOME} side="right" chapter="COMEÇAR" title="Escolhe o caminho">
        <div className="rd-lobby-book-ui__actions is-single-column">
          <button data-testid="create-realm" className="is-primary" type="button" onClick={() => goTo(BOOK_PAGE.MODE)}>
            <GameIcon name="RDD_FoundRealm" size={30} alt="" />
            <span>Fundar um Reino</span>
          </button>
          <button data-testid="join-realm" type="button" onClick={() => { foyer.setErr(""); goTo(BOOK_PAGE.JOIN); }}>
            <GameIcon name="I_Key01" size={30} alt="" />
            <span>Entrar com Código</span>
          </button>
          <button
            data-testid="open-saved-realms"
            type="button"
            disabled={savedCount === 0}
            onClick={() => { foyer.onRefreshSaved(); goTo(BOOK_PAGE.SAVED_REALMS); }}
          >
            <GameIcon name="I_Chest01" size={30} alt="" />
            <span>Reinos guardados{savedCount ? ` (${savedCount})` : ""}</span>
          </button>
        </div>
        {foyer.err && <p className="rd-lobby-book-ui__error">{foyer.err}</p>}
      </Leaf>
    </>
  );
}

export function ModePage({ foyer, goTo }) {
  const busy = foyer.connSt === "wait";
  return (
    <>
      <Leaf page={BOOK_PAGE.MODE} side="left" chapter="FUNDAR REINO" title="Modo de jogo">
        <div className="rd-lobby-book-ui__modes">
          {MODES.map((mode) => (
            <button
              data-testid={`mode-${mode.id}`}
              key={mode.id}
              type="button"
              disabled={busy}
              onClick={() => foyer.onCreate(mode.id)}
            >
              <span aria-hidden="true"><GameIcon name={mode.icon} size={34} alt="" /></span>
              <span><strong>{mode.n}</strong><em>{mode.d}</em></span>
            </button>
          ))}
        </div>
      </Leaf>
      <Leaf page={BOOK_PAGE.MODE} side="right" chapter="ANTES DE FUNDAR" title="Condições">
        <button
          className="rd-lobby-book-ui__setting"
          type="button"
          onClick={() => foyer.setTestSel(!foyer.testSel)}
        >
          Modo de teste: <b>{foyer.testSel ? "ligado" : "desligado"}</b>
          <span>99 recursos iniciais e partida a partir de 2 jogadores</span>
        </button>
        <p className="rd-lobby-book-ui__folio-copy">
          Ao fundar o reino serás levado à parede das casas para escolher a tua. Depois
          voltas ao salão com o código pronto a partilhar.
        </p>
        {foyer.err && <p className="rd-lobby-book-ui__error">{foyer.err}</p>}
        <div className="rd-lobby-book-ui__actions is-single-column">
          <button type="button" onClick={() => goTo(BOOK_PAGE.HOME)}>← Voltar ao início</button>
        </div>
      </Leaf>
    </>
  );
}

export function JoinPage({ foyer, goTo }) {
  const busy = foyer.connSt === "wait";
  return (
    <>
      <Leaf page={BOOK_PAGE.JOIN} side="left" chapter="ENTRAR NUM REINO" title="Código do reino">
        <Opening>Pede o código de seis letras a quem fundou o reino.</Opening>
        <input
          data-testid="room-code-input"
          className="rd-lobby-book-ui__code-input"
          maxLength={ROOM_CODE_LENGTH}
          value={foyer.codeIn}
          onChange={(event) => foyer.setCodeIn(normalizeRoomCode(event.target.value))}
          placeholder="ABCDEF"
          aria-label="Código do reino"
        />
        {foyer.err && <p className="rd-lobby-book-ui__error">{foyer.err}</p>}
        <div className="rd-lobby-book-ui__actions is-single-column">
          <button data-testid="join-submit" className="is-primary" type="button" disabled={busy} onClick={foyer.onJoin}>
            {busy ? "A entrar…" : "Entrar"}
          </button>
          <button type="button" onClick={() => { foyer.setErr(""); goTo(BOOK_PAGE.HOME); }}>← Voltar ao início</button>
        </div>
      </Leaf>
      <Leaf page={BOOK_PAGE.JOIN} side="right" chapter="O QUE ACONTECE DEPOIS" title="Ao entrar">
        <ol className="rd-lobby-book-ui__rules-list">
          <li>Reservamos-te um lugar na mesa.</li>
          <li>Escolhes a tua casa na parede das casas.</li>
          <li>Voltas ao salão e marcas-te como pronto.</li>
          <li>O anfitrião inicia quando a mesa estiver completa.</li>
        </ol>
        <p className="rd-lobby-book-ui__folio-copy">
          Se perderes a ligação, o teu lugar fica reservado durante a janela de reconexão.
        </p>
      </Leaf>
    </>
  );
}

export function SavedRealmsPage({ foyer, goTo }) {
  const entries = foyer.savedRealms ?? [];
  const recoverable = entries.filter((entry) => savedRealmStatus(entry).recoverable).length;
  return (
    <>
      <Leaf page={BOOK_PAGE.SAVED_REALMS} side="left" chapter="REINOS GUARDADOS" title="Arquivos">
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>Guardados</dt><dd>{entries.length}</dd></div>
          <div><dt>Recuperáveis</dt><dd>{recoverable}</dd></div>
        </dl>
        <Opening>
          Estes reinos estão guardados apenas neste navegador. Apagar aqui não afecta os
          outros jogadores.
        </Opening>
        <div className="rd-lobby-book-ui__actions is-single-column">
          <button type="button" onClick={() => goTo(BOOK_PAGE.HOME)}>← Voltar ao início</button>
        </div>
      </Leaf>
      <Leaf page={BOOK_PAGE.SAVED_REALMS} side="right" chapter="RECUPERAR" title="Escolhe um reino">
        {!entries.length && <p className="rd-lobby-book-ui__folio-copy">Não existem reinos guardados.</p>}
        <div className="rd-lobby-book-ui__saved">
          {entries.map((entry) => {
            const status = savedRealmStatus(entry);
            return (
              <article key={entry.code} data-testid={`saved-realm-${entry.code}`}>
                <span>
                  <strong>{entry.code}</strong>
                  <em>{status.label} · {formatSavedRealmDate(entry.updatedAt)}</em>
                  {entry.appVersion && <em>Guardado na v{entry.appVersion}</em>}
                  {!entry.valid && <em className="is-error">Não foi possível validar ({entry.reason || "erro desconhecido"}).</em>}
                </span>
                <div>
                  <button type="button" disabled={!status.recoverable} onClick={() => foyer.onResume(entry.code)}>Retomar</button>
                  <button type="button" onClick={() => foyer.onDeleteSave(entry.code)}>Apagar</button>
                </div>
              </article>
            );
          })}
        </div>
      </Leaf>
    </>
  );
}
