import { useEffect, useState } from "react";
import GameIcon from "../../assets/GameIcon.jsx";
import { APP_BUILD_VERSION, APP_BUILD_COMPATIBILITY_VERSION } from "../../../appBuild.js";
import { lobbyReconnectSeconds } from "../../../game/playerPresence.js";
import { getLobbyRequiredPlayers } from "../../../game/lobbyRules.js";
import { BOOK_PAGE, BOOK_SCOPE } from "../bookPages.js";
import Leaf, { Opening } from "./Leaf.jsx";
import GameSettingsControls from "../../settings/GameSettingsControls.jsx";

/*
   Páginas do reino, mais as três que existem nos dois âmbitos.

   Opções, Regras e Diagnóstico têm `scope: ANY` no registo, portanto são
   folheadas tanto no foyer como no reino. Isso obriga-as a lidar com `realm`
   ausente, e é por isso que cada uma tem um ramo para quando ainda não há
   partida. É a única complexidade que o âmbito partilhado acrescenta, e vale a
   pena: as regras e o diagnóstico são justamente o que se quer consultar antes
   de entrar num reino.
*/

function ReadyActions({ realm }) {
  const { localPlayer, isHost, isStarting, hasConfirmedCharacter, allReady } = realm;
  return (
    <div className="rd-lobby-book-ui__actions">
      <button
        data-testid="ready-toggle"
        className={localPlayer?.ready ? "is-ready" : ""}
        type="button"
        onClick={realm.onToggleReady}
        disabled={isStarting || !hasConfirmedCharacter}
      >
        {localPlayer?.ready ? "Cancelar pronto" : "Estou pronto"}
      </button>
      {isHost ? (
        <button data-testid="start-game" className="is-primary" type="button" disabled={!allReady || isStarting} onClick={realm.onStart}>
          <GameIcon name="C_Elm04" size={21} /> {isStarting ? "A abrir o mapa…" : "Iniciar partida"}
        </button>
      ) : (
        <p className="rd-lobby-book-ui__waiting">{allReady ? "À espera do anfitrião…" : "A mesa aguarda todos os jogadores."}</p>
      )}
    </div>
  );
}

function PlayerRow({ player, slot, realm, onRequestKick }) {
  if (!player) {
    return (
      <div className="rd-lobby-book-ui__player is-empty">
        <span><strong>Lugar {slot + 1}</strong><em>À espera de um reino</em></span>
        {realm.isHost && <button data-testid="add-bot" type="button" onClick={realm.onAddBot} disabled={realm.isStarting}>Adicionar bot</button>}
      </div>
    );
  }
  const disconnected = player.connected === false;
  const isLocal = player.index === realm.seat;
  return (
    <div className={`rd-lobby-book-ui__player${isLocal ? " is-local" : ""}${disconnected ? " is-disconnected" : ""}`}>
      <span>
        <small>{player.index === 0 ? "ANFITRIÃO" : player.controller === "bot" ? `BOT ${player.index}` : `JOGADOR ${player.index + 1}`}{isLocal ? " · TU" : ""}</small>
        <strong>{player.character?.n ?? "Casa por escolher"}</strong>
        <em>{player.controller === "bot" ? "Controlado pelo reino" : disconnected ? `Lugar reservado por ${lobbyReconnectSeconds(player, realm.presenceNow) ?? 0}s` : player.ready ? "Pronto" : "A preparar-se"}</em>
      </span>
      {realm.isHost && player.index > 0 && (
        <button type="button" onClick={() => onRequestKick(player.playerId)} disabled={realm.isStarting}>{player.controller === "bot" ? "Remover bot" : "Expulsar"}</button>
      )}
    </div>
  );
}

export function RealmPage({ realm }) {
  const { game, mode, players, localPlayer, perk, isStarting, hasConfirmedCharacter, codeCopied } = realm;
  const requiredPlayers = getLobbyRequiredPlayers(game);
  return (
    <>
      <Leaf page={BOOK_PAGE.REALM} side="left" chapter="A PARTIDA" title={mode.name}>
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>Duração estimada</dt><dd>{mode.duration}</dd></div>
          <div><dt>Estado</dt><dd>{isStarting ? "A iniciar" : "No salão"}</dd></div>
          <div><dt>Tipo</dt><dd>{game.test ? "Reino de teste" : "Reino normal"}</dd></div>
          <div><dt>Jogadores</dt><dd>{players.length}/4</dd></div>
        </dl>
        <button data-testid="room-code" className="rd-lobby-book-ui__code" type="button" onClick={realm.onCopyCode}>
          <small>{codeCopied ? "CÓDIGO COPIADO" : "CÓDIGO DO REINO"}</small>
          <strong>{game.code}</strong>
          <span>{codeCopied ? "Pronto para partilhar" : "Clica para copiar"}</span>
        </button>
      </Leaf>
      <Leaf page={BOOK_PAGE.REALM} side="right" chapter="O TEU LUGAR" title={localPlayer?.character?.n ?? "Casa por escolher"}>
        {perk
          ? <div className="rd-lobby-book-ui__perk"><small>PODER DA TUA CASA</small><strong>{perk.n}</strong><p>{perk.d}</p></div>
          : <p className="rd-lobby-book-ui__folio-copy">A tua casa, prontidão e lugar na mesa são controlados a partir deste livro.</p>}
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>Personagem</dt><dd>{hasConfirmedCharacter ? "Confirmada" : "Por escolher"}</dd></div>
          <div><dt>Prontidão</dt><dd>{localPlayer?.ready ? "Pronto" : "A preparar"}</dd></div>
          <div><dt>Mínimo</dt><dd>{requiredPlayers} jogadores</dd></div>
        </dl>
        <div className="rd-lobby-book-ui__realm-actions">
          <button
            className={`rd-lobby-book-ui__realm-action${!hasConfirmedCharacter ? " is-primary" : ""}`}
            type="button"
            onClick={realm.onSwapCharacter}
            disabled={isStarting}
          >
            <GameIcon name="RDD_Palace" size={24} alt="" />
            <span>
              <strong>{hasConfirmedCharacter ? "Trocar de casa" : "Escolher a minha casa"}</strong>
              <em>{hasConfirmedCharacter ? "Volta à parede das casas e escolhe outro brasão." : "Escolhe a casa que te representará nesta partida."}</em>
            </span>
          </button>
          <button
            className="rd-lobby-book-ui__realm-action is-leave"
            type="button"
            onClick={realm.onLeave}
            disabled={isStarting}
            data-testid="leave-realm"
          >
            <span className="rd-lobby-book-ui__action-symbol" aria-hidden="true">↩</span>
            <span>
              <strong>Sair do reino</strong>
              <em>{realm.isHost ? "Desfaz o reino e desliga os convidados." : "Liberta o teu lugar e regressa ao salão."}</em>
            </span>
          </button>
        </div>
        {game.test && <p className="rd-lobby-book-ui__test-note">Reino de teste · pode iniciar a partir de {requiredPlayers} jogadores.</p>}
        <ReadyActions realm={realm} />
      </Leaf>
    </>
  );
}

export function PlayersPage({ realm }) {
  const [pendingKickId, setPendingKickId] = useState(null);
  useEffect(() => setPendingKickId(null), [realm.players.length]);
  const pendingPlayer = realm.players.find((player) => player.playerId === pendingKickId) ?? null;
  const pendingName = pendingPlayer?.character?.n ?? "este jogador";
  const pendingIsBot = pendingPlayer?.controller === "bot";
  return (
    <>
      <Leaf page={BOOK_PAGE.PLAYERS} side="left" chapter="A MESA" title="Jogadores I">
        <div className="rd-lobby-book-ui__players">
          {realm.slots.slice(0, 2).map((player, slot) => (
            <PlayerRow key={player?.playerId || `empty-${slot}`} player={player} slot={slot} realm={realm} onRequestKick={setPendingKickId} />
          ))}
        </div>
        <Opening>Os lugares desligados ficam reservados durante a janela de reconexão.</Opening>
      </Leaf>
      <Leaf page={BOOK_PAGE.PLAYERS} side="right" chapter="A MESA" title="Jogadores II">
        <div className="rd-lobby-book-ui__players">
          {realm.slots.slice(2, 4).map((player, offset) => (
            <PlayerRow key={player?.playerId || `empty-${offset + 2}`} player={player} slot={offset + 2} realm={realm} onRequestKick={setPendingKickId} />
          ))}
        </div>
        {pendingPlayer && (
          <div className="rd-lobby-book-ui__confirm" role="alertdialog" aria-label={`Confirmar expulsão de ${pendingName}`}>
            <p>{pendingIsBot ? "Remover" : "Expulsar"} <strong>{pendingName}</strong> deste reino?</p>
            <div>
              <button type="button" onClick={() => setPendingKickId(null)}>Cancelar</button>
              <button data-testid={`kick-${pendingPlayer.playerId}`} type="button" onClick={() => { realm.onKickPlayer?.(pendingPlayer.playerId); setPendingKickId(null); }}>
                {pendingIsBot ? "Confirmar remoção" : "Confirmar expulsão"}
              </button>
            </div>
          </div>
        )}
        <ReadyActions realm={realm} />
      </Leaf>
    </>
  );
}

export function SettingsPage({ realm, scope, audio }) {
  const inRealm = scope === BOOK_SCOPE.REALM && realm;
  return (
    <>
      <Leaf page={BOOK_PAGE.SETTINGS} side="left" chapter="CONFIGURAÇÃO" title="Opções do reino">
        {inRealm ? (
          realm.game.mode === "guerra" ? (
            <button className="rd-lobby-book-ui__setting" type="button" onClick={realm.onTogglePerks} disabled={!realm.isHost || realm.isStarting}>
              Poderes de casa: <b>{realm.game.perksOn === false ? "desligados" : "ativos"}</b>
              <span>{realm.isHost ? "Alterar configuração" : "Definido pelo anfitrião"}</span>
            </button>
          ) : (
            <p className="rd-lobby-book-ui__folio-copy">Este modo não possui opções de partida alteráveis no salão.</p>
          )
        ) : (
          <p className="rd-lobby-book-ui__folio-copy">
            As opções de partida ficam disponíveis depois de fundares ou entrares num reino.
          </p>
        )}
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>Modo</dt><dd>{inRealm ? realm.mode.name : "Por escolher"}</dd></div>
          <div><dt>Tipo</dt><dd>{inRealm ? (realm.game.test ? "Teste" : "Normal") : "—"}</dd></div>
          <div><dt>Autoridade</dt><dd>{inRealm ? (realm.isHost ? "Anfitrião" : "Convidado") : "—"}</dd></div>
        </dl>
      </Leaf>
      <Leaf page={BOOK_PAGE.SETTINGS} side="right" chapter="ESTE DISPOSITIVO" title="Preferências">
        <GameSettingsControls
          settings={audio?.settings}
          setSetting={audio?.setSetting}
          fullscreen={audio?.fullscreen}
          onToggleFullscreen={audio?.onToggleFullscreen}
          compact
        />
      </Leaf>
    </>
  );
}

export function RulesPage({ realm, scope }) {
  const inRealm = scope === BOOK_SCOPE.REALM && realm;
  const requiredPlayers = inRealm ? getLobbyRequiredPlayers(realm.game) : 3;
  return (
    <>
      <Leaf page={BOOK_PAGE.RULES} side="left" chapter="REGRAS DA MESA" title={inRealm ? realm.mode.name : "Como se joga"}>
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>Jogadores</dt><dd>{requiredPlayers}–4</dd></div>
          <div><dt>Duração</dt><dd>{inRealm ? realm.mode.duration : "Depende do modo"}</dd></div>
          <div><dt>Teste</dt><dd>{inRealm ? (realm.game.test ? "99 recursos iniciais" : "Regras normais") : "—"}</dd></div>
        </dl>
        <Opening>
          Todos os jogadores presentes precisam de escolher uma casa e marcar-se como
          prontos antes do anfitrião poder iniciar.
        </Opening>
      </Leaf>
      <Leaf page={BOOK_PAGE.RULES} side="right" chapter="COMO USAR O SALÃO" title="Antes da partida">
        <ol className="rd-lobby-book-ui__rules-list">
          <li>Funda um reino ou entra com um código.</li>
          <li>Escolhe e confirma a tua casa na parede das casas.</li>
          <li>Partilha o código do reino com os outros jogadores.</li>
          <li>Acompanha a mesa na página Jogadores.</li>
          <li>Marca-te como pronto e aguarda o anfitrião.</li>
        </ol>
        {inRealm && <ReadyActions realm={realm} />}
      </Leaf>
    </>
  );
}

export function DiagnosticsPage({ realm, scope, diagnostics }) {
  const inRealm = scope === BOOK_SCOPE.REALM && realm;
  const report = diagnostics?.report ?? null;
  const events = report?.events ?? [];
  return (
    <>
      <Leaf page={BOOK_PAGE.DIAGNOSTICS} side="left" chapter="ESTADO DO SISTEMA" title="Versão">
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>Build</dt><dd data-testid="diagnostics-version">v{APP_BUILD_VERSION}</dd></div>
          <div><dt>Compatibilidade</dt><dd>protocolo {APP_BUILD_COMPATIBILITY_VERSION}</dd></div>
          <div><dt>Ligação</dt><dd>{diagnostics?.connectionLabel ?? "—"}</dd></div>
          <div><dt>TURN</dt><dd>{report?.network?.turnEnabled ? "ativo" : "não configurado"}</dd></div>
          <div><dt>Signaling</dt><dd>{report?.network?.signaling === "custom" ? "próprio" : "PeerJS cloud"}</dd></div>
          <div><dt>Papel</dt><dd>{inRealm ? (realm.isHost ? "Anfitrião" : "Convidado") : "Sem reino"}</dd></div>
          <div><dt>Reino</dt><dd>{inRealm ? realm.game.code : "—"}</dd></div>
        </dl>
        <Opening>
          Ao reportar um problema, indica a versão e o código do reino. Os jogadores de uma
          mesma partida têm de ter o mesmo protocolo.
        </Opening>
      </Leaf>
      <Leaf page={BOOK_PAGE.DIAGNOSTICS} side="right" chapter="REGISTO LOCAL" title="Últimos eventos">
        {!events.length && <p className="rd-lobby-book-ui__folio-copy">Sem eventos registados neste navegador.</p>}
        <div className="rd-lobby-book-ui__diagnostics" data-testid="diagnostics-events">
          {events.slice(-8).reverse().map((event, index) => (
            <article key={`${event.at ?? index}-${index}`}>
              <span><strong>{event.type ?? "evento"}</strong><em>{event.at ?? ""}</em></span>
              {event.message && <p>{event.message}</p>}
            </article>
          ))}
        </div>
        <div className="rd-lobby-book-ui__actions is-single-column">
          <button type="button" onClick={diagnostics?.onCopyReport} disabled={!diagnostics?.onCopyReport}>
            {diagnostics?.reportCopied ? "Relatório copiado" : "Copiar relatório"}
          </button>
        </div>
      </Leaf>
    </>
  );
}
