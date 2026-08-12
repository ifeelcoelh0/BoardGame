const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('src/app/App.jsx');
const session = read('src/app/useRealmSession.js');
const experience = read('src/ui/lobby/LobbyExperience.jsx');
const homePage = read('src/ui/lobby/pages/foyer/HomePage.jsx');
const modePage = read('src/ui/lobby/pages/foyer/ModePage.jsx');
const joinPage = read('src/ui/lobby/pages/foyer/JoinPage.jsx');
const failures = [];
const need = (source, token, label) => { if (!source.includes(token)) failures.push(`falta ${label}: ${token}`); };
const reject = (source, token, label) => { if (source.includes(token)) failures.push(`${label}: ${token}`); };

need(homePage, 'data-testid="create-realm"', 'botão de fundar reino');
need(homePage, 'data-testid="join-realm"', 'botão de entrar com código');
need(joinPage, 'data-testid="join-submit"', 'submissão do código');
need(modePage, 'foyer.onCreate(selectedMode.id)', 'a confirmação do modo chama o criador do reino');
need(modePage, 'data-testid="create-realm-submit"', 'botão de confirmação do modo');
need(joinPage, 'onClick={foyer.onJoin}', 'a página de código chama a entrada');

need(app, 'const foyer = {', 'pacote de dados do foyer');
need(app, 'session.createRealm(selectedMode)', 'ligação do foyer à sessão');
reject(app, 'entryContent =', 'App ainda constrói marcação do livro');

need(session, 'navigate(APP_STAGE.CHARACTER_SELECTION)', 'entrada na selecção de personagem');
need(session, 'startHostTransport(g, requestId)', 'arranque do transporte do anfitrião');
const createIndex = session.indexOf('const createRealm = async');
const charIndex = session.indexOf('navigate(APP_STAGE.CHARACTER_SELECTION)', createIndex);
const transportIndex = session.indexOf('startHostTransport(g, requestId)', createIndex);
if (createIndex < 0 || charIndex < 0 || transportIndex < 0 || charIndex > transportIndex) {
  failures.push('a selecção local tem de ser instalada antes do arranque do transporte');
}

need(app, 'isSelectingCharacter={stage === APP_STAGE.CHARACTER_SELECTION}', 'selecção derivada do stage');
need(app, 'onCharacterSelectionExit={() => navigate(APP_STAGE.LOBBY)}', 'saída da selecção');
reject(app, 'setCharacterSelectionIntent', 'terceira fonte de verdade da selecção');
reject(session, 'setCharacterSelectionIntent', 'terceira fonte de verdade da selecção');

need(experience, '<LobbyScene', 'cena única');
need(experience, '<DragonLobby', 'overlays do lobby');
for (const obsolete of ['showEntryFlow', 'swapUi', 'LobbyEntryShell']) {
  reject(app, obsolete, 'ponte de estado obsoleta');
  reject(session, obsolete, 'ponte de estado obsoleta');
}

if (failures.length) {
  console.error('Book-to-character flow check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Book-to-character flow OK: fundar e entrar levam à parede das casas, e sair de lá é sempre possível.');
