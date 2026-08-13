import { useEffect, useState } from "react";
import GameIcon from "../../assets/GameIcon.jsx";
import { APP_BUILD_VERSION, APP_BUILD_COMPATIBILITY_VERSION } from "../../../appBuild.js";
import { lobbyReconnectSeconds } from "../../../game/playerPresence.js";
import { getLobbyRequiredPlayers } from "../../../game/lobbyRules.js";
import { BOOK_PAGE, BOOK_SCOPE } from "../bookPages.js";
import Leaf, { Opening } from "./Leaf.jsx";
import GameSettingsControls from "../../settings/GameSettingsControls.jsx";
import { t } from "../../../locales/i18n.js";

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
        {localPlayer?.ready ? t("lobby.readyCancel") : t("lobby.ready")}
      </button>
      {isHost ? (
        <button data-testid="start-game" className="is-primary" type="button" disabled={!allReady || isStarting} onClick={realm.onStart}>
          <GameIcon name="C_Elm04" size={21} /> {isStarting ? t("lobby.openingMap") : t("lobby.startMatch")}
        </button>
      ) : (
        <p className="rd-lobby-book-ui__waiting">{allReady ? t("lobby.waitHost") : t("lobby.waitPlayers")}</p>
      )}
    </div>
  );
}

function PlayerRow({ player, slot, realm, onRequestKick }) {
  if (!player) {
    return (
      <div className="rd-lobby-book-ui__player is-empty">
        <span><strong>{t("lobby.seat", { slot: slot + 1 })}</strong><em>{t("lobby.waitRealm")}</em></span>
        {realm.isHost && <button data-testid="add-bot" type="button" onClick={realm.onAddBot} disabled={realm.isStarting}>{t("lobby.addBot")}</button>}
      </div>
    );
  }
  const disconnected = player.connected === false;
  const isLocal = player.index === realm.seat;
  return (
    <div className={`rd-lobby-book-ui__player${isLocal ? " is-local" : ""}${disconnected ? " is-disconnected" : ""}`}>
      <span>
        <small>{player.index === 0 ? t("lobby.host") : player.controller === "bot" ? `BOT ${player.index}` : t("lobby.player", { number: player.index + 1 })}{isLocal ? ` · ${t("lobby.you")}` : ""}</small>
        <strong>{player.character?.n ?? t("lobby.houseUnchosen")}</strong>
        <em>{player.controller === "bot" ? t("lobby.botControlled") : disconnected ? t("lobby.seatReserved", { seconds: lobbyReconnectSeconds(player, realm.presenceNow) ?? 0 }) : player.ready ? t("lobby.readyState") : t("lobby.preparing")}</em>
      </span>
      {realm.isHost && player.index > 0 && (
        <button type="button" onClick={() => onRequestKick(player.playerId)} disabled={realm.isStarting}>{player.controller === "bot" ? t("lobby.removeBot") : t("lobby.kick")}</button>
      )}
    </div>
  );
}

export function RealmPage({ realm }) {
  const { game, mode, players, localPlayer, perk, isStarting, hasConfirmedCharacter, codeCopied } = realm;
  const requiredPlayers = getLobbyRequiredPlayers(game);
  return (
    <>
      <Leaf page={BOOK_PAGE.REALM} side="left" chapter={t("lobby.match")} title={mode.name}>
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>{t("lobby.estimatedDuration")}</dt><dd>{mode.duration}</dd></div>
          <div><dt>{t("lobby.state")}</dt><dd>{isStarting ? t("lobby.starting") : t("lobby.inHall")}</dd></div>
          <div><dt>{t("lobby.type")}</dt><dd>{game.test ? t("lobby.testRealm") : t("lobby.normalRealm")}</dd></div>
          <div><dt>{t("lobby.players")}</dt><dd>{players.length}/4</dd></div>
        </dl>
        <button data-testid="room-code" className="rd-lobby-book-ui__code" type="button" onClick={realm.onCopyCode}>
          <small>{codeCopied ? t("lobby.codeCopied") : t("lobby.realmCodeLabel")}</small>
          <strong>{game.code}</strong>
          <span>{codeCopied ? t("lobby.readyShare") : t("lobby.clickCopy")}</span>
        </button>
      </Leaf>
      <Leaf page={BOOK_PAGE.REALM} side="right" chapter={t("lobby.yourSeat")} title={localPlayer?.character?.n ?? t("lobby.houseUnchosen")}>
        {perk
          ? <div className="rd-lobby-book-ui__perk"><small>{t("lobby.yourHousePower")}</small><strong>{perk.n}</strong><p>{perk.d}</p></div>
          : <p className="rd-lobby-book-ui__folio-copy">{t("lobby.bookControls")}</p>}
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>{t("lobby.character")}</dt><dd>{hasConfirmedCharacter ? t("lobby.confirmed") : t("lobby.toChoose")}</dd></div>
          <div><dt>{t("lobby.readiness")}</dt><dd>{localPlayer?.ready ? t("lobby.readyState") : t("lobby.preparing")}</dd></div>
          <div><dt>{t("lobby.minimum")}</dt><dd>{t("lobby.playerCount", { count: requiredPlayers })}</dd></div>
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
              <strong>{hasConfirmedCharacter ? t("lobby.changeHouse") : t("lobby.chooseMyHouse")}</strong>
              <em>{hasConfirmedCharacter ? t("lobby.changeHouseDesc") : t("lobby.chooseHouseSelfDesc")}</em>
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
              <strong>{t("lobby.leaveRealm")}</strong>
              <em>{realm.isHost ? t("lobby.leaveHostDesc") : t("lobby.leaveGuestDesc")}</em>
            </span>
          </button>
        </div>
        {game.test && <p className="rd-lobby-book-ui__test-note">{t("lobby.testRealmNote", { count: requiredPlayers })}</p>}
        <ReadyActions realm={realm} />
      </Leaf>
    </>
  );
}

export function PlayersPage({ realm }) {
  const [pendingKickId, setPendingKickId] = useState(null);
  useEffect(() => setPendingKickId(null), [realm.players.length]);
  const pendingPlayer = realm.players.find((player) => player.playerId === pendingKickId) ?? null;
  const pendingName = pendingPlayer?.character?.n ?? t("lobby.thisPlayer");
  const pendingIsBot = pendingPlayer?.controller === "bot";
  return (
    <>
      <Leaf page={BOOK_PAGE.PLAYERS} side="left" chapter={t("lobby.table")} title={t("lobby.playersI")}>
        <div className="rd-lobby-book-ui__players">
          {realm.slots.slice(0, 2).map((player, slot) => (
            <PlayerRow key={player?.playerId || `empty-${slot}`} player={player} slot={slot} realm={realm} onRequestKick={setPendingKickId} />
          ))}
        </div>
        <Opening>{t("lobby.reconnectSeats")}</Opening>
      </Leaf>
      <Leaf page={BOOK_PAGE.PLAYERS} side="right" chapter={t("lobby.table")} title={t("lobby.playersII")}>
        <div className="rd-lobby-book-ui__players">
          {realm.slots.slice(2, 4).map((player, offset) => (
            <PlayerRow key={player?.playerId || `empty-${offset + 2}`} player={player} slot={offset + 2} realm={realm} onRequestKick={setPendingKickId} />
          ))}
        </div>
        {pendingPlayer && (
          <div className="rd-lobby-book-ui__confirm" role="alertdialog" aria-label={t("lobby.confirmKick", { name: pendingName })}>
            <p>{pendingIsBot ? t("lobby.removeQuestion") : t("lobby.kickQuestion")} <strong>{pendingName}</strong> {t("lobby.fromRealm")}</p>
            <div>
              <button type="button" onClick={() => setPendingKickId(null)}>{t("common.cancel")}</button>
              <button data-testid={`kick-${pendingPlayer.playerId}`} type="button" onClick={() => { realm.onKickPlayer?.(pendingPlayer.playerId); setPendingKickId(null); }}>
                {pendingIsBot ? t("lobby.confirmRemove") : t("lobby.confirmKickAction")}
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
      <Leaf page={BOOK_PAGE.SETTINGS} side="left" chapter={t("lobby.config")} title={t("lobby.realmOptions")}>
        {inRealm ? (
          realm.game.mode === "guerra" ? (
            <button className="rd-lobby-book-ui__setting" type="button" onClick={realm.onTogglePerks} disabled={!realm.isHost || realm.isStarting}>
              {t("lobby.housePowers")}: <b>{realm.game.perksOn === false ? t("lobby.disabled") : t("lobby.active")}</b>
              <span>{realm.isHost ? t("lobby.changeConfig") : t("lobby.hostDefined")}</span>
            </button>
          ) : (
            <p className="rd-lobby-book-ui__folio-copy">{t("lobby.noModeOptions")}</p>
          )
        ) : (
          <p className="rd-lobby-book-ui__folio-copy">
            {t("lobby.optionsAfterJoin")}
          </p>
        )}
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>{t("lobby.mode")}</dt><dd>{inRealm ? realm.mode.name : t("lobby.chooseLater")}</dd></div>
          <div><dt>{t("lobby.type")}</dt><dd>{inRealm ? (realm.game.test ? t("lobby.test") : t("lobby.normal")) : "—"}</dd></div>
          <div><dt>{t("lobby.authority")}</dt><dd>{inRealm ? (realm.isHost ? t("lobby.host") : t("lobby.guest")) : "—"}</dd></div>
        </dl>
      </Leaf>
      <Leaf page={BOOK_PAGE.SETTINGS} side="right" chapter={t("lobby.thisDevice")} title={t("lobby.preferences")}>
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
      <Leaf page={BOOK_PAGE.RULES} side="left" chapter={t("lobby.tableRules")} title={inRealm ? realm.mode.name : t("lobby.howToPlay")}>
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>{t("lobby.players")}</dt><dd>{requiredPlayers}–4</dd></div>
          <div><dt>{t("lobby.duration")}</dt><dd>{inRealm ? realm.mode.duration : t("lobby.dependsMode")}</dd></div>
          <div><dt>{t("lobby.test")}</dt><dd>{inRealm ? (realm.game.test ? "99 starting resources" : t("lobby.normalRules")) : "—"}</dd></div>
        </dl>
        <Opening>
          {t("lobby.readyOpening")}
        </Opening>
      </Leaf>
      <Leaf page={BOOK_PAGE.RULES} side="right" chapter={t("lobby.useHall")} title={t("lobby.beforeMatch")}>
        <ol className="rd-lobby-book-ui__rules-list">
          <li>{t("lobby.rule1")}</li>
          <li>{t("lobby.rule2")}</li>
          <li>{t("lobby.rule3")}</li>
          <li>{t("lobby.rule4")}</li>
          <li>{t("lobby.rule5")}</li>
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
      <Leaf page={BOOK_PAGE.DIAGNOSTICS} side="left" chapter={t("lobby.systemState")} title={t("lobby.version")}>
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>{t("lobby.build")}</dt><dd data-testid="diagnostics-version">v{APP_BUILD_VERSION}</dd></div>
          <div><dt>{t("lobby.compatibility")}</dt><dd>{t("lobby.protocol", { version: APP_BUILD_COMPATIBILITY_VERSION })}</dd></div>
          <div><dt>{t("lobby.connection")}</dt><dd>{diagnostics?.connectionLabel ?? "—"}</dd></div>
          <div><dt>{t("lobby.turn")}</dt><dd>{report?.network?.turnEnabled ? t("lobby.turnActive") : t("lobby.turnNotConfigured")}</dd></div>
          <div><dt>{t("lobby.signaling")}</dt><dd>{report?.network?.signaling === "custom" ? t("lobby.custom") : "PeerJS cloud"}</dd></div>
          <div><dt>{t("lobby.role")}</dt><dd>{inRealm ? (realm.isHost ? t("lobby.host") : t("lobby.guest")) : t("lobby.noRealm")}</dd></div>
          <div><dt>{t("hud.realm")}</dt><dd>{inRealm ? realm.game.code : "—"}</dd></div>
        </dl>
        <Opening>
          {t("lobby.reportOpening")}
        </Opening>
      </Leaf>
      <Leaf page={BOOK_PAGE.DIAGNOSTICS} side="right" chapter={t("lobby.localLog")} title={t("lobby.latestEvents")}>
        {!events.length && <p className="rd-lobby-book-ui__folio-copy">{t("lobby.noEvents")}</p>}
        <div className="rd-lobby-book-ui__diagnostics" data-testid="diagnostics-events">
          {events.slice(-8).reverse().map((event, index) => (
            <article key={`${event.at ?? index}-${index}`}>
              <span><strong>{event.type ?? t("lobby.event")}</strong><em>{event.at ?? ""}</em></span>
              {event.message && <p>{event.message}</p>}
            </article>
          ))}
        </div>
        <div className="rd-lobby-book-ui__actions is-single-column">
          <button type="button" onClick={diagnostics?.onCopyReport} disabled={!diagnostics?.onCopyReport}>
            {diagnostics?.reportCopied ? t("lobby.reportCopied") : t("lobby.copyReport")}
          </button>
        </div>
      </Leaf>
    </>
  );
}
