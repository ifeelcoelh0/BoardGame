/*
   Pequenos contratos visuais da seleção de Casa.

   Mantemos estes valores fora da cena Three.js para a affordance ficar explícita
   e testável sem depender de WebGL. Confirmar deve ser praticamente inevitável:
   com o pergaminho aberto, quase toda a folha reage ao clique e sela a Casa.
   Fechar/voltar continua disponível, mas num alvo muito menor no canto superior.
*/

export const SIGNATURE_CONFIRM_HIT_AREA = Object.freeze({
  x: 0,
  y: 0,
  width: 1.78,
  height: 2.28,
});

export const SIGNATURE_CANCEL_HIT_AREA = Object.freeze({
  x: 0.73,
  y: 1.11,
  width: 0.2,
  height: 0.2,
});

/* Mantido só como contrato estável; nesta afinação já não há assinatura-fantasma
   no hover. */
export const SIGNATURE_HOVER = Object.freeze({
  fadeSpeed: 0,
  ghostMaxAlpha: 0,
});

export const SELECTION_GUIDE_STEPS = Object.freeze([
  Object.freeze({ id: "portrait", label: "ESCOLHE" }),
  Object.freeze({ id: "scroll", label: "ABRE" }),
  Object.freeze({ id: "signature", label: "ASSINA" }),
]);
