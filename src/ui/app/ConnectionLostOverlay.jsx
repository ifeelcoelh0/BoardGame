export default function ConnectionLostOverlay({ isHost, onReconnect }) {
  return (
    <div className="disov" style={{ zIndex: 200 }} role="alertdialog" aria-modal="true" aria-labelledby="connection-lost-title">
      <div className="disbox">
        <div aria-hidden="true" style={{ fontSize: 54 }}>🔌</div>
        <h2 id="connection-lost-title" className="f-t" style={{ color: "#e0b23a", margin: "10px 0" }}>
          Ligação perdida
        </h2>
        <p style={{ fontSize: 14, marginBottom: 14 }}>
          {isHost
            ? "A rede falhou. Verifica a internet e volta a abrir o reino."
            : "Perdeste a ligação ao anfitrião. Confirma que ele tem o jogo aberto."}
        </p>
        <button className="btn gold" type="button" onClick={onReconnect}>Voltar a ligar</button>
      </div>
    </div>
  );
}
