const fs = require("node:fs");
const assert = require("node:assert");

const config = fs.readFileSync("src/multiplayer/config.js", "utf8");
const envExample = fs.readFileSync(".env.example", "utf8");

assert(!config.includes("openrelayproject"), "Credenciais TURN públicas não podem permanecer no bundle.");
assert(config.includes("VITE_ICE_SERVERS_JSON"), "A configuração ICE deve vir do ambiente.");
assert(config.includes("VITE_PEER_HOST"), "O signaling PeerJS deve ser configurável por ambiente.");
assert(config.includes("createPeerConfig"), "A configuração deve ser construída e validada centralmente.");
assert(envExample.includes("VITE_PEER_HOST"), "Falta documentar o host PeerJS.");
assert(envExample.includes("VITE_ICE_SERVERS_JSON"), "Falta documentar os servidores ICE.");
assert(config.includes("VITE_REQUIRE_TURN"), "Falta a guarda opcional que impede deploy STUN-only.");
assert(envExample.includes("VITE_REQUIRE_TURN=true"), "Falta documentar a guarda de TURN para produção.");
console.log("Environment/network configuration verified.");
