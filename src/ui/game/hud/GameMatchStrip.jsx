import "../../../styles/game-match-strip.css";

function Dice({ values, animationKey }) {
  if (!values?.length) return <div className="rd-match-strip__dice is-empty" aria-label="Dados ainda não lançados"><span>–</span><span>–</span></div>;
  return (
    <div className="rd-match-strip__dice" key={animationKey} aria-label={`Dados: ${values.join(" e ")}`}>
      {values.map((value, index) => <span key={`${index}-${value}`}>{value}</span>)}
    </div>
  );
}

export default function GameMatchStrip({ code, round, dice, diceAnimationKey }) {
  return (
    <section className="rd-match-strip" aria-label="Reino e dados">
      <div className="rd-match-strip__realm">
        <small>REINO</small>
        <strong>{code}</strong>
        <span>R{round}</span>
      </div>
      <Dice values={dice} animationKey={diceAnimationKey} />
    </section>
  );
}
