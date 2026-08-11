# Parte 8G — núcleo do modo Guerra

Esta fase retira do componente legacy as regras que decidem recrutamento, destaque, movimento e combate das tropas.

## Novo módulo

`src/game/warReducer.js` contém regras puras para:

- custos de Cavaleiro, Catapulta e Arqueiro;
- modificadores de Vlad e Bones;
- hexágonos válidos de destaque;
- alvos válidos e relação pedra-papel-tesoura das tropas;
- alcance especial de Artheria;
- movimento gratuito de Makuru;
- movimento adicional de Protheus;
- ressurreição de Bones;
- combate entre jogadores;
- ataque ao Troll Gigante e saqueadores;
- libertação de construções quando o cerco deixa de ter catapultas suficientes;
- Suborno de Romeo.

Os reducers não escrevem logs, não reproduzem áudio e não criam overlays. Devolvem eventos semânticos que `presentWarActionEvent` transforma na apresentação existente.

## Ainda no legacy

Continuam temporariamente no componente:

- surgimento e movimento automático da horda;
- processamento de cercos no início do turno;
- despertar do Dragão de Gelo;
- geração das províncias do mapa de Guerra;
- cálculo visual dos prémios e da vitória;
- texto, áudio e animações.

## Correções defensivas

Trolls e o Gigante deixaram de ser alvos válidos para o poder Suborno. A interação antiga podia tentar resolver o nome de um jogador com índice `-9` e quebrar a ação.

## Testes

`tests/war-reducer.test.js` cobre custos, imutabilidade, destaque, poderes das Casas, combate, ressurreições, Troll, libertação de cercos e Suborno.
