# BancaDoors

Jogo em primeira pessoa para treinar questões de TI de concursos. Você escolhe a banca, entra numa sala de servidores, lê a questão no telão e caminha até o portal da resposta.

## Como jogar

1. Abra o `index.html` no navegador (funciona direto do arquivo, sem servidor e sem internet).
2. Escolha a banca, a quantidade de questões, o tempo e os assuntos.
3. Na sala:
   - **W A S D** ou setas para andar, **Shift** para correr
   - **Mouse** para olhar (clique na tela para capturar o mouse)
   - Para responder, **fique sobre a plataforma** em frente ao portal até a barra encher, ou **mire no portal e aperte E** (ou clique)
   - **Q** abre o painel de leitura com a questão em texto
   - **Esc** pausa
4. Depois de cada resposta aparece o gabarito com comentário. No fim há nota, desempenho por assunto, revisão dos erros e a opção de refazer só as que errou.

No celular: arraste no lado esquerdo da tela para andar, no lado direito para olhar, e toque no portal para escolher.

## Bancas e regras

| Banca | Formato | Pontuação |
|---|---|---|
| Cebraspe | Certo / Errado / Em branco | +1 acerto, −1 erro, 0 em branco |
| FCC, FGV, Vunesp, Cesgranrio | Múltipla escolha A a E | +1 acerto, 0 erro |
| Simulado misto | Cada questão segue a regra da sua banca | |

A nota é o total de pontos sobre o número de questões. O corte de aprovação é 60%. O recorde de cada banca fica salvo no navegador.

Assuntos: Redes, Segurança, Banco de Dados, Engenharia de Software, Infra e SO, Programação, Governança e LGPD.

As questões são autorais, escritas no estilo de cada banca para treino. Não são questões oficiais.

## Estrutura

```
index.html          telas e HUD
css/estilo.css      visual da interface
js/mundo.js         cena 3D, movimento, portais e telão (Three.js)
js/app.js           fluxo do jogo, pontuação, resultado e recordes
js/audio.js         efeitos sonoros sintetizados (Web Audio)
js/texto.js         quebra e ajuste de texto para as texturas
js/dados/           banco de questões, um arquivo por banca
js/vendor/          Three.js r149 (licença MIT)
```

## Como adicionar questões

Edite o arquivo da banca em `js/dados/`:

```js
// Certo/Errado: true = Certo, false = Errado
ce('redes', 'Enunciado do item.', true, 'Comentário do gabarito.'),

// Múltipla escolha: a PRIMEIRA alternativa é a correta (o jogo embaralha)
me('bd', 'Enunciado da questão.', ['correta', 'errada 1', 'errada 2', 'errada 3', 'errada 4'], 'Comentário.'),
```

Os temas válidos são `redes`, `seguranca`, `bd`, `software`, `infra`, `programacao` e `governanca`.
