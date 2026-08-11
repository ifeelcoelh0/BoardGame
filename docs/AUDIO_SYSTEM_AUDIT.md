# Reinos do Dragão — auditoria sonora e backlog canónico
Base: v0.99.28

## Princípio
O jogo não precisa de um som diferente para cada botão ou frase. A linguagem sonora deve ter um conjunto pequeno de famílias reconhecíveis e reservar sons longos/cerimoniais para acontecimentos importantes.

A v0.99.27 separa **evento semântico** de **ficheiro de áudio**. Assim podemos trocar um asset sem voltar a mexer nas regras ou procurar texto nas Crónicas.

## Inventário atual

O pacote contém 260 ficheiros `.m4a`:
- 176 vozes/eventos específicos das oito personagens;
- 6 ficheiros dedicados às cartas de tropa;
- 78 ficheiros na raiz de áudio, incluindo música, ambiente, SFX e vozes antigas/fallback.

### Assets atuais que já têm uma função clara

| Uso | Asset atual | Decisão |
|---|---|---|
| Música principal | `main-theme.m4a` | MANTER |
| Lareira do lobby | `lobby-fireplace.m4a` | MANTER |
| Dados — agitar | `diceShake-1/2/3.m4a` | MANTER |
| Dados — lançar | `diceThrow.m4a` | MANTER |
| Construção | `buildHit.m4a` | MANTER por agora |
| Carta / deslizar carta | `cardSlide.m4a` | MANTER por agora |
| Moedas | `coinDrop.m4a` | MANTER |
| Dragão — rugido | `dragonRoar.m4a` | MANTER |
| Dragão — asas | `dragonFlap.m4a` | MANTER |
| Roubo/movimento rápido | `swoop.m4a` | REUTILIZAR |
| Tsunami | `disaster-tsunami.m4a` | MANTER |
| Vitória | `fanfareWin.m4a` | MANTER por agora |
| Prémios | `harp.m4a` | MANTER por agora |
| Início da partida | `lobby-start-medieval.m4a` | MANTER |
| Assinatura | `lobby-signature.m4a` | MANTER |
| Folhear/abrir códice | `lobby-book-page.m4a` | MANTER / rever duração |
| Combate de espada | `swordHit.m4a` | MANTER |
| Arqueiro | `arrowHit.m4a` | MANTER |
| Catapulta | `catCreak.m4a` | MANTER |
| Carta Cavaleiro | cavalo + 3 golpes ordenados | MANTER |
| Carta Arqueiro | `troops/archer-card.m4a` | MANTER |
| Carta Catapulta | `troops/catapult-card.m4a` | MANTER |
| Vozes de eventos das 8 Casas | `voices/<casa>/...` | MANTER |
| Vozes das reações | `voices/<casa>/<casa>_emote_*` | MANTER |

## Sons atuais que devem ser ouvidos antes de decidir se ficam

| Uso | Estado atual | Questão |
|---|---|---|
| Clique UI | `ui-click.m4a` (novo) | FECHADO — clique universal da aplicação |
| Abrir/virar/fechar códice | um único `lobby-book-page.m4a` (2.0 s) | Convém separar abrir/folhear/fechar? |
| Banco/troca aceite | efeito procedural `deal` + moedas | Pode ser suficiente ou merece SFX dedicado |
| Erro/recusa | efeito procedural `bad` | Avaliar se combina com a identidade medieval |
| Desastre genérico | efeito procedural `disaster` | fica apenas como fallback; os 4 desastres atuais têm asset dedicado |
| Ocupação militar | `horn` procedural | Avaliar; provável candidato a gravação dedicada |
| Libertação | `bell` procedural | Avaliar |
| Marcha / começo da era | `march` procedural | Avaliar |
| Chat recebido | `chatpop` procedural | Pode ficar se for discreto |

## Sons novos prioritários

Estes são os que eu geraria/procuraria primeiro, porque representam ações muito frequentes ou acontecimentos importantes sem identidade sonora própria.

| Prioridade | Som a criar | Direção sugerida |
|---|---|---|
| FECHADO | **Clique UI universal** | `ui-click.m4a` |
| P0 | **Confirmar / Pronto** | pequeno selo metálico/mágico, positivo e curto |
| FECHADO | **Turno do jogador** | `turn-notification.m4a` |
| FECHADO | **Ganância** | `disaster-greed.m4a` |
| FECHADO | **Peste Negra** | `disaster-plague.m4a` |
| FECHADO | **Tributo Real** | `disaster-tribute.m4a` |
| FECHADO | **Proposta de troca** | `trade-offer.m4a` |
| P1 | **Troca concluída** | troca de moedas/selos, positivo, <1 s |
| P1 | **Decisão obrigatória** | aviso medieval discreto, não alarmante |
| P1 | **Fim de turno** | madeira/pergaminho ou pequeno sino, muito curto |
| P1 | **Revelar território** (Exploração) | vento + descoberta/brilho curto |
| P1 | **Carruagem em movimento** | roda/eixo de madeira curto |
| P1 | **Troll Gigante — despertar** | rugido/passo pesado dedicado |
| P1 | **Troll — pisada/ataque** | impacto grave curto |
| P2 | **Abrir códice** dedicado | capa/papel mais pesado |
| P2 | **Folhear códice** dedicado | folha seca curta, ~0.3–0.6 s |
| P2 | **Fechar códice** dedicado | capa de couro/madeira, ~0.5–0.9 s |
| P2 | **Copiar código** | confirmação muito leve; pode reutilizar Confirmar |

## Sons que NÃO recomendo criar individualmente

Para evitar um jogo barulhento e uma biblioteca impossível de manter:
- um som diferente para cada recurso;
- um som diferente para cada botão do HUD;
- um som para abrir cada modal;
- um som para cada linha das Crónicas;
- um som diferente por estrada/aldeia/palácio se `buildHit` continuar a funcionar bem;
- sons próprios para Aceitar/Cancelar/Fechar se o clique universal + Confirmar/Erro cobrirem bem essas ações.

## Política de simultaneidade da v0.99.27

- Crónicas já não são interpretadas por texto para decidir SFX.
- Um snapshot atrasado não agenda uma fila de sons históricos.
- Cues com timestamp antigo são descartados.
- Efeitos repetidos têm cooldown por categoria.
- Vozes pertencem a um canal exclusivo: uma nova voz substitui a anterior em vez de duas personagens falarem por cima uma da outra.
- Pedidos de samples que demorem demasiado a descarregar/descodificar expiram e não tocam segundos depois fora de contexto.
- Sequências das cartas de tropa têm token próprio; uma nova sequência invalida a anterior.

## Próxima sessão de escolha de assets

Pendentes prioritários depois do primeiro pack:
1. **Confirmar / Pronto**;
2. **Troca concluída**;
3. **Decisão obrigatória / atenção**;
4. **Fim de turno**;
5. ouvir `lobby-book-page.m4a`, `deal`, `bad`, `horn`, `bell`, `march` e `chatpop` antes de decidir substituições adicionais.
