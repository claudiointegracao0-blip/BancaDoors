/*
 * Fluxo do jogo: menu, prova, feedback, pausa e resultado.
 */
(function () {
  var CHAVE = 'bancadoors.v2';
  var APROVACAO = 60;
  var LETRAS = 'ABCDE';

  var $ = function (id) { return document.getElementById(id); };

  var salvo = carregar();
  var config = Object.assign({
    banca: 'cebraspe',
    quantidade: 10,
    tempo: 0,
    temas: Object.keys(TEMAS),
    sensibilidade: 1,
    som: true,
    // No celular o painel de leitura começa aberto.
    leitura: window.matchMedia('(pointer: coarse)').matches
  }, salvo.config || {});
  var recordes = salvo.recordes || {};

  var estado = 'menu';
  var prova = null;
  var liberandoMouse = false;
  var cronometro = null;
  var ultimoSegundo = -1;

  /* ---------------- Persistência ---------------- */

  function carregar() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; }
  }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify({ config: config, recordes: recordes })); } catch (e) { /* sem armazenamento */ }
  }

  /* ---------------- Utilidades ---------------- */

  function embaralhar(lista) {
    var a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function mostrar(id, sim) { $(id).classList.toggle('oculto', !sim); }

  function infoBanca(chave) {
    if (chave === 'mista') return { nome: 'Simulado misto', cor: '#e6edf5', formato: 'misto' };
    return BANCAS[chave];
  }

  function questoesFiltradas(banca, temas) {
    return BANCO.filter(function (q) {
      return (banca === 'mista' || q.banca === banca) && temas.indexOf(q.tema) >= 0;
    });
  }

  function formatarTempo(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  /* ---------------- Menu ---------------- */

  function montarMenu() {
    var lista = $('lista-bancas');
    lista.innerHTML = '';
    var chaves = Object.keys(BANCAS).concat(['mista']);
    chaves.forEach(function (chave) {
      var b = chave === 'mista'
        ? { nome: 'Simulado misto', cor: '#e6edf5', formato: 'misto', descricao: 'Mistura todas as bancas. Cada questão segue as regras da sua banca.' }
        : BANCAS[chave];
      var total = chave === 'mista' ? BANCO.length : BANCO.filter(function (q) { return q.banca === chave; }).length;
      var card = document.createElement('button');
      card.className = 'banca' + (config.banca === chave ? ' ativo' : '');
      card.style.setProperty('--cor', b.cor);
      card.dataset.banca = chave;

      var nome = document.createElement('strong');
      nome.textContent = b.nome;
      var formato = document.createElement('span');
      formato.className = 'formato';
      formato.textContent = b.formato === 'ce' ? 'Certo / Errado' : b.formato === 'me' ? 'A a E' : 'Formatos variados';
      var desc = document.createElement('p');
      desc.textContent = b.descricao;
      var rodape = document.createElement('span');
      rodape.className = 'rodape';
      var rec = recordes[chave];
      rodape.textContent = total + ' questões' + (rec ? '  •  recorde ' + rec.percentual + '%' : '');

      card.append(nome, formato, desc, rodape);
      card.addEventListener('click', function () {
        config.banca = chave;
        Som.clique();
        document.querySelectorAll('.banca').forEach(function (c) { c.classList.toggle('ativo', c.dataset.banca === chave); });
        atualizarResumo();
        salvar();
      });
      lista.appendChild(card);
    });

    var chips = $('opt-temas');
    chips.innerHTML = '';
    Object.keys(TEMAS).forEach(function (t) {
      var chip = document.createElement('button');
      chip.textContent = TEMAS[t];
      chip.dataset.tema = t;
      chip.className = config.temas.indexOf(t) >= 0 ? 'ativo' : '';
      chip.addEventListener('click', function () {
        var i = config.temas.indexOf(t);
        if (i >= 0) {
          if (config.temas.length === 1) return;
          config.temas.splice(i, 1);
        } else {
          config.temas.push(t);
        }
        chip.classList.toggle('ativo', i < 0);
        Som.clique();
        atualizarResumo();
        salvar();
      });
      chips.appendChild(chip);
    });

    atualizarResumo();
  }

  // Controles fixos do menu: configurados uma única vez.
  function configurarOpcoes() {
    configurarSegmentos('opt-quantidade', 'quantidade');
    configurarSegmentos('opt-tempo', 'tempo');

    var sens = $('opt-sensibilidade');
    sens.value = config.sensibilidade;
    sens.addEventListener('input', function () {
      config.sensibilidade = parseFloat(sens.value);
      Mundo.definirSensibilidade(config.sensibilidade);
      salvar();
    });
    var som = $('opt-som');
    som.checked = config.som;
    som.addEventListener('change', function () {
      config.som = som.checked;
      Som.definir(config.som);
      salvar();
    });

    atualizarResumo();
  }

  function configurarSegmentos(id, campo) {
    var botoes = $(id).querySelectorAll('button');
    botoes.forEach(function (b) {
      b.classList.toggle('ativo', parseInt(b.dataset.valor, 10) === config[campo]);
      b.addEventListener('click', function () {
        config[campo] = parseInt(b.dataset.valor, 10);
        botoes.forEach(function (o) { o.classList.toggle('ativo', o === b); });
        Som.clique();
        atualizarResumo();
        salvar();
      });
    });
  }

  function atualizarResumo() {
    var disponiveis = questoesFiltradas(config.banca, config.temas).length;
    var qtd = config.quantidade === 0 ? disponiveis : Math.min(config.quantidade, disponiveis);
    var texto = qtd + ' ' + (qtd === 1 ? 'questão' : 'questões');
    if (config.quantidade > disponiveis) texto += ' (só há ' + disponiveis + ' com esses assuntos)';
    $('resumo-prova').textContent = texto;
    $('btn-iniciar').disabled = qtd === 0;
  }

  /* ---------------- Prova ---------------- */

  function prepararQuestao(q) {
    var item = { q: q, opcoes: [], correto: 0, branco: -1 };
    if (q.tipo === 'ce') {
      item.opcoes = [
        { rotulo: 'CERTO', texto: 'O item está correto.', cor: '#3ddc84', nome: 'Certo' },
        { rotulo: 'EM BRANCO', texto: 'Não marcar. Vale zero e não desconta.', cor: '#9aa5b4', nome: 'Em branco' },
        { rotulo: 'ERRADO', texto: 'O item está errado.', cor: '#ff6b6b', nome: 'Errado' }
      ];
      item.correto = q.gabarito ? 0 : 2;
      item.branco = 1;
    } else {
      var ordem = embaralhar(q.alternativas.map(function (_, i) { return i; }));
      item.opcoes = ordem.map(function (orig, pos) {
        return { rotulo: LETRAS[pos], texto: q.alternativas[orig], nome: LETRAS[pos] + ') ' + q.alternativas[orig] };
      });
      item.correto = ordem.indexOf(0);
    }
    return item;
  }

  function iniciarProva(listaQuestoes) {
    Som.destravar();
    var questoes = listaQuestoes;
    if (!questoes) {
      var base = embaralhar(questoesFiltradas(config.banca, config.temas));
      questoes = config.quantidade === 0 ? base : base.slice(0, config.quantidade);
    }
    if (!questoes.length) return;
    prova = {
      banca: config.banca,
      itens: questoes.map(prepararQuestao),
      indice: 0,
      pontos: 0,
      respostas: [],
      inicio: Date.now()
    };
    var b = infoBanca(prova.banca);
    $('hud-banca').textContent = b.nome;
    $('hud-banca').style.setProperty('--cor', b.cor);
    Mundo.definirCor(b.cor === '#e6edf5' ? '#4fc3f7' : b.cor);

    mostrar('tela-menu', false);
    mostrar('tela-resultado', false);
    mostrar('tela-pausa', false);
    mostrar('hud', true);
    carregarQuestao();
    Mundo.travarMouse();
  }

  function carregarQuestao() {
    var item = prova.itens[prova.indice];
    var q = item.q;
    var b = BANCAS[q.banca];
    Mundo.montarQuestao({
      banca: b.nome + (prova.banca === 'mista' ? ' (misto)' : ''),
      tema: TEMAS[q.tema],
      numero: prova.indice + 1,
      total: prova.itens.length,
      cor: b.cor,
      enunciado: q.enunciado,
      alternativas: q.tipo === 'me' ? item.opcoes.map(function (o) { return o.texto; }) : null,
      dica: q.tipo === 'ce' ? 'Julgue o item. Lembre: cada erro anula um acerto.' : ''
    }, item.opcoes);

    item.tempoRestante = config.tempo || 0;
    atualizarHud();
    preencherLeitura(item);
    mostrar('leitura', config.leitura);
    avisar('');
    estado = 'jogando';
    Mundo.ativar(true);
    iniciarCronometro();
  }

  function atualizarHud() {
    $('hud-progresso').textContent = 'Questão ' + (prova.indice + 1) + '/' + prova.itens.length;
    var p = prova.pontos;
    $('hud-placar').textContent = (p > 0 ? '+' : '') + p + (Math.abs(p) === 1 ? ' pt' : ' pts');
    mostrar('hud-tempo', !!config.tempo);
  }

  function preencherLeitura(item) {
    var q = item.q;
    $('leitura-meta').textContent = BANCAS[q.banca].nome + ' • ' + TEMAS[q.tema];
    $('leitura-enunciado').textContent = q.enunciado;
    var ol = $('leitura-alternativas');
    ol.innerHTML = '';
    if (q.tipo === 'ce') return;
    item.opcoes.forEach(function (o) {
      var li = document.createElement('li');
      var r = document.createElement('b');
      r.textContent = o.rotulo.length === 1 ? o.rotulo + ')' : o.rotulo;
      li.appendChild(r);
      li.appendChild(document.createTextNode(' ' + (o.rotulo.length === 1 ? o.texto : '')));
      ol.appendChild(li);
    });
  }

  function avisar(texto, destaque) {
    var el = $('hud-aviso');
    el.textContent = texto;
    el.classList.toggle('oculto', !texto);
    el.classList.toggle('destaque', !!destaque);
  }

  /* ---------------- Cronômetro ---------------- */

  function iniciarCronometro() {
    pararCronometro();
    if (!config.tempo) return;
    var item = prova.itens[prova.indice];
    var ultimo = performance.now();
    ultimoSegundo = -1;
    $('hud-tempo').textContent = formatarTempo(item.tempoRestante);
    cronometro = setInterval(function () {
      var agora = performance.now();
      var dt = (agora - ultimo) / 1000;
      ultimo = agora;
      if (estado !== 'jogando') return;
      item.tempoRestante -= dt;
      var el = $('hud-tempo');
      el.textContent = formatarTempo(item.tempoRestante);
      el.classList.toggle('alerta', item.tempoRestante <= 10);
      var seg = Math.ceil(item.tempoRestante);
      if (seg <= 5 && seg > 0 && seg !== ultimoSegundo) { ultimoSegundo = seg; Som.alerta(); }
      if (item.tempoRestante <= 0) {
        pararCronometro();
        responder(-1, true);
      }
    }, 100);
  }

  function pararCronometro() {
    if (cronometro) clearInterval(cronometro);
    cronometro = null;
  }

  /* ---------------- Resposta ---------------- */

  function responder(indice, esgotou) {
    if (estado !== 'jogando') return;
    estado = 'revelando';
    pararCronometro();
    Mundo.ativar(false);
    avisar('');

    var item = prova.itens[prova.indice];
    var q = item.q;
    var resultado, delta = 0;
    if (indice === item.correto) {
      resultado = 'acerto';
      delta = 1;
    } else if (indice < 0 || indice === item.branco) {
      // Tempo esgotado: em branco no Certo/Errado, erro na múltipla escolha.
      resultado = q.tipo === 'ce' ? 'branco' : 'erro';
    } else {
      resultado = 'erro';
      delta = q.tipo === 'ce' ? -1 : 0;
    }
    prova.pontos += delta;
    prova.respostas.push({ item: item, escolhido: indice, resultado: resultado, delta: delta, esgotou: !!esgotou });

    Mundo.revelar(indice === item.branco ? -1 : indice, item.correto);
    if (resultado === 'acerto') Som.acerto();
    else if (resultado === 'erro') Som.erro();
    else Som.branco();
    atualizarHud();

    setTimeout(function () { mostrarFeedback(prova.respostas[prova.respostas.length - 1]); }, 1100);
  }

  function mostrarFeedback(r) {
    estado = 'feedback';
    liberarMouse();
    var item = r.item, q = item.q;
    var titulos = { acerto: 'Acertou!', erro: 'Errou', branco: 'Em branco' };
    var titulo = $('fb-titulo');
    titulo.textContent = r.esgotou ? 'Tempo esgotado' : titulos[r.resultado];
    titulo.className = 'fb-titulo ' + r.resultado;

    var pts = '';
    if (r.delta > 0) pts = '+1 ponto';
    else if (r.delta < 0) pts = '−1 ponto (um erro anula um acerto)';
    else pts = '0 ponto';
    $('fb-pontos').textContent = pts;

    $('fb-sua').textContent = r.escolhido < 0 ? (q.tipo === 'ce' ? 'Em branco' : 'Sem resposta') : item.opcoes[r.escolhido].nome;
    $('fb-gabarito').textContent = item.opcoes[item.correto].nome;
    $('fb-comentario').textContent = q.comentario;
    $('btn-continuar').innerHTML = (prova.indice + 1 < prova.itens.length ? 'Próxima questão' : 'Ver resultado') + ' <kbd>Enter</kbd>';
    mostrar('leitura', false);
    mostrar('tela-feedback', true);
    $('btn-continuar').focus();
  }

  function continuar() {
    if (estado !== 'feedback') return;
    Som.clique();
    mostrar('tela-feedback', false);
    if (prova.indice + 1 >= prova.itens.length) {
      finalizar();
      return;
    }
    estado = 'transicao';
    Mundo.travarMouse();
    transicao(function () {
      prova.indice++;
      carregarQuestao();
    });
  }

  function transicao(meio) {
    var fade = $('fade');
    fade.classList.add('ativo');
    setTimeout(function () {
      meio();
      setTimeout(function () { fade.classList.remove('ativo'); }, 60);
    }, 320);
  }

  function liberarMouse() {
    if (Mundo.mouseTravado()) {
      liberandoMouse = true;
      Mundo.liberarMouse();
    }
  }

  /* ---------------- Pausa ---------------- */

  function pausar() {
    if (estado !== 'jogando') return;
    estado = 'pausa';
    Mundo.ativar(false);
    liberarMouse();
    $('pausa-info').textContent = 'Questão ' + (prova.indice + 1) + ' de ' + prova.itens.length + '  •  ' + prova.pontos + ' pts';
    mostrar('tela-pausa', true);
  }

  function retomar() {
    if (estado !== 'pausa') return;
    mostrar('tela-pausa', false);
    estado = 'jogando';
    Mundo.ativar(true);
    Mundo.travarMouse();
  }

  function sairParaMenu() {
    pararCronometro();
    estado = 'menu';
    prova = null;
    Mundo.ativar(false);
    liberarMouse();
    ['hud', 'leitura', 'tela-pausa', 'tela-feedback', 'tela-resultado'].forEach(function (id) { mostrar(id, false); });
    montarMenu();
    mostrar('tela-menu', true);
  }

  /* ---------------- Resultado ---------------- */

  function finalizar() {
    pararCronometro();
    estado = 'resultado';
    Mundo.ativar(false);
    liberarMouse();
    mostrar('hud', false);
    mostrar('leitura', false);
    mostrar('tela-pausa', false);

    var resp = prova.respostas;
    var total = prova.itens.length;
    var acertos = resp.filter(function (r) { return r.resultado === 'acerto'; }).length;
    var erros = resp.filter(function (r) { return r.resultado === 'erro'; }).length;
    var brancos = resp.filter(function (r) { return r.resultado === 'branco'; }).length;
    var naoRespondidas = total - resp.length;
    var percentual = Math.max(0, Math.round(prova.pontos / total * 100));
    var aprovado = percentual >= APROVACAO;
    var b = infoBanca(prova.banca);

    var selo = $('res-selo');
    selo.textContent = aprovado ? 'Aprovado' : 'Continue treinando';
    selo.className = 'res-selo ' + (aprovado ? 'ok' : 'nao');
    $('res-percentual').textContent = percentual + '%';
    $('res-banca').textContent = b.nome + ' • ' + total + ' questões • corte de ' + APROVACAO + '%';

    var numeros = [
      ['Acertos', acertos, 'acerto'],
      ['Erros', erros, 'erro'],
      ['Em branco', brancos + naoRespondidas, 'branco'],
      ['Pontos', prova.pontos, '']
    ];
    var nums = $('res-numeros');
    nums.innerHTML = '';
    numeros.forEach(function (n) {
      var d = document.createElement('div');
      d.className = n[2];
      var v = document.createElement('strong');
      v.textContent = n[1];
      var l = document.createElement('span');
      l.textContent = n[0];
      d.append(v, l);
      nums.appendChild(d);
    });

    var rec = recordes[prova.banca];
    var recTexto = '';
    if (resp.length === total) {
      if (!rec || percentual > rec.percentual) {
        recordes[prova.banca] = { percentual: percentual, data: new Date().toISOString() };
        salvar();
        recTexto = rec ? 'Novo recorde! O anterior era ' + rec.percentual + '%.' : 'Primeiro recorde registrado nesta banca.';
      } else {
        recTexto = 'Seu recorde nesta banca é ' + rec.percentual + '%.';
      }
    } else {
      recTexto = 'Prova encerrada antes do fim: o recorde não foi atualizado.';
    }
    $('res-recorde').textContent = recTexto;

    // Por assunto
    var porTema = {};
    prova.itens.forEach(function (it) {
      porTema[it.q.tema] = porTema[it.q.tema] || { total: 0, acertos: 0 };
      porTema[it.q.tema].total++;
    });
    resp.forEach(function (r) { if (r.resultado === 'acerto') porTema[r.item.q.tema].acertos++; });
    var temasEl = $('res-temas');
    temasEl.innerHTML = '';
    Object.keys(porTema).forEach(function (t) {
      var d = porTema[t];
      var pct = Math.round(d.acertos / d.total * 100);
      var linha = document.createElement('div');
      linha.className = 'tema';
      var nome = document.createElement('span');
      nome.textContent = TEMAS[t];
      var barra = document.createElement('div');
      barra.className = 'barra';
      var cheio = document.createElement('i');
      cheio.style.width = pct + '%';
      barra.appendChild(cheio);
      var valor = document.createElement('b');
      valor.textContent = d.acertos + '/' + d.total;
      linha.append(nome, barra, valor);
      temasEl.appendChild(linha);
    });

    // Revisão
    var revisao = $('res-revisao');
    revisao.innerHTML = '';
    var paraRevisar = resp.filter(function (r) { return r.resultado !== 'acerto'; });
    $('res-revisao-titulo').textContent = paraRevisar.length ? 'Revisão (' + paraRevisar.length + ')' : 'Revisão';
    if (!paraRevisar.length) {
      var p = document.createElement('p');
      p.className = 'vazio';
      p.textContent = resp.length ? 'Nenhum erro. Gabaritou!' : 'Nenhuma questão respondida.';
      revisao.appendChild(p);
    }
    paraRevisar.forEach(function (r) {
      var q = r.item.q;
      var det = document.createElement('details');
      var sum = document.createElement('summary');
      var tag = document.createElement('span');
      tag.className = 'tag ' + r.resultado;
      tag.textContent = r.resultado === 'erro' ? 'Erro' : 'Branco';
      sum.appendChild(tag);
      sum.appendChild(document.createTextNode(' ' + q.enunciado.replace(/\n/g, ' ')));
      var corpo = document.createElement('div');
      var sua = document.createElement('p');
      sua.innerHTML = '<b>Sua resposta:</b> ';
      sua.appendChild(document.createTextNode(r.escolhido < 0 ? 'nenhuma' : r.item.opcoes[r.escolhido].nome));
      var gab = document.createElement('p');
      gab.innerHTML = '<b>Gabarito:</b> ';
      gab.appendChild(document.createTextNode(r.item.opcoes[r.item.correto].nome));
      var com = document.createElement('p');
      com.textContent = q.comentario;
      corpo.append(sua, gab, com);
      det.append(sum, corpo);
      revisao.appendChild(det);
    });

    var erradas = paraRevisar.map(function (r) { return r.item.q; });
    var btnRefazer = $('btn-refazer-erradas');
    btnRefazer.classList.toggle('oculto', !erradas.length);
    btnRefazer.onclick = function () { iniciarProva(embaralhar(erradas)); };

    Som.fim();
    mostrar('tela-resultado', true);
    $('tela-resultado').scrollTop = 0;
  }

  /* ---------------- Eventos ---------------- */

  function configurarEventos() {
    $('btn-iniciar').addEventListener('click', function () { iniciarProva(); });
    $('btn-continuar').addEventListener('click', continuar);
    $('btn-retomar').addEventListener('click', retomar);
    $('btn-encerrar').addEventListener('click', function () { mostrar('tela-pausa', false); finalizar(); });
    $('btn-sair').addEventListener('click', sairParaMenu);
    $('btn-de-novo').addEventListener('click', function () { iniciarProva(); });
    $('btn-menu').addEventListener('click', sairParaMenu);
    $('btn-ler-toque').addEventListener('click', alternarLeitura);
    $('btn-pausa-toque').addEventListener('click', pausar);

    $('cena').addEventListener('click', function () {
      if (estado === 'jogando' && !Mundo.mouseTravado()) Mundo.travarMouse();
    });

    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      if (estado === 'feedback' && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) {
        e.preventDefault();
        continuar();
      } else if (estado === 'jogando' && e.code === 'KeyQ') {
        alternarLeitura();
      } else if (estado === 'jogando' && (e.code === 'Escape' || e.code === 'KeyP')) {
        pausar();
      } else if (estado === 'pausa' && e.code === 'KeyP') {
        retomar();
      }
    });

    Mundo.on('escolha', function (indice) { responder(indice, false); });

    Mundo.on('trava', function (travado) {
      if (travado) return;
      if (liberandoMouse) { liberandoMouse = false; return; }
      if (estado === 'jogando') pausar();
    });

    var ultimaMira = null;
    Mundo.on('mira', function (portal) {
      if (estado !== 'jogando') return;
      if (portal && portal !== ultimaMira) Som.mira();
      ultimaMira = portal;
      if (portal) avisar(rotuloPortal(portal) + '  •  E ou clique para escolher');
      else avisar('');
    });

    Mundo.on('plataforma', function (portal, fracao) {
      if (estado !== 'jogando') return;
      if (portal) avisar('Confirmando ' + rotuloPortal(portal) + '...  ' + Math.round(fracao * 100) + '%  (saia para cancelar)', true);
      else avisar('');
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && estado === 'jogando') pausar();
    });
  }

  function rotuloPortal(p) {
    return p.rotulo.length === 1 ? 'Alternativa ' + p.rotulo : p.rotulo.charAt(0) + p.rotulo.slice(1).toLowerCase();
  }

  function alternarLeitura() {
    config.leitura = !config.leitura;
    mostrar('leitura', config.leitura);
    salvar();
  }

  /* ---------------- Início ---------------- */

  Mundo.iniciar($('cena'));
  Mundo.definirSensibilidade(config.sensibilidade);
  Som.definir(config.som);
  configurarOpcoes();
  montarMenu();
  configurarEventos();
})();
