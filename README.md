# BancaDoors 🚪

Jogo em **primeira pessoa** de múltipla escolha com questões de **TI para concursos**. Você anda por uma sala fechada em 3D e escolhe a resposta atravessando a porta correspondente, o que leva direto à próxima fase. Antes de começar, escolhe a **banca**.

Feito com JavaScript puro (raycasting em `<canvas>`): **sem dependências, sem build, funciona offline**.

## Como jogar

Abra o `index.html` no navegador (ou publique no GitHub Pages).

| Ação | Controle |
|---|---|
| Andar | `W` `A` `S` `D` ou setas ↑ ↓ |
| Virar | `←` `→`, `Q` `E` ou mouse (clique na tela para capturar o mouse) |
| Escolher resposta | Atravesse a porta da alternativa (vai direto à próxima fase) |
| Celular | Botões na tela |

## Bancas incluídas

Cebraspe (Certo/Errado, erro anula acerto), FCC, FGV, VUNESP, IBFC e Quadrix. Cada uma tem seu próprio banco (mais de 200 questões no total), com tom de enunciado inspirado no estilo da banca.

> As questões são **originais**, escritas para este projeto no estilo de cada banca. Não são cópias de provas reais.

## Adicionar questões ou bancas

Edite `questions.js` ou `questions-mais.js` (este último acrescenta itens às bancas já existentes).

```js
// Múltipla escolha (5 alternativas; a = índice da correta, começando em 0)
{ t: "Redes", q: "Enunciado...", o: ["A", "B", "C", "D", "E"], a: 2, e: "Comentário/explicação." }

// Certo/Errado (tipo: "ce")
{ t: "Segurança", q: "Afirmativa...", a: true, e: "Comentário." }
```

Para criar uma nova banca, adicione uma entrada em `window.BANCAS` com `nome`, `cor`, `tipo` (`"mc"` ou `"ce"`), `descricao` e `questoes`.

## Publicar no GitHub

```bash
git init
git add .
git commit -m "Corredor dos Concursos"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/concurso-fps-ti.git
git push -u origin main
```

Depois, em **Settings → Pages**, selecione a branch `main` (pasta `/root`) para jogar online.

## Estrutura

```
index.html   # telas e HUD
style.css    # estilos
game.js      # motor raycasting, fluxo do jogo, pontuação
questions.js      # bancos de questões por banca
questions-mais.js # questões adicionais, somadas às anteriores
```
