import GameIcon from "../assets/GameIcon.jsx";
import DevelopmentCard from "../game/DevelopmentCard.jsx";
import ImportantEventBanner from "../game/ImportantEventBanner.jsx";
import ChronicleLog from "../game/ChronicleLog.jsx";
import { GameHud, GameEconomyStrip, GameUtilityRail } from "../game/hud/index.js";
import GameActionPanel from "../game/GameActionPanel.jsx";
import EndgameExperience from "../game/endgame/EndgameExperience.jsx";
import { ACTION_PRESENTATION } from "../game/gameUiComposition.js";
import { BUILD_COSTS, RESOURCE_DEFINITIONS, RESOURCE_KEYS } from "../../game/resources.js";
import { GAME_UI_EMPHASIS, GAME_UI_MATERIALS, GAME_UI_MOTION_MS, GAME_UI_RULES, GAME_VISUAL_LANGUAGE_VERSION } from "../theme/gameVisualLanguage.js";
import { GameButton, GameHeading, GameIconButton, GameSurface } from "../system/index.js";
import "../../styles/ui-lab.css";

const MATERIALS = [
  {
    material: GAME_UI_MATERIALS.parchment,
    eyebrow: "CONTEÚDO NARRATIVO",
    title: "Pergaminho",
    copy: "Regras, histórico legível, detalhes e decisões que pertencem ao mundo físico do jogo.",
  },
  {
    material: GAME_UI_MATERIALS.oak,
    eyebrow: "ESTRUTURA PERSISTENTE",
    title: "Madeira e bronze",
    copy: "HUD, barras de ferramentas e estruturas que permanecem sobre o tabuleiro sem competir com ele.",
  },
  {
    material: GAME_UI_MATERIALS.inset,
    eyebrow: "DADOS COMPACTOS",
    title: "Rebaixo",
    copy: "Recursos, estados, contadores e grupos de informação dentro de uma estrutura maior.",
  },
  {
    material: GAME_UI_MATERIALS.bronze,
    eyebrow: "AÇÃO / ÊNFASE",
    title: "Bronze",
    copy: "Pequenas peças estruturais e acentos de ação. Não deve transformar painéis inteiros em metal brilhante.",
  },
];


const CARD_SAMPLES = Object.freeze([
  Object.freeze({ label: "Makuru · Catapulta", characterId: "makuru", card: Object.freeze({ kind: "tropa", sub: "catapulta" }) }),
  Object.freeze({ label: "Vlad · Catapulta", characterId: "vlad", card: Object.freeze({ kind: "tropa", sub: "catapulta" }) }),
  Object.freeze({ label: "Ponto de Vitória", characterId: "maria", card: Object.freeze({ kind: "vp", sub: "🍀 Sorte" }) }),
  Object.freeze({ label: "Monopólio", characterId: "muriel", card: Object.freeze({ kind: "monopolio" }) }),
  Object.freeze({ label: "Trabalhadores", characterId: "romeo", card: Object.freeze({ kind: "descoberta" }) }),
  Object.freeze({ label: "Arte pendente", characterId: "protheus", card: Object.freeze({ kind: "marcha" }) }),
]);


const EVENT_SAMPLES = Object.freeze([
  Object.freeze({
    kind: "dragon", tone: "dragon", artKey: "dragonSeven", eyebrow: "O SETE FOI LANÇADO",
    title: "O Dragão Desperta!", text: "O rugido atravessa o reino. O Dragão será guiado antes de a partida continuar.", details: [],
  }),
  Object.freeze({
    kind: "disaster", tone: "disaster-peste", artKey: "disasterPlague", eyebrow: "PRESSÁGIO DO 12",
    title: "Peste Negra", text: "A quarentena cai sobre os reinos desprotegidos.", details: ["As tropas afetadas ficam em quarentena durante 2 turnos."],
  }),
  Object.freeze({
    kind: "award", tone: "award-road", artKey: "awardLongestRoad", eyebrow: "NOVO TÍTULO DO REINO",
    title: "A Estrada Mais Longa", text: "Princesa Maria domina agora os caminhos do reino.", metric: "7 troços · +2 PV", details: [], signature: "Princesa Maria",
  }),
]);


const ACTION_SAMPLE_MODEL = Object.freeze({
  phase: "actions",
  roll: null,
  groups: Object.freeze([
    Object.freeze({
      id: "construction", label: "Construir", actions: Object.freeze([
        Object.freeze({ id: "road", label: "Estrada", icon: "RDD_Road", enabled: true, active: true, cost: Object.freeze({ madeira: 1, tijolo: 1 }), badge: null, meta: "Selecionada", tone: "standard" }),
        Object.freeze({ id: "village", label: "Aldeia", icon: "RDD_Village", enabled: false, active: false, cost: Object.freeze({ madeira: 1, tijolo: 1, cavalos: 1, ouro: 1 }), badge: null, meta: null, reason: "Falta 1 Ouro.", tone: "standard" }),
        Object.freeze({ id: "palace", label: "Palácio", icon: "RDD_Palace", enabled: true, active: false, cost: Object.freeze({ cavalos: 2, ouro: 3 }), badge: null, meta: null, tone: "standard" }),
      ]),
    }),
    Object.freeze({
      id: "realm", label: "Reino", actions: Object.freeze([
        Object.freeze({ id: "card", label: "Carta", icon: "RDD_DevelopmentCard", enabled: true, active: false, cost: Object.freeze({ cavalos: 1, ouro: 1, obsidiana: 1 }), badge: null, meta: "17 no baralho", tone: "standard" }),
        Object.freeze({ id: "bank", label: "Banco", icon: "RDD_Bank", enabled: true, active: false, cost: null, badge: null, meta: "Troca com o reino", tone: "standard" }),
        Object.freeze({ id: "trade", label: "Trocar", icon: "RDD_Trade", enabled: true, active: false, cost: null, badge: null, meta: "Negociar com jogadores", tone: "standard" }),
      ]),
    }),
  ]),
  endTurn: Object.freeze({ id: "end", label: "Terminar Turno", icon: "I_Clock", enabled: true, active: false, cost: null, badge: null, meta: null, tone: "danger" }),
});

const CHRONICLE_SAMPLE_GAME = Object.freeze({
  players: Object.freeze([
    Object.freeze({ ch: "maria" }),
    Object.freeze({ ch: "vlad" }),
  ]),
});

const CHRONICLE_SAMPLE_ENTRIES = Object.freeze([
  Object.freeze({ id: 4, msg: "🛤️ Princesa Maria reclama a Estrada Mais Longa (+2 PV)!", pi: 0, kind: "event", emphasis: "ceremonial" }),
  Object.freeze({ id: 3, msg: "🤝 Vlad Drácula aceitou a troca de Princesa Maria.", pi: 1, kind: "trade", emphasis: "ambient" }),
  Object.freeze({ id: 2, msg: "🐉 O Dragão de Fogo desperta! Princesa Maria vai guiá-lo.", pi: 0, kind: "event", emphasis: "ceremonial" }),
  Object.freeze({ id: 1, msg: "🎲 Vlad Drácula lançou 8 (5+3)", pi: 1, kind: "realm", emphasis: "ambient" }),
]);


const SOCIAL_SAMPLE_GAME = Object.freeze({
  players: Object.freeze([Object.freeze({ ch: "maria" }), Object.freeze({ ch: "vlad" })]),
});
const SOCIAL_SAMPLE_CHAT = Object.freeze([
  Object.freeze({ id: "lab-chat-1", i: 0, tx: "O porto do norte fica comigo." }),
  Object.freeze({ id: "lab-chat-2", i: 1, tx: "Só se conseguires pagar o preço." }),
]);
const ENDGAME_SAMPLE_MODEL = Object.freeze({
  round: 11, warMode: false,
  winner: Object.freeze({ playerIndex: 0, characterId: "maria", name: "Princesa Maria", shortName: "Maria", title: "A Luz do Reino", quote: "Pelo reino e pela luz!", victoryPoints: 10 }),
  standings: Object.freeze([
    Object.freeze({ playerIndex:0,characterId:"maria",shortName:"Maria",isLocal:true,villages:3,palaces:2,roads:8,longestRoadLength:7,hasLongestRoad:true,troops:4,hasLargestArmy:false,victoryCards:1,hand:5,immune:true,victoryPoints:10 }),
    Object.freeze({ playerIndex:1,characterId:"vlad",shortName:"Drácula",isLocal:false,villages:2,palaces:2,roads:5,longestRoadLength:4,hasLongestRoad:false,troops:6,hasLargestArmy:true,victoryCards:0,hand:7,immune:false,victoryPoints:8 }),
  ]),
  dice: Object.freeze({ total:37,sevens:5,disasters:3,rolls:Object.freeze({2:1,3:2,4:3,5:4,6:5,7:5,8:5,9:4,10:3,11:3,12:2}) }),
  metrics: Object.freeze({ produced:Object.freeze([24,18]),dragonBlocked:Object.freeze([5,9]),robbedFrom:Object.freeze([2,4]),dragonMoves:Object.freeze([3,2]),robbedBy:Object.freeze([4,2]),blessings:Object.freeze([0,0]),portTrades:Object.freeze([6,3]),p2pTrades:Object.freeze([4,5]),devBought:Object.freeze([5,4]) }),
});

const HIERARCHY = [
  {
    level: "Persistente",
    emphasis: GAME_UI_EMPHASIS.ambient,
    title: "Informação sempre disponível",
    copy: "Jogadores, turno, recursos e atalhos. Alta legibilidade, contraste controlado, animação mínima.",
  },
  {
    level: "Contextual",
    emphasis: GAME_UI_EMPHASIS.interactive,
    title: "Uma decisão pede atenção",
    copy: "Construir, trocar, consultar detalhes, abrir recursos ou mapa. Pode ganhar pergaminho e mais ornamentação.",
  },
  {
    level: "Importante",
    emphasis: GAME_UI_EMPHASIS.important,
    title: "O estado da partida mudou",
    copy: "Eventos raros, alertas e conquistas. Pode interromper a atenção durante alguns segundos.",
  },
  {
    level: "Cerimonial",
    emphasis: GAME_UI_EMPHASIS.ceremonial,
    title: "Um momento que merece memória",
    copy: "Vitória, grande prémio, mudança histórica. Lettering especial, selo e animação são permitidos aqui.",
  },
];

function LabIcon({ name, size = 25 }) {
  return <GameIcon name={name} size={size} />;
}

function TypographySpecimen({ role, label, className, children, note }) {
  return (
    <article className="visual-specimen">
      <small>{role}</small>
      <div className={className}>{children}</div>
      <p><b>{label}</b>{note ? ` · ${note}` : ""}</p>
    </article>
  );
}

function MaterialSample({ material, eyebrow, title, copy }) {
  return (
    <GameSurface material={material} className="visual-material">
      <span className="rd-ui-label">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </GameSurface>
  );
}

function HierarchySample({ level, emphasis, title, copy }) {
  return (
    <GameSurface material={emphasis === GAME_UI_EMPHASIS.ceremonial ? "parchment-raised" : "oak"} emphasis={emphasis} className="visual-hierarchy-card">
      <small>{level}</small>
      <strong>{title}</strong>
      <p>{copy}</p>
    </GameSurface>
  );
}

function ControlSamples() {
  return (
    <div className="visual-control-board">
      <div className="visual-buttons">
        <GameButton variant="primary" eyebrow="Ação principal" icon={<LabIcon name="W_Sword001" size={24} />}>Lançar dados</GameButton>
        <GameButton variant="secondary" eyebrow="Consulta" icon={<LabIcon name="I_Book" size={23} />}>Abrir grimório</GameButton>
        <GameButton variant="quiet" eyebrow="Baixa prioridade" icon={<LabIcon name="I_Map" size={22} />}>Ver mapa</GameButton>
        <GameButton variant="danger" eyebrow="Irreversível" icon={<LabIcon name="S_Fire01" size={22} />}>Abandonar reino</GameButton>
        <GameButton variant="secondary" disabled eyebrow="Indisponível" icon={<LabIcon name="I_Key01" size={22} />}>Bloqueado</GameButton>
      </div>
      <GameSurface material="oak" className="visual-toolbar" aria-label="Exemplo estrutural de controlos compactos">
        <GameIconButton icon={<LabIcon name="I_Map" />} label="Mapa" />
        <GameIconButton icon={<LabIcon name="I_GoldCoin" />} label="Recursos" badge="8" />
        <GameIconButton icon={<LabIcon name="I_Book" />} label="Grimório" active />
        <GameIconButton icon={<LabIcon name="I_Scroll" />} label="Histórico" badge="3" />
        <GameIconButton icon={<LabIcon name="I_Scroll02" />} label="Opções" />
      </GameSurface>
    </div>
  );
}



function HudSample() {
  return (
    <GameHud
      code="QFJXRM"
      round={4}
      dice={[5, 3]}
      diceAnimationKey="lab-dice"
      status="A tua vez — escolhe uma ação ou consulta o reino."
      resourceCount={8}
      cardCount={3}
      logCount={12}
      activeUtility="grimoire"
      onToggleMap={() => {}}
      onOpenUtility={() => {}}
      embedded
    />
  );
}

function ActionSystemSample() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <GameActionPanel model={ACTION_SAMPLE_MODEL} presentation={{ mode: ACTION_PRESENTATION.FULL }} onAction={() => {}} embedded />
      <GameEconomyStrip resources={{ madeira: 4, tijolo: 3, cavalos: 2, ouro: 5, obsidiana: 1 }} resourceDefinitions={RESOURCE_DEFINITIONS} resourceKeys={RESOURCE_KEYS} costs={BUILD_COSTS} cardCount={3} onOpenCards={() => {}} costsOpen embedded />
    </div>
  );
}

function CardSamples() {
  return (
    <div className="visual-card-gallery">
      {CARD_SAMPLES.map((sample) => (
        <article key={sample.label} className="visual-card-sample">
          <div><DevelopmentCard card={sample.card} characterId={sample.characterId} /></div>
          <small>{sample.label}</small>
        </article>
      ))}
    </div>
  );
}

function EventSamples() {
  return (
    <div className="visual-event-gallery">
      {EVENT_SAMPLES.map((model) => <ImportantEventBanner key={model.title} model={model} embedded />)}
    </div>
  );
}

function ChronicleSample() {
  return <ChronicleLog game={CHRONICLE_SAMPLE_GAME} entries={CHRONICLE_SAMPLE_ENTRIES} embedded />;
}

function SocialSample() { return <GameUtilityRail game={SOCIAL_SAMPLE_GAME} chat={SOCIAL_SAMPLE_CHAT} sendChat={() => true} sendEmote={() => true} onOpenUtility={() => {}} embedded />; }
function EndgameSample() { return <EndgameExperience model={ENDGAME_SAMPLE_MODEL} onExit={() => {}} embedded />; }

function NarrativeSample() {
  return (
    <div className="visual-narrative-grid">
      <GameSurface material="parchment-raised" className="visual-folio">
        <span className="rd-ui-label">CRÓNICA DO REINO</span>
        <h3>A estrada atravessa o vale</h3>
        <p className="rd-ui-copy">O texto longo mantém contraste de tinta sobre papel; Fondamento dá a voz manuscrita do jogo, enquanto Cinzel fica responsável pela informação compacta.</p>
        <p className="rd-ui-hand">“As pedras ainda guardam o calor da marcha.”</p>
        <div className="visual-signature"><span>confirmado por</span><b className="rd-ui-signature">Artheria</b></div>
      </GameSurface>
      <GameSurface material="oak" className="visual-hud-density">
        <span className="rd-ui-label">DENSIDADE DE HUD</span>
        <h3>Estrutura escura, conteúdo legível</h3>
        <div className="visual-stat-row">
          <span><LabIcon name="I_GoldCoin" size={22} /><b>8</b><small>Recursos</small></span>
          <span><LabIcon name="I_Book" size={22} /><b>3</b><small>Cartas</small></span>
          <span><LabIcon name="A_Shoes02" size={22} /><b>6</b><small>Estrada</small></span>
        </div>
        <p>O HUD não tenta parecer uma página de pergaminho inteira. A fantasia vem dos materiais, lettering, ícones e ritmo visual.</p>
      </GameSurface>
    </div>
  );
}

export default function UILab() {
  return (
    <main className="ui-lab">
      <header className="ui-lab__hero">
        <div>
          <small>FERRAMENTA INTERNA · SISTEMA VISUAL V{GAME_VISUAL_LANGUAGE_VERSION}</small>
          <h1>Reinos do Dragão</h1>
          <p>Linguagem visual canónica do jogo. O lobby deixa de ser uma referência informal e passa a partilhar os mesmos papéis tipográficos, materiais e regras com toda a UI in-game.</p>
        </div>
        <nav aria-label="Navegação de desenvolvimento">
          <a href={import.meta.env.BASE_URL}>Abrir jogo</a>
          <a href={`${import.meta.env.BASE_URL}?dev=assets`}>Galeria de assets</a>
        </nav>
      </header>

      <section className="ui-lab__section">
        <GameHeading eyebrow="01 · Direção" title="Um único mundo visual" description="Pergaminho e tinta para narrativa; madeira escura e bronze para estrutura; cor da casa apenas para identidade. O jogo pode ter mais UI do que o lobby sem parecer um software colocado por cima dele." />
        <div className="visual-rule-grid">
          {GAME_UI_RULES.map((rule, index) => <article key={rule}><b>{String(index + 1).padStart(2, "0")}</b><p>{rule}</p></article>)}
        </div>
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="02 · Lettering" title="Cada fonte tem um trabalho" description="A identidade vem da combinação e da disciplina. Fontes expressivas ficam reservadas a situações onde não prejudicam leitura ou densidade." />
        <div className="visual-type-grid">
          <TypographySpecimen role="DISPLAY" label="IM Fell English SC" className="visual-type-display">A Crónica do Dragão</TypographySpecimen>
          <TypographySpecimen role="LABEL / CONTROL" label="Cinzel" className="visual-type-label">MAIOR EXÉRCITO</TypographySpecimen>
          <TypographySpecimen role="BODY / HANDWRITTEN" label="Fondamento" note="texto, crónica e notas" className="visual-type-body">O reino recebe madeira e ouro. Encontrado junto às muralhas do norte.</TypographySpecimen>
          <TypographySpecimen role="SIGNATURE" label="Mrs Saint Delafield" className="rd-ui-signature">Princesa Maria</TypographySpecimen>
          <TypographySpecimen role="CEREMONIAL" label="UnifrakturCook" className="rd-ui-blackletter visual-type-blackletter">Vitória</TypographySpecimen>
          <TypographySpecimen role="TECHNICAL ONLY" label="VT323" note="códigos e diagnóstico" className="rd-ui-technical visual-type-technical">REINO QFJXRM · 0.99.x</TypographySpecimen>
        </div>
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="03 · Materiais" title="Objetos, não caixas genéricas" description="As superfícies são papéis funcionais. Um novo componente escolhe um material existente antes de inventar uma nova moldura." />
        <div className="visual-material-grid">{MATERIALS.map((material) => <MaterialSample key={material.material} {...material} />)}</div>
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="04 · Hierarquia" title="Nem tudo merece o mesmo volume" description="A UI persistente é silenciosa; uma decisão aproxima-se do jogador; um evento importante pode interromper; um momento cerimonial pode ser teatral." />
        <div className="visual-hierarchy-grid">{HIERARCHY.map((item) => <HierarchySample key={item.level} {...item} />)}</div>
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="05 · Controlos" title="Uma família para HUD, mapa e ações" description="Estes são primitives estruturais, não o desenho final de cada botão. Estados, foco, prioridade e densidade ficam resolvidos uma vez." />
        <ControlSamples />
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="06 · Narrativa + densidade" title="Fantasia sem sacrificar informação" description="O jogo precisa simultaneamente de superfícies evocativas e de um HUD compacto. A coerência vem de ambos obedecerem ao mesmo sistema." />
        <NarrativeSample />
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="07 · Cartas de Desenvolvimento" title="Um objeto próprio dentro do mesmo mundo" description="As cartas têm moldura, composição e arte próprias. Herdam apenas tipografia canónica, motion e regras de interação; não são um painel genérico disfarçado de carta." />
        <CardSamples />
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="08 · Acontecimentos" title="O jogo marca os momentos que mudam a partida" description="Dragão, desastres e prémios usam uma única família cerimonial com pixel art grande. As Crónicas guardam a memória persistente do que aconteceu sem competir com o tabuleiro." />
        <EventSamples />
        <ChronicleSample />
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="09 · HUD" title="O tabuleiro continua a ser o protagonista" description="O HUD persistente usa madeira escura, bronze e ícones do mesmo pack dos banners. Ferramentas ficam num único dock; conteúdo detalhado abre apenas quando pedido." />
        <HudSample />
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="10 · Ações" title="Uma linguagem única para cada turno" description="Construção, economia e ações de modo usam o mesmo componente. Custos, seleção e motivos de bloqueio pertencem ao modelo da ação e não ao JSX do botão." />
        <ActionSystemSample />
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="11 · Social" title="Conversa presente, nunca dominante" description="Chat e reações vivem numa camada compacta sobre o tabuleiro. Ao abrir, o conteúdo ganha pergaminho; fechado, reduz-se a dois controlos discretos." />
        <SocialSample />
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="12 · Fim da partida" title="A vitória é um momento cerimonial" description="Retrato, assinatura, placar e crónicas finais usam uma composição própria. O jogador pode recolher o painel e observar o mapa final sem abandonar os resultados." />
        <EndgameSample />
      </section>

      <section className="ui-lab__section">
        <GameHeading eyebrow="13 · Movimento" title="Animação com causa" description="Pressão e hover são rápidos; reveals contextuais têm mais tempo; animação cerimonial é rara. prefers-reduced-motion reduz a duração estrutural para praticamente zero." />
        <GameSurface material="inset" className="visual-motion-row">
          {Object.entries(GAME_UI_MOTION_MS).map(([name, ms]) => <span key={name}><small>{name}</small><strong>{ms} ms</strong></span>)}
        </GameSurface>
      </section>

      <footer className="ui-lab__footer">
        <strong>Contrato visual v{GAME_VISUAL_LANGUAGE_VERSION}</strong>
        <p>As Cartas de Desenvolvimento já usam o seu sistema próprio. Cartas, Crónicas, acontecimentos, HUD, Action System, Social e Endgame já são componentes concretos construídos sobre a mesma linguagem. O laboratório deixa de comparar estilos alternativos e passa a validar a linguagem oficial.</p>
      </footer>
    </main>
  );
}
