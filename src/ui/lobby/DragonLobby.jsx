import { useEffect, useState } from "react";
import { canStartLobby } from "../../game/lobbyRules.js";
import { lobbyReconnectSeconds } from "../../game/playerPresence.js";
import { LobbyChat } from "./LobbyPanels.jsx";
import { createLobbyViewModel } from "./lobbyViewModel.js";
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
        <h2>Estado da sala</h2>
        <p>Modo {mode.name}. Duração estimada {mode.duration}.{game.test ? " Reino de teste: 99 recursos para todos." : ""}</p>
        {perk && <p>Poder da tua casa: {perk.n}. {perk.d}</p>}
        {/* O <strong> não é decorativo: o lobby-flow.spec.js lê o código por
            getByTestId("room-code").locator("strong"). */}
        <button type="button" onClick={onCopyCode}>
          {codeCopied ? "Código copiado do reino" : "Copiar código do reino"} <strong>{game.code}</strong>
        </button>
        <ul>
          {slots.map((player, slot) => (
            <li key={player ? player.playerId || player.index : `empty-${slot}`}>
              {player ? (
                <span data-testid="lobby-player-row">
                  {`${player.index === 0 ? "Anfitrião" : player.controller === "bot" ? `Bot ${player.index}` : `Jogador ${player.index + 1}`}: ${player.character ? `${player.character.n}, ${player.character.t}` : "casa por escolher"}. ${player.connected === false ? `Desligado, lugar reservado ${lobbyReconnectSeconds(player, presenceNow) ?? 0} segundos.` : player.ready ? "Pronto." : "A preparar-se."}${player.index === seat ? " É o teu lugar." : ""}`}
                  {isHost && player.index > 0 && (
                    <button
                      type="button"
                      onClick={() => onKickPlayer?.(player.playerId)}
                      aria-label={`Remover ${player.character?.n ?? "jogador sem casa"} do lobby`}
                    >
                      {player.controller === "bot" ? "Remover bot" : "Expulsar"}
                    </button>
                  )}
                </span>
              ) : (
                <span>
                  Lugar vazio.
                  {isHost && <button type="button" onClick={onAddBot}>Adicionar bot</button>}
                </span>
              )}
            </li>
          ))}
        </ul>
        {game.mode === "guerra" && (
          <button type="button" onClick={onTogglePerks} disabled={!isHost || isStarting}>
            Poderes de casa {game.perksOn === false ? "desligados" : "ativos"} — alternar
          </button>
        )}
        {isSelectingCharacter && (
          <>
            <h3>Galeria das casas</h3>
            {previewCharacter ? (
              <>
                <p>{previewCharacter.n} — {previewCharacter.t}. {previewPerk ? `Poder da casa: ${previewPerk.n}. ${previewPerk.d}` : ""}</p>
                <button type="button" onClick={() => confirmCharacter(previewCharacter.id)}>Selar o pacto com {previewCharacter.n}</button>
                <button type="button" onClick={() => setPreviewCharacterId(null)}>Voltar à galeria</button>
              </>
            ) : (
              characters.map((character) => {
                const state = characterStates[character.id];
                if (state?.status === "taken") {
                  return <p key={character.id}>{character.n} já foi tomada por outro jogador.</p>;
                }
                return (
                  <button key={character.id} type="button" onClick={() => setPreviewCharacterId(character.id)}>
                    Ver {character.n}, {character.t}{state?.status === "local" ? " (a tua casa)" : ""}
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
          <small>OS REINOS ESTÃO REUNIDOS</small>
          <strong>A mesa revela o vosso destino</strong>
        </div>
      )}
      {toast && <div className="toast rd-lobby-toast">{toast.msg}</div>}

      <header className="rd-lobby-header">
        <small>SALÃO DE PREPARAÇÃO</small>
        <h1>REINOS DO DRAGÃO</h1>
      </header>


      <LobbyChat chat={chat} players={players} sendChat={sendChat} />

    </div>
  );
}
