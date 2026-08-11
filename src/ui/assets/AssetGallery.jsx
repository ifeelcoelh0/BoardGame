import { useEffect, useMemo, useRef, useState } from "react";
import { CHARACTERS } from "../../assets/characterManifest.js";
import { ICON_CATEGORIES, RPG_ICONS } from "../../assets/iconManifest.js";
import { assetUrl } from "../../assets/assetUrl.js";
import CharacterSprite from "./CharacterSprite.jsx";
import GameIcon from "./GameIcon.jsx";
import "../../styles/asset-gallery.css";

const DIRECTIONS = [
  ["south", "Sul"],
  ["south-east", "Sudeste"],
  ["east", "Este"],
  ["north-east", "Nordeste"],
  ["north", "Norte"],
  ["north-west", "Noroeste"],
  ["west", "Oeste"],
  ["south-west", "Sudoeste"],
];

function matchesSearch(icon, search) {
  if (!search) return true;
  const haystack = `${icon.id} ${icon.file} ${icon.categoryLabel}`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

export default function AssetGallery() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("south");
  const [showAllDirections, setShowAllDirections] = useState(false);
  const [copied, setCopied] = useState("");
  const copyTimerRef = useRef(null);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
  }, []);

  const visibleIcons = useMemo(
    () =>
      RPG_ICONS.filter(
        (icon) =>
          (category === "all" || icon.category === category) &&
          matchesSearch(icon, search.trim()),
      ),
    [category, search],
  );

  async function copyIconId(iconId) {
    try {
      await navigator.clipboard.writeText(iconId);
      setCopied(iconId);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        copyTimerRef.current = null;
        setCopied("");
      }, 1400);
    } catch {
      setCopied("");
    }
  }

  return (
    <main className="asset-gallery">
      <header className="asset-gallery__header">
        <div>
          <p className="asset-gallery__eyebrow">Ferramenta interna de desenvolvimento</p>
          <h1>Galeria de assets</h1>
          <p>
            Esta página organiza os ficheiros recebidos. Não altera o visual do jogo nem
            aplica automaticamente molduras, ícones ou personagens à interface.
          </p>
        </div>
        <a className="asset-gallery__back" href={import.meta.env.BASE_URL}>
          Voltar ao jogo
        </a>
      </header>

      <section className="asset-gallery__section">
        <div className="asset-gallery__section-title">
          <div>
            <p className="asset-gallery__eyebrow">8 personagens · 64 imagens</p>
            <h2>Personagens</h2>
          </div>
          <div className="asset-gallery__character-controls">
            <label>
              Direção
              <select value={direction} onChange={(event) => setDirection(event.target.value)}>
                {DIRECTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="asset-gallery__check">
              <input
                type="checkbox"
                checked={showAllDirections}
                onChange={(event) => setShowAllDirections(event.target.checked)}
              />
              Mostrar as oito direções
            </label>
          </div>
        </div>

        <div className="asset-gallery__characters">
          {CHARACTERS.map((character) => (
            <article className="asset-character" key={character.id}>
              <div className="asset-character__identity">
                <CharacterSprite character={character} direction={direction} size={112} />
                <div>
                  <h3>{character.name}</h3>
                  <code>{character.id}</code>
                </div>
              </div>

              {showAllDirections && (
                <div className="asset-character__directions">
                  {DIRECTIONS.map(([value, label]) => (
                    <div key={value} title={label}>
                      <CharacterSprite character={character} direction={value} size={64} />
                      <small>{label}</small>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="asset-gallery__section">
        <div className="asset-gallery__section-title asset-gallery__section-title--icons">
          <div>
            <p className="asset-gallery__eyebrow">496 PNG transparentes · 34 × 34 px</p>
            <h2>Ícones RPG</h2>
            <p>Clica num ícone para copiar o seu identificador.</p>
          </div>
          <label className="asset-gallery__search">
            Procurar
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex.: coin, sword, fire…"
            />
          </label>
        </div>

        <div className="asset-gallery__filters" role="group" aria-label="Categorias de ícones">
          <button
            type="button"
            className={category === "all" ? "is-active" : ""}
            onClick={() => setCategory("all")}
          >
            Todos <span>{RPG_ICONS.length}</span>
          </button>
          {ICON_CATEGORIES.map((item) => (
            <button
              type="button"
              key={item.id}
              className={category === item.id ? "is-active" : ""}
              onClick={() => setCategory(item.id)}
            >
              {item.label} <span>{item.count}</span>
            </button>
          ))}
        </div>

        <p className="asset-gallery__result-count">
          A mostrar <strong>{visibleIcons.length}</strong> ícones
          {copied && <span className="asset-gallery__copied">Copiado: {copied}</span>}
        </p>

        <div className="asset-gallery__icons">
          {visibleIcons.map((icon) => (
            <button
              type="button"
              className="asset-icon"
              key={icon.id}
              onClick={() => copyIconId(icon.id)}
              title={`Copiar ${icon.id}`}
            >
              <span className="asset-icon__image">
                <GameIcon icon={icon} size={42} />
              </span>
              <code>{icon.id}</code>
            </button>
          ))}
        </div>
      </section>

      <footer className="asset-gallery__footer">
        Manifesto técnico: <a href={assetUrl("assets/assets-manifest.json")}>assets-manifest.json</a>
      </footer>
    </main>
  );
}
