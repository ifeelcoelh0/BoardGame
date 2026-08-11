const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { readRuntimeSource, runtimeSourcePaths } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "src/game/gameStateView.js");
const transportPath = path.join(root, "src/multiplayer/stateTransport.js");
const hostRuntimePath = path.join(root, "src/multiplayer/hostRuntime.js");
const hostActionPath = path.join(root, "src/multiplayer/hostActionController.js");

(async () => {
  const views = await import(pathToFileURL(modulePath).href + `?v=${Date.now()}`);
  const game = {
    v: 12,
    phase: "play",
    deck: [{ id: 1, kind: "vp", sub: "Coroa" }, { id: 2, kind: "monopolio" }],
    players: [
      {
        playerId: "player_aaaaaaaaaaaaaaaaaaaaaaaa",
        seatId: "seat_aaaaaaaaaaaaaaaaaaaaaaaa",
        sessionTokenHash: "a".repeat(64),
        res: { madeira: 2, tijolo: 1, cavalos: 0, ouro: 0, obsidiana: 0 },
        devNew: [{ id: 10, kind: "vp", sub: "Coroa" }],
        devOld: [{ id: 11, kind: "monopolio" }],
      },
      {
        playerId: "player_bbbbbbbbbbbbbbbbbbbbbbbb",
        seatId: "seat_bbbbbbbbbbbbbbbbbbbbbbbb",
        sessionTokenHash: "b".repeat(64),
        res: { madeira: 0, tijolo: 0, cavalos: 3, ouro: 2, obsidiana: 1 },
        devNew: [],
        devOld: [{ id: 20, kind: "espiao" }],
      },
    ],
    board: {
      hexes: [
        { k: "0,0", terr: "floresta", num: 6, hid: false },
        { k: "1,0", terr: "grutas", num: 8, hid: true, treasure: "secret" },
      ],
      ports: [
        { e: "a|b", type: "ouro", hid: true },
        { e: "b|c", type: "madeira", hid: false },
      ],
    },
  };

  const original = JSON.stringify(game);
  const publicView = views.createPublicGameStateView(game);
  const privateView = views.createGameStateView(game, game.players[0].playerId);
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const transport = fs.readFileSync(transportPath, "utf8");
  const hostRuntime = fs.readFileSync(hostRuntimePath, "utf8");
  const hostActions = fs.readFileSync(hostActionPath, "utf8");

  check(transport.includes("payloadForConnection({ t: \"state\", g: game }, runtime, connection)"), "broadcast não aplica uma vista por ligação");
  check(hostRuntime.includes("connection.send(payloadForConnection(payload, runtime, connection))"), "respostas diretas não são filtradas por ligação");
  check(transport.includes("createPublicGameStateView(game)"), "ligações não autenticadas não usam vista pública");
  check(hostActions.includes("privateResult: applied.privateResult"), "resultado privado do Espião não é preservado");

  check(publicView.stateViewVersion === views.STATE_VIEW_VERSION, "versão da vista pública ausente");
  check(publicView.players.every((player) => !("sessionTokenHash" in player)), "hash de sessão exposto");
  check(publicView.players[0].resourceCount === 3 && publicView.players[1].resourceCount === 6, "contagem pública de recursos incorreta");
  check(Object.values(publicView.players[1].res).every((amount) => amount === 0), "tipos de recursos rivais expostos");
  check(publicView.players[0].devOld.every((card) => card.kind === "hidden"), "cartas públicas não foram ocultadas");
  check(publicView.players[0].devOld.length === 2 && publicView.players[0].devNew.length === 0, "contagem de cartas públicas alterada");
  check(publicView.deck.length === 2 && publicView.deck.every((card) => card.kind === "hidden"), "ordem ou conteúdo do baralho exposto");
  check(publicView.board.hexes[1].terr === views.HIDDEN_TERRAIN_TYPE && publicView.board.hexes[1].num === null, "hexágono oculto exposto");
  check(publicView.board.ports[0].type === "any", "porto oculto exposto");

  check(privateView.players[0].res.madeira === 2, "recursos do próprio jogador foram ocultados");
  check(privateView.players[0].devNew[0].kind === "vp", "cartas do próprio jogador foram ocultadas");
  check(Object.values(privateView.players[1].res).every((amount) => amount === 0), "recursos do adversário expostos na vista privada");
  check(privateView.players[1].devOld[0].kind === "hidden", "carta adversária exposta na vista privada");
  check(JSON.stringify(game) === original, "a criação da vista alterou o estado canónico");

  const ended = views.createPublicGameStateView({ ...game, phase: "ended" });
  check(ended.players[1].res.ouro === 2, "estado final não revelou os recursos");
  check(ended.players[0].devNew[0].kind === "vp", "estado final não revelou as cartas");
  check(ended.deck[0].kind === "vp", "estado final não revelou o baralho");
  check(ended.players.every((player) => !("sessionTokenHash" in player)), "hash de sessão exposto no estado final");

  if (failures.length) {
    console.error("Falhas nas vistas privadas do estado:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log("Vistas do estado verificadas: mãos, baralho, tokens e mapa oculto filtrados por jogador.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
