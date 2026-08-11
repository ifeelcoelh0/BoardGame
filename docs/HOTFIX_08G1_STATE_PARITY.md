# Parte 08G.1 — Paridade de vistas e robustez do protocolo

## Névoa

A vista filtrada deixou de representar um terreno desconhecido como `deserto`. O valor `oculto` é um sentinela visual e nunca participa nas regras de terreno baldio. O teste de regressão compara as estradas legais do estado canónico com as da vista pública.

## Deduplicação

O host conserva apenas resultados aceites e compactos durante 60 segundos. Rejeições não entram no cache e nenhum snapshot completo é guardado. Isto preserva o ACK de uma ação válida durante a janela de retry, mesmo perante muitas ações inválidas.

## Sincronização

Uma rejeição `STALE_STATE` contém a revisão oficial e `syncRequired: true`. O cliente envia `state-request`; o host responde com a vista privada filtrada para aquela ligação.

## Trocas e presença

Jogadores desligados não podem receber novas propostas. Numa proposta global são considerados recusados. Se um proponente ou destinatário perder a ligação, a proposta é cancelada ou atualizada sem ficar aberta indefinidamente.

## Ações pendentes

Cliques repetidos na mesma categoria de ação reutilizam a Promise já pendente e mostram uma indicação imediata, em vez de falharem silenciosamente.
