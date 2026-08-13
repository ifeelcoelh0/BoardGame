import { useEffect, useState } from "react";
import { canStartLobby } from "../../game/lobbyRules.js";
import { lobbyReconnectSeconds } from "../../game/playerPresence.js";
import { LobbyChat } from "./LobbyPanels.jsx";
import { createLobbyViewModel } from "./lobbyViewModel.js";
import { t } from "../../locales/i18n.js";
import "../../styles/dragon-lobby.css";

export default function DragonLobby({
  game,
  seat,
  characters,
  perks,
  toast,
  chat,
  sendChat,
  onToggleReady,
  onStart,
  onSwapCharacter,
  onTogglePerks,
  onLeave,
  onAddBot,
  onKickPlayer,
  onCharacterSelect,
  isSelectingCharacter = false,
  startDurationMs = 2800,
  audioSystem = null,
  viewModel = null,
  presenceNow: controlledPresenceNow = null,
  previewCharacterId: controlledPreviewCharacterId,
  onPreviewCharacterChange,
  codeCopied = false,
  onCopyCode,
}) {
  const model = viewModel ?? createLobbyViewModel({ game, seat, characters, perks });
  const {
    mode, players, isHost, slots, perk,
    characterStates,
  } = model;
  const allReady = canStartLobby(game, 0);
  const isStarting = Boolean(game.lobbyStarting);
  const [internalPreviewCharacterId, setInternalPreviewCharacterId] = useState(null);
  const previewCharacterId = controlledPreviewCharacterId ?? internalPreviewCharacterId;
  const setPreviewCharacterId = onPreviewCharacterChange ?? setInternalPreviewCharacterId;
  /* O relógio de presença passou para o LobbyExperience, que é agora quem
     desenha o livro e a lista de jogadores. Aqui só é usado pelo espelho
     acessível, e um segundo temporizador a correr em paralelo era duplicação. */
  const [fallbackPresenceNow, setFallbackPresenceNow] = useState(() => Date.now());
  const presenceNow = controlledPresenceNow ?? fallbackPresenceNow;
  useEffect(() => {
    if (controlledPresenceNow !== null) return undefined;
    if (!players.some((player) => player.connected === false)) return undefined;
    setFallbackPresenceNow(Date.now());
    const timer = window.setInterval(() => setFallbackPresenceNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [controlledPresenceNow, players.map((player) => `${player.playerId}:${player.connected}`).join("|")]);

  const previewCharacter = isSelectingCharacter && previewCharacterId ? characters.find((character) => character.id === previewCharacterId) ?? null : null;
  const previewPerk = previewCharacter && game.mode === "guerra" ? perks[previewCharacter.id] ?? null : null;
  // Selar fecha o pergaminho e só depois escolhe, para a cena não continuar a
  // desenhar o dossiê de uma casa que já foi tomada.
  const confirmCharacter = (characterId) => {
    setPreviewCharacterId(null);
    onCharacterSelect?.(characterId);
  };

  return (
    <div data-testid="lobby-root" className={`rd-lobby${isStarting ? " is-starting" : ""}${isSelectingCharacter ? " is-selecting" : ""}`} style={{ "--rd-lobby-start-ms": `${startDurationMs}ms` }}>
      {/* Espelho acessível de tudo o que passou para a cena. A cena está
          aria-hidden, por isso os cartões da mesa, as fichas de pronto e o
          pergaminho têm de existir aqui em texto e em botões reais. */}
      <div className="rd-lobby-sr" aria-live="polite">
        <h2>{t("lobby.roomState")}</h2>
        <p>{t("lobby.modeDuration", { mode: mode.name, duration: mode.duration })}{game.test ? t("lobby.testResources") : ""}</p>
        {perk && <p>{t("lobby.yourHousePowerSr", { name: perk.n, description: perk.d })}</p>}
        {/* O <strong> não é decorativo: o lobby-flow.spec.js lê o código por
            getByTestId("room-code").locator("strong"). */}
        <button type="button" onClick={onCopyCode}>
          {codeCopied ? t("lobby.codeCopiedSr") : t("lobby.copyCodeSr")} <strong>{game.code}</strong>
        </button>
        <ul>
          {slots.map((player, slot) => (
            <li key={player ? player.playerId || player.index : `empty-${slot}`}>
              {player ? (
                <span data-testid="lobby-player-row">
                  {`${player.index === 0 ? t("lobby.hostSr") : player.controller === "bot" ? t("lobby.botSr", { number: player.index }) : t("lobby.playerSr", { number: player.index + 1 })}: ${player.character ? `${player.character.n}, ${player.character.t}` : t("lobby.houseToChoose")}. ${player.connected === false ? t("lobby.disconnectedReserved", { seconds: lobbyReconnectSeconds(player, presenceNow) ?? 0 }) : player.ready ? t("lobby.readySentence") : t("lobby.preparingSentence")}${player.index === seat ? t("lobby.yourSeatSentence") : ""}`}
                  {isHost && player.index > 0 && (
                    <button
                      type="button"
                      onClick={() => onKickPlayer?.(player.playerId)}
                      aria-label={t("lobby.removePlayerAria", { name: player.character?.n ?? t("lobby.playerWithoutHouse") })}
                    >
                      {player.controller === "bot" ? t("lobby.removeBot") : t("lobby.kick")}
                    </button>
                  )}
                </span>
              ) : (
                <span>
                  {t("lobby.emptySeat")}
                  {isHost && <button type="button" onClick={onAddBot}>{t("lobby.addBot")}</button>}
                </span>
              )}
            </li>
          ))}
        </ul>
        {game.mode === "guerra" && (
          <button type="button" onClick={onTogglePerks} disabled={!isHost || isStarting}>
            {t("lobby.housePowersState", { state: game.perksOn === false ? t("lobby.disabledState") : t("lobby.activeState") })}
          </button>
        )}
        {isSelectingCharacter && (
          <>
            <h3>{t("lobby.houseGallery")}</h3>
            {previewCharacter ? (
              <>
                <p>{previewCharacter.n} — {previewCharacter.t}. {previewPerk ? t("lobby.housePowerSentence", { name: previewPerk.n, description: previewPerk.d }) : ""}</p>
                <button type="button" onClick={() => confirmCharacter(previewCharacter.id)}>{t("lobby.sealPact", { name: previewCharacter.n })}</button>
                <button type="button" onClick={() => setPreviewCharacterId(null)}>{t("lobby.backGallery")}</button>
              </>
            ) : (
              characters.map((character) => {
                const state = characterStates[character.id];
                if (state?.status === "taken") {
                  return <p key={character.id}>{t("lobby.houseTaken", { name: character.n })}</p>;
                }
                return (
                  <button key={character.id} type="button" onClick={() => setPreviewCharacterId(character.id)}>
                    {t("lobby.viewHouse", { name: character.n, title: character.t, local: state?.status === "local" ? t("lobby.localHouseSuffix") : "" })}
                  </button>
                );
              })
            )}
          </>
        )}
      </div>

      {isStarting && (
        <div className="rd-lobby-transition" aria-live="polite">
          <span className="rd-lobby-transition__sigil" aria-hidden="true">◆</span>
          <small>{t("lobby.realmsGathered")}</small>
          <strong>{t("lobby.tableReveals")}</strong>
        </div>
      )}
      {toast && <div className="toast rd-lobby-toast">{toast.msg}</div>}

      <header className="rd-lobby-header">
        <small>{t("lobby.preparationHall")}</small>
        <h1>{t("lobby.gameTitle").toUpperCase()}</h1>
      </header>


      <LobbyChat chat={chat} players={players} sendChat={sendChat} />

    </div>
  );
}
