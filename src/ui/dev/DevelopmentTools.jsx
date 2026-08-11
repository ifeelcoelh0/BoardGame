import AssetGallery from "../assets/AssetGallery.jsx";
import UILab from "../lab/UILab.jsx";

/*
 * Entrada exclusiva de desenvolvimento. O módulo inteiro fica atrás de
 * import.meta.env.DEV em main.jsx, permitindo ao Rollup eliminar este grafo do
 * build de produção em vez de apenas o esconder atrás de um query parameter.
 */
export default function DevelopmentTools({ page }) {
  if (page === "assets") return <AssetGallery />;
  if (page === "ui") return <UILab />;
  return null;
}
