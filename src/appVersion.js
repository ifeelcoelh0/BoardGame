/*
 * Versão funcional da aplicação.
 *
 * Esta é a única fonte de verdade usada em runtime. Build diagnostics, protocolo
 * e metadata de saves importam este valor em vez de manterem strings próprias.
 * package.json é metadata de distribuição; um teste garante que permanece
 * sincronizado com esta constante.
 */
export const APP_VERSION = "0.99.37";
