/*
 * Utilitários para desenhar texto em canvas (usado nas texturas 3D).
 */
(function () {
  var FONTE = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  // Quebra o texto em linhas que caibam na largura, respeitando \n.
  function quebrarLinhas(ctx, texto, largura) {
    var linhas = [];
    String(texto).split('\n').forEach(function (paragrafo) {
      var palavras = paragrafo.split(/\s+/).filter(Boolean);
      if (!palavras.length) { linhas.push(''); return; }
      var atual = '';
      palavras.forEach(function (p) {
        var teste = atual ? atual + ' ' + p : p;
        if (ctx.measureText(teste).width <= largura || !atual) {
          atual = teste;
        } else {
          linhas.push(atual);
          atual = p;
        }
      });
      linhas.push(atual);
    });
    return linhas;
  }

  // Encontra o maior tamanho de fonte em que o texto cabe na caixa.
  function ajustarTexto(ctx, texto, largura, altura, maximo, minimo, peso) {
    peso = peso || '500';
    var tamanho = maximo;
    var linhas;
    while (tamanho >= minimo) {
      ctx.font = peso + ' ' + tamanho + 'px ' + FONTE;
      linhas = quebrarLinhas(ctx, texto, largura);
      if (linhas.length * tamanho * 1.25 <= altura) break;
      tamanho -= 2;
    }
    if (tamanho < minimo) tamanho = minimo;
    ctx.font = peso + ' ' + tamanho + 'px ' + FONTE;
    linhas = quebrarLinhas(ctx, texto, largura);
    return { linhas: linhas, tamanho: tamanho, alturaLinha: tamanho * 1.25 };
  }

  function desenharBloco(ctx, bloco, x, y, alinhamento) {
    ctx.textAlign = alinhamento || 'left';
    ctx.textBaseline = 'top';
    bloco.linhas.forEach(function (linha, i) {
      ctx.fillText(linha, x, y + i * bloco.alturaLinha);
    });
    return y + bloco.linhas.length * bloco.alturaLinha;
  }

  function retanguloArredondado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  window.Texto = {
    FONTE: FONTE,
    quebrarLinhas: quebrarLinhas,
    ajustarTexto: ajustarTexto,
    desenharBloco: desenharBloco,
    retanguloArredondado: retanguloArredondado
  };
})();
