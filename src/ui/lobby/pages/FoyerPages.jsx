/*
   Fachada das páginas do foyer.

   O Book v2 deixou de concentrar as quatro spreads de entrada num único ficheiro.
   Cada tarefa principal vive agora no seu módulo; esta fachada preserva o ponto
   de import estável usado pelo LobbyCodex.
*/
export { default as HomePage } from "./foyer/HomePage.jsx";
export { default as ModePage } from "./foyer/ModePage.jsx";
export { default as JoinPage } from "./foyer/JoinPage.jsx";
export { default as SavedRealmsPage } from "./foyer/SavedRealmsPage.jsx";
