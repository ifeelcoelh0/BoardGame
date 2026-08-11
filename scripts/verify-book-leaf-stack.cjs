const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const assert = require("node:assert/strict");

/*
   Ordem da pilha de folhas do livro 3D.

   Existe porque este erro passou duas vezes sem eu o notar a olho: as folhas de
   baixo levavam um mergulho MENOR do que a folha impressa, portanto rompiam à
   frente dela junto à goteira e apareciam como manchas claras sobre a página. À
   segunda tentativa deixaram de romper a impressa mas passaram a cruzar-se entre
   si, porque a ondulação era maior do que o degrau em z entre camadas.

   Nenhuma das duas coisas se avalia bem numa imagem sem sombras. Ambas se medem
   exactamente: as folhas saem todas do mesmo plano subdividido, portanto o
   vértice de índice i é o mesmo ponto paramétrico em todas, e basta comparar z.
*/

const source = fs.readFileSync("src/ui/lobby/lobbySceneBook.js", "utf8");
assert.match(source, /curvedLeafGeometry/, "as folhas têm de ser curvas, não planos rectos");
assert.match(source, /book-leaf-\$\{layerIndex\}/, "as folhas precisam de nome para poderem ser medidas");

const output = execFileSync("node", ["tools/check-book-leaves.mjs"], { encoding: "utf8" });
process.stdout.write(output);
assert.doesNotMatch(output, /ROMPE À FRENTE/, "uma folha de baixo rompe à frente da folha impressa");
assert.doesNotMatch(output, /CRUZAM/, "duas folhas de baixo cruzam-se");

console.log("Pilha de folhas do livro verificada: monótona e toda atrás da folha impressa.");
