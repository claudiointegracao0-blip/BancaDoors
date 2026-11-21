/*
 * Mundo 3D: sala de prova em primeira pessoa.
 * O jogador caminha até um portal de resposta e fica sobre a plataforma
 * dele para confirmar (ou mira no portal e aperta E / clica).
 */
(function () {
  var THREE = window.THREE;
  var T = window.Texto;

  var SALA = { meiaLargura: 13, zFundo: -12, zFrente: 11, altura: 11.5 };
  var LIMITE = { x: 11.3, zMin: -5.0, zMax: 10.3 };
  var Z_PORTAL = -6;
  var Z_PLATAFORMA = -4.35;
  var RAIO_PLATAFORMA = 0.9;
  var ALTURA_OLHO = 1.7;
  var TEMPO_CONFIRMACAO = 1.1;
  var ALCANCE_MIRA = 6.5;

  var renderer, cena, camera, relogio, raycaster;
  var canvasEl;
  var grupoPortais;
  var portais = [];
  var tela = {};
  var materiaisDestaque = [];
  var particulas;
  var corDestaque = new THREE.Color('#4fc3f7');

  var jogador = {
    pos: new THREE.Vector3(0, 0, 8),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0.12,
    passo: 0
  };

  var teclas = {};
  var ativo = false;
  var bloqueado = false; // após responder, até a próxima questão
  var mirando = -1;
  var confirmacao = { indice: -1, tempo: 0 };
  var sensibilidade = 1;
  var eventos = {};
  var arrasto = null;
  var toque = { mover: null, olhar: null, vetor: { x: 0, y: 0 } };

  /* ---------------- Texturas procedurais ---------------- */

  function texturaPiso() {
    var c = document.createElement('canvas');
    c.width = c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = '#10151d';
    g.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 4; j++) {
        var tom = 18 + ((i + j) % 2) * 4 + Math.random() * 3;
        g.fillStyle = 'rgb(' + tom + ',' + (tom + 5) + ',' + (tom + 12) + ')';
        g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
      }
    }
    g.strokeStyle = 'rgba(120,180,255,0.10)';
    g.lineWidth = 2;
    for (var k = 0; k <= 4; k++) {
      g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, 512); g.stroke();
      g.beginPath(); g.moveTo(0, k * 128); g.lineTo(512, k * 128); g.stroke();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(SALA.meiaLargura / 2, (SALA.zFrente - SALA.zFundo) / 4);
    t.anisotropy = 8;
    return t;
  }

  function texturaParede() {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#161b24';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#1b212c';
    g.fillRect(6, 6, 244, 116);
    g.fillRect(6, 134, 244, 116);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    g.fillRect(6, 6, 244, 4);
    g.fillRect(6, 134, 244, 4);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function texturaRack() {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#0b0e13';
    g.fillRect(0, 0, 128, 256);
    for (var y = 8; y < 248; y += 20) {
      g.fillStyle = '#1a2029';
      g.fillRect(8, y, 112, 16);
      for (var x = 14; x < 100; x += 8) {
        g.fillStyle = '#0d1117';
        g.fillRect(x, y + 4, 5, 8);
      }
      var cores = ['#39ff88', '#39ff88', '#ffb020', '#4fc3f7'];
      g.fillStyle = cores[Math.floor(Math.random() * cores.length)];
      g.fillRect(104, y + 5, 4, 4);
      if (Math.random() > 0.4) {
        g.fillStyle = '#39ff88';
        g.fillRect(112, y + 5, 4, 4);
      }
    }
    return new THREE.CanvasTexture(c);
  }

  /* ---------------- Construção da sala ---------------- */

  function materialDestaque(intensidade) {
    var m = new THREE.MeshStandardMaterial({
      color: 0x111111,
      emissive: corDestaque.clone(),
      emissiveIntensity: intensidade,
      roughness: 0.4
    });
    materiaisDestaque.push(m);
    return m;
  }

  function construirSala() {
    var largura = SALA.meiaLargura * 2;
    var profundidade = SALA.zFrente - SALA.zFundo;
    var zCentro = (SALA.zFrente + SALA.zFundo) / 2;

    var piso = new THREE.Mesh(
      new THREE.PlaneGeometry(largura, profundidade),
      new THREE.MeshStandardMaterial({ map: texturaPiso(), roughness: 0.55, metalness: 0.25 })
    );
    piso.rotation.x = -Math.PI / 2;
    piso.position.z = zCentro;
    cena.add(piso);

    var teto = new THREE.Mesh(
      new THREE.PlaneGeometry(largura, profundidade),
      new THREE.MeshStandardMaterial({ color: 0x0c0f14, roughness: 1 })
    );
    teto.rotation.x = Math.PI / 2;
    teto.position.set(0, SALA.altura, zCentro);
    cena.add(teto);

    var texParede = texturaParede();
    function parede(w, h, x, z, rotY) {
      var t = texParede.clone();
      t.needsUpdate = true;
      t.repeat.set(w / 4, h / 4);
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })
      );
      m.position.set(x, h / 2, z);
      m.rotation.y = rotY;
      cena.add(m);
    }
    parede(largura, SALA.altura, 0, SALA.zFundo, 0);
    parede(largura, SALA.altura, 0, SALA.zFrente, Math.PI);
    parede(profundidade, SALA.altura, -SALA.meiaLargura, zCentro, Math.PI / 2);
    parede(profundidade, SALA.altura, SALA.meiaLargura, zCentro, -Math.PI / 2);

    // Faixas de luz no teto
    var faixa = new THREE.BoxGeometry(0.25, 0.08, profundidade - 2);
    [-8, -3, 3, 8].forEach(function (x) {
      var f = new THREE.Mesh(faixa, materialDestaque(1.2));
      f.position.set(x, SALA.altura - 0.05, zCentro);
      cena.add(f);
    });

    // Rodapé luminoso
    var rodape = new THREE.BoxGeometry(0.06, 0.06, profundidade);
    [-SALA.meiaLargura + 0.05, SALA.meiaLargura - 0.05].forEach(function (x) {
      var r = new THREE.Mesh(rodape, materialDestaque(0.9));
      r.position.set(x, 0.05, zCentro);
      cena.add(r);
    });

    // Racks de servidores nas laterais
    var geoRack = new THREE.BoxGeometry(1.0, 2.6, 1.1);
    for (var z = -9; z <= 9; z += 2.25) {
      [-1, 1].forEach(function (lado) {
        var tex = texturaRack();
        var mats = [];
        for (var i = 0; i < 6; i++) {
          mats.push(new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.6, metalness: 0.4 }));
        }
        var frente = new THREE.MeshStandardMaterial({
          map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.5
        });
        mats[lado > 0 ? 1 : 0] = frente;
        var rack = new THREE.Mesh(geoRack, mats);
        rack.position.set(lado * (SALA.meiaLargura - 0.6), 1.3, z);
        cena.add(rack);
      });
    }

    // Tela principal da questão
    tela.canvas = document.createElement('canvas');
    tela.canvas.width = 2048;
    tela.canvas.height = 680;
    tela.ctx = tela.canvas.getContext('2d');
    tela.textura = new THREE.CanvasTexture(tela.canvas);
    tela.textura.anisotropy = 8;
    var largTela = 21, altTela = 21 * 680 / 2048;
    tela.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(largTela, altTela),
      new THREE.MeshBasicMaterial({ map: tela.textura, toneMapped: false })
    );
    tela.mesh.position.set(0, 7.45, SALA.zFundo + 0.12);
    cena.add(tela.mesh);
    var moldura = new THREE.Mesh(new THREE.BoxGeometry(largTela + 0.5, altTela + 0.5, 0.15), materialDestaque(0.5));
    moldura.position.set(0, 7.45, SALA.zFundo + 0.04);
    cena.add(moldura);

    // Faixa no piso indicando a linha dos portais
    var linha = new THREE.Mesh(new THREE.PlaneGeometry(largura - 2.4, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
    linha.rotation.x = -Math.PI / 2;
    linha.position.set(0, 0.01, LIMITE.zMin - 0.3);
    cena.add(linha);

    // Partículas de poeira iluminada
    var qtd = 260;
    var pos = new Float32Array(qtd * 3);
    for (var p = 0; p < qtd; p++) {
      pos[p * 3] = (Math.random() - 0.5) * largura;
      pos[p * 3 + 1] = Math.random() * SALA.altura;
      pos[p * 3 + 2] = SALA.zFundo + Math.random() * profundidade;
    }
    var geoP = new THREE.BufferGeometry();
    geoP.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    particulas = new THREE.Points(geoP, new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.05, transparent: true, opacity: 0.5 }));
    cena.add(particulas);

    // Iluminação
    cena.add(new THREE.HemisphereLight(0x8fb4ff, 0x0a0c10, 0.55));
    var dir = new THREE.DirectionalLight(0xffffff, 0.35);
    dir.position.set(4, 10, 6);
    cena.add(dir);
    tela.luz = new THREE.PointLight(0xffffff, 0.8, 22, 2);
    tela.luz.position.set(0, 6, SALA.zFundo + 3);
    cena.add(tela.luz);
    tela.luzPortais = new THREE.PointLight(corDestaque.getHex(), 0.9, 18, 2);
    tela.luzPortais.position.set(0, 3.5, Z_PORTAL + 3);
    cena.add(tela.luzPortais);

    grupoPortais = new THREE.Group();
    cena.add(grupoPortais);
  }

  /* ---------------- Portais de resposta ---------------- */

  var LARGURA_PAINEL = 3.2;
  var ALTURA_PAINEL = 2.9;

  function desenharPainel(p) {
    var g = p.ctx, W = p.canvas.width, H = p.canvas.height;
    var cores = {
      normal: { fundo: 'rgba(10,16,26,0.92)', borda: p.cor, texto: '#e8eef7' },
      mira: { fundo: 'rgba(18,30,48,0.96)', borda: '#ffffff', texto: '#ffffff' },
      certo: { fundo: 'rgba(14,70,40,0.96)', borda: '#3ddc84', texto: '#ffffff' },
      errado: { fundo: 'rgba(80,16,20,0.96)', borda: '#ff5252', texto: '#ffffff' },
      apagado: { fundo: 'rgba(10,12,16,0.85)', borda: '#3a4250', texto: '#6b7585' }
    }[p.estado];

    g.clearRect(0, 0, W, H);
    g.fillStyle = cores.fundo;
    T.retanguloArredondado(g, 6, 6, W - 12, H - 12, 28);
    g.fill();
    g.lineWidth = p.estado === 'mira' ? 12 : 8;
    g.strokeStyle = cores.borda;
    g.stroke();

    // Rótulo (letra, CERTO, ERRADO...)
    var rotuloGrande = p.rotulo.length === 1;
    g.fillStyle = p.estado === 'normal' ? p.cor : cores.borda;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    var tamRotulo = rotuloGrande ? 150 : 92;
    g.font = '800 ' + tamRotulo + 'px ' + T.FONTE;
    while (g.measureText(p.rotulo).width > W - 80 && tamRotulo > 40) {
      tamRotulo -= 4;
      g.font = '800 ' + tamRotulo + 'px ' + T.FONTE;
    }
    g.fillText(p.rotulo, W / 2, rotuloGrande ? 26 : 44 + (92 - tamRotulo) / 2);

    var topoTexto = rotuloGrande ? 200 : 170;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(60, topoTexto - 18, W - 120, 3);

    if (p.texto) {
      g.fillStyle = cores.texto;
      var bloco = T.ajustarTexto(g, p.texto, W - 90, H - topoTexto - 40, 58, 22, '600');
      var alturaBloco = bloco.linhas.length * bloco.alturaLinha;
      var y = topoTexto + Math.max(0, (H - topoTexto - 30 - alturaBloco) / 2);
      T.desenharBloco(g, bloco, W / 2, y, 'center');
    }
    if (p.selo) {
      g.font = '800 44px ' + T.FONTE;
      g.fillStyle = cores.borda;
      g.textAlign = 'center';
      g.fillText(p.selo, W / 2, H - 76);
    }
    p.textura.needsUpdate = true;
  }

  function criarPortal(opcao, indice, x) {
    var grupo = new THREE.Group();
    grupo.position.set(x, 0, Z_PORTAL);

    var cor = opcao.cor || '#' + corDestaque.getHexString();
    var matMoldura = new THREE.MeshStandardMaterial({
      color: 0x1a202a, metalness: 0.7, roughness: 0.35,
      emissive: new THREE.Color(cor), emissiveIntensity: 0.35
    });
    var larg = LARGURA_PAINEL + 0.3;
    var alt = ALTURA_PAINEL + 0.35;
    var geoPoste = new THREE.BoxGeometry(0.3, alt, 0.45);
    var e = new THREE.Mesh(geoPoste, matMoldura);
    e.position.set(-larg / 2, alt / 2, 0);
    var d = e.clone();
    d.position.x = larg / 2;
    var verga = new THREE.Mesh(new THREE.BoxGeometry(larg + 0.3, 0.32, 0.5), matMoldura);
    verga.position.set(0, alt + 0.16, 0);
    grupo.add(e, d, verga);

    // Fundo do portal (luz atrás do painel, aparece quando ele "abre")
    var fundo = new THREE.Mesh(
      new THREE.PlaneGeometry(LARGURA_PAINEL, ALTURA_PAINEL),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cor), transparent: true, opacity: 0.18 })
    );
    fundo.position.set(0, 0.2 + ALTURA_PAINEL / 2, -0.12);
    grupo.add(fundo);

    var canvas = document.createElement('canvas');
    canvas.width = 560;
    canvas.height = Math.round(560 * ALTURA_PAINEL / LARGURA_PAINEL);
    var textura = new THREE.CanvasTexture(canvas);
    textura.anisotropy = 8;
    var painel = new THREE.Mesh(
      new THREE.PlaneGeometry(LARGURA_PAINEL, ALTURA_PAINEL),
      new THREE.MeshBasicMaterial({ map: textura, transparent: true, toneMapped: false })
    );
    painel.position.set(0, 0.2 + ALTURA_PAINEL / 2, 0.02);
    painel.userData.indice = indice;
    grupo.add(painel);

    // Plataforma de confirmação no piso
    var plataforma = new THREE.Mesh(
      new THREE.CircleGeometry(RAIO_PLATAFORMA, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cor), transparent: true, opacity: 0.22 })
    );
    plataforma.rotation.x = -Math.PI / 2;
    plataforma.position.set(0, 0.015, Z_PLATAFORMA - Z_PORTAL);
    grupo.add(plataforma);

    var contorno = new THREE.Mesh(
      new THREE.RingGeometry(RAIO_PLATAFORMA, RAIO_PLATAFORMA + 0.06, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cor), transparent: true, opacity: 0.7 })
    );
    contorno.rotation.x = -Math.PI / 2;
    contorno.position.set(0, 0.02, Z_PLATAFORMA - Z_PORTAL);
    grupo.add(contorno);

    var progresso = new THREE.Mesh(
      new THREE.RingGeometry(RAIO_PLATAFORMA + 0.08, RAIO_PLATAFORMA + 0.24, 48, 1, 0, 0.001),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
    );
    progresso.rotation.x = -Math.PI / 2;
    progresso.rotation.z = Math.PI / 2;
    progresso.position.set(0, 0.025, Z_PLATAFORMA - Z_PORTAL);
    grupo.add(progresso);

    grupoPortais.add(grupo);

    var p = {
      indice: indice,
      grupo: grupo,
      painel: painel,
      fundo: fundo,
      plataforma: plataforma,
      progresso: progresso,
      moldura: matMoldura,
      canvas: canvas,
      ctx: canvas.getContext('2d'),
      textura: textura,
      rotulo: opcao.rotulo,
      texto: opcao.texto,
      cor: cor,
      x: x,
      estado: 'normal',
      selo: '',
      abertura: 0,
      tremor: 0
    };
    desenharPainel(p);
    return p;
  }

  function limparPortais() {
    portais.forEach(function (p) {
      p.grupo.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      grupoPortais.remove(p.grupo);
    });
    portais = [];
  }

  function atualizarProgresso(p, fracao) {
    p.progresso.geometry.dispose();
    p.progresso.geometry = new THREE.RingGeometry(
      RAIO_PLATAFORMA + 0.08, RAIO_PLATAFORMA + 0.24, 48, 1, 0, Math.max(0.001, fracao * Math.PI * 2)
    );
  }

  /* ---------------- Tela da questão ---------------- */

  function desenharTela(info) {
    var g = tela.ctx, W = tela.canvas.width, H = tela.canvas.height;
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d1520');
    grad.addColorStop(1, '#070b11');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // Cabeçalho
    g.fillStyle = info.cor;
    g.fillRect(0, 0, W, 8);
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.font = '800 46px ' + T.FONTE;
    g.fillText(info.banca.toUpperCase(), 60, 34);
    var larguraBanca = g.measureText(info.banca.toUpperCase()).width;
    g.font = '600 38px ' + T.FONTE;
    g.fillStyle = '#8a97aa';
    g.fillText('•  ' + info.tema, 60 + larguraBanca + 24, 40);
    g.textAlign = 'right';
    g.fillStyle = '#c9d4e3';
    g.font = '700 42px ' + T.FONTE;
    g.fillText('Questão ' + info.numero + ' de ' + info.total, W - 60, 36);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(60, 108, W - 120, 3);

    // Enunciado e alternativas: procura o maior tamanho em que os dois cabem juntos.
    var topo = 132;
    var areaAlt = H - topo - (info.dica ? 90 : 24);
    var temAlternativas = info.alternativas && info.alternativas.length;
    var linhasAlt = temAlternativas
      ? info.alternativas.map(function (a, i) { return '(' + 'ABCDE'[i] + ') ' + a; }).join('\n')
      : '';
    var tam = 72, bloco, blocoAlt;
    for (; tam >= 22; tam -= 2) {
      bloco = T.ajustarTexto(g, info.enunciado, W - 140, 99999, tam, tam, '500');
      var alturaTotal = bloco.linhas.length * bloco.alturaLinha;
      if (temAlternativas) {
        var tamAlt = Math.round(tam * 0.8);
        blocoAlt = T.ajustarTexto(g, linhasAlt, W - 160, 99999, tamAlt, tamAlt, '500');
        alturaTotal += 16 + blocoAlt.linhas.length * blocoAlt.alturaLinha;
      }
      if (alturaTotal <= areaAlt) break;
    }
    g.fillStyle = '#f2f6fb';
    g.font = '500 ' + bloco.tamanho + 'px ' + T.FONTE;
    var y = T.desenharBloco(g, bloco, 70, topo, 'left');

    if (temAlternativas) {
      g.fillStyle = '#b8c6d9';
      g.font = '500 ' + blocoAlt.tamanho + 'px ' + T.FONTE;
      T.desenharBloco(g, blocoAlt, 80, y + 16, 'left');
    }
    if (info.dica) {
      g.fillStyle = '#7e8ca0';
      g.font = '500 34px ' + T.FONTE;
      g.textAlign = 'center';
      g.fillText(info.dica, W / 2, H - 64);
    }
    tela.textura.needsUpdate = true;
  }

  /* ---------------- Entrada ---------------- */

  function aoTeclar(e) {
    teclas[e.code] = e.type === 'keydown';
    if (e.type === 'keydown' && ativo && !bloqueado && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
      if (mirando >= 0) escolher(mirando);
    }
    if (e.type === 'keydown' && ['ArrowUp', 'ArrowDown', 'Space'].indexOf(e.code) >= 0 && ativo) e.preventDefault();
  }

  function aoMoverMouse(e) {
    if (!ativo) return;
    var dx = 0, dy = 0;
    if (document.pointerLockElement === canvasEl) {
      dx = e.movementX || 0;
      dy = e.movementY || 0;
    } else if (arrasto) {
      dx = e.clientX - arrasto.x;
      dy = e.clientY - arrasto.y;
      arrasto.x = e.clientX;
      arrasto.y = e.clientY;
      arrasto.moveu += Math.abs(dx) + Math.abs(dy);
    } else {
      return;
    }
    // Ignora saltos absurdos que alguns navegadores geram ao travar o mouse.
    if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return;
    girar(dx, dy, 0.0022);
  }

  function girar(dx, dy, fator) {
    jogador.yaw -= dx * fator * sensibilidade;
    jogador.pitch -= dy * fator * sensibilidade;
    jogador.pitch = Math.max(-1.35, Math.min(1.35, jogador.pitch));
  }

  function aoPressionarMouse(e) {
    if (!ativo || e.button !== 0) return;
    if (document.pointerLockElement === canvasEl) {
      if (!bloqueado && mirando >= 0) escolher(mirando);
      return;
    }
    arrasto = { x: e.clientX, y: e.clientY, moveu: 0 };
  }

  function aoSoltarMouse(e) {
    if (arrasto && arrasto.moveu < 6 && ativo && !bloqueado) {
      var idx = portalNaTela(e.clientX, e.clientY);
      if (idx >= 0) escolher(idx);
    }
    arrasto = null;
  }

  function portalNaTela(cx, cy) {
    var r = canvasEl.getBoundingClientRect();
    var ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObjects(portais.map(function (p) { return p.painel; }));
    if (hits.length && hits[0].distance <= ALCANCE_MIRA + 2) return hits[0].object.userData.indice;
    return -1;
  }

  // Controles de toque: metade esquerda move (joystick), metade direita olha.
  function configurarToque() {
    var base = document.getElementById('joystick');
    var pino = document.getElementById('joystick-pino');

    canvasEl.addEventListener('touchstart', function (e) {
      if (!ativo) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.clientX < window.innerWidth * 0.45 && !toque.mover) {
          toque.mover = { id: t.identifier, x: t.clientX, y: t.clientY };
          if (base) {
            base.style.left = (t.clientX - 60) + 'px';
            base.style.top = (t.clientY - 60) + 'px';
            base.classList.add('visivel');
          }
        } else if (!toque.olhar) {
          toque.olhar = { id: t.identifier, x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: performance.now() };
        }
      }
      e.preventDefault();
    }, { passive: false });

    canvasEl.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (toque.mover && t.identifier === toque.mover.id) {
          var dx = t.clientX - toque.mover.x, dy = t.clientY - toque.mover.y;
          var dist = Math.min(50, Math.hypot(dx, dy));
          var ang = Math.atan2(dy, dx);
          toque.vetor.x = Math.cos(ang) * dist / 50;
          toque.vetor.y = Math.sin(ang) * dist / 50;
          if (pino) pino.style.transform = 'translate(' + (Math.cos(ang) * dist) + 'px,' + (Math.sin(ang) * dist) + 'px)';
        } else if (toque.olhar && t.identifier === toque.olhar.id) {
          girar(t.clientX - toque.olhar.x, t.clientY - toque.olhar.y, 0.005);
          toque.olhar.x = t.clientX;
          toque.olhar.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });

    function fim(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (toque.mover && t.identifier === toque.mover.id) {
          toque.mover = null;
          toque.vetor.x = toque.vetor.y = 0;
          if (base) base.classList.remove('visivel');
          if (pino) pino.style.transform = '';
        } else if (toque.olhar && t.identifier === toque.olhar.id) {
          var o = toque.olhar;
          var curto = performance.now() - o.t0 < 300 && Math.hypot(t.clientX - o.x0, t.clientY - o.y0) < 12;
          if (curto && ativo && !bloqueado) {
            var idx = portalNaTela(t.clientX, t.clientY);
            if (idx >= 0) escolher(idx);
          }
          toque.olhar = null;
        }
      }
    }
    canvasEl.addEventListener('touchend', fim);
    canvasEl.addEventListener('touchcancel', fim);
  }

  /* ---------------- Lógica por quadro ---------------- */

  function escolher(indice) {
    if (bloqueado) return;
    bloqueado = true;
    confirmacao.indice = -1;
    portais.forEach(function (p) { atualizarProgresso(p, 0); });
    if (eventos.escolha) eventos.escolha(indice);
  }

  function moverJogador(dt) {
    var frente = 0, lado = 0;
    if (teclas.KeyW || teclas.ArrowUp) frente += 1;
    if (teclas.KeyS || teclas.ArrowDown) frente -= 1;
    if (teclas.KeyD || teclas.ArrowRight) lado += 1;
    if (teclas.KeyA || teclas.ArrowLeft) lado -= 1;
    frente -= toque.vetor.y;
    lado += toque.vetor.x;

    var correr = teclas.ShiftLeft || teclas.ShiftRight;
    var velMax = correr ? 7 : 4.2;
    var mag = Math.hypot(frente, lado);
    if (mag > 1) { frente /= mag; lado /= mag; mag = 1; }

    var sin = Math.sin(jogador.yaw), cos = Math.cos(jogador.yaw);
    var alvoX = (-sin * frente + cos * lado) * velMax;
    var alvoZ = (-cos * frente - sin * lado) * velMax;
    var k = Math.min(1, dt * 10);
    jogador.vel.x += (alvoX - jogador.vel.x) * k;
    jogador.vel.z += (alvoZ - jogador.vel.z) * k;

    jogador.pos.x += jogador.vel.x * dt;
    jogador.pos.z += jogador.vel.z * dt;
    jogador.pos.x = Math.max(-LIMITE.x, Math.min(LIMITE.x, jogador.pos.x));
    jogador.pos.z = Math.max(LIMITE.zMin, Math.min(LIMITE.zMax, jogador.pos.z));

    var velocidade = Math.hypot(jogador.vel.x, jogador.vel.z);
    jogador.passo += velocidade * dt * 2.2;
    return velocidade;
  }

  function atualizarCamera(velocidade) {
    var balanco = Math.sin(jogador.passo) * 0.035 * Math.min(1, velocidade / 4);
    camera.position.set(jogador.pos.x, ALTURA_OLHO + balanco, jogador.pos.z);
    camera.rotation.set(jogador.pitch, jogador.yaw, 0, 'YXZ');
  }

  function atualizarMira() {
    var anterior = mirando;
    mirando = -1;
    if (ativo && !bloqueado && portais.length) {
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      var hits = raycaster.intersectObjects(portais.map(function (p) { return p.painel; }));
      if (hits.length && hits[0].distance <= ALCANCE_MIRA) mirando = hits[0].object.userData.indice;
    }
    if (anterior !== mirando) {
      portais.forEach(function (p) {
        if (p.estado === 'normal' || p.estado === 'mira') {
          var novo = p.indice === mirando ? 'mira' : 'normal';
          if (novo !== p.estado) { p.estado = novo; desenharPainel(p); }
        }
      });
      if (eventos.mira) eventos.mira(mirando >= 0 ? portais[mirando] : null);
    }
  }

  function atualizarConfirmacao(dt) {
    if (!ativo || bloqueado) return;
    var sobre = -1;
    portais.forEach(function (p) {
      var dx = jogador.pos.x - p.x, dz = jogador.pos.z - Z_PLATAFORMA;
      if (dx * dx + dz * dz <= RAIO_PLATAFORMA * RAIO_PLATAFORMA) sobre = p.indice;
    });
    if (sobre !== confirmacao.indice) {
      if (confirmacao.indice >= 0) atualizarProgresso(portais[confirmacao.indice], 0);
      confirmacao.indice = sobre;
      confirmacao.tempo = 0;
      if (eventos.plataforma) eventos.plataforma(sobre >= 0 ? portais[sobre] : null, 0);
    }
    if (sobre >= 0) {
      confirmacao.tempo += dt;
      var fracao = Math.min(1, confirmacao.tempo / TEMPO_CONFIRMACAO);
      atualizarProgresso(portais[sobre], fracao);
      if (eventos.plataforma) eventos.plataforma(portais[sobre], fracao);
      if (fracao >= 1) escolher(sobre);
    }
  }

  function animarPortais(dt, t) {
    portais.forEach(function (p) {
      if (p.abertura > 0 && p.abertura < 1) p.abertura = Math.min(1, p.abertura + dt * 1.6);
      var base = 0.2 + ALTURA_PAINEL / 2;
      p.painel.position.y = base + p.abertura * 1.1;
      p.fundo.material.opacity = 0.18 + p.abertura * 0.6;
      if (p.tremor > 0) {
        p.tremor = Math.max(0, p.tremor - dt);
        p.grupo.position.x = p.x + Math.sin(t * 60) * 0.06 * (p.tremor / 0.5);
      } else {
        p.grupo.position.x = p.x;
      }
      if (p.estado === 'normal' || p.estado === 'mira') {
        p.plataforma.material.opacity = 0.18 + Math.sin(t * 3 + p.indice) * 0.06;
      }
    });
  }

  function quadro() {
    requestAnimationFrame(quadro);
    var dt = Math.min(0.05, relogio.getDelta());
    var t = relogio.elapsedTime;
    var vel = 0;
    if (ativo) vel = moverJogador(dt);
    atualizarCamera(vel);
    atualizarMira();
    atualizarConfirmacao(dt);
    animarPortais(dt, t);
    if (particulas) {
      particulas.rotation.y = t * 0.01;
      particulas.position.y = Math.sin(t * 0.2) * 0.2;
    }
    renderer.render(cena, camera);
  }

  function redimensionar() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // Em telas estreitas (celular em pé), abre o campo de visão vertical
    // para manter os portais laterais à vista.
    var hfov = 84 * Math.PI / 180;
    var vfov = 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect) * 180 / Math.PI;
    camera.fov = Math.max(70, Math.min(100, vfov));
    camera.updateProjectionMatrix();
  }

  /* ---------------- API pública ---------------- */

  window.Mundo = {
    iniciar: function (canvas) {
      canvasEl = canvas;
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      cena = new THREE.Scene();
      cena.background = new THREE.Color(0x07090d);
      cena.fog = new THREE.Fog(0x07090d, 18, 40);
      camera = new THREE.PerspectiveCamera(70, 1, 0.05, 100);
      relogio = new THREE.Clock();
      raycaster = new THREE.Raycaster();
      construirSala();
      redimensionar();
      window.addEventListener('resize', redimensionar);
      window.addEventListener('keydown', aoTeclar);
      window.addEventListener('keyup', aoTeclar);
      window.addEventListener('blur', function () { teclas = {}; });
      document.addEventListener('mousemove', aoMoverMouse);
      canvas.addEventListener('mousedown', aoPressionarMouse);
      window.addEventListener('mouseup', aoSoltarMouse);
      document.addEventListener('pointerlockchange', function () {
        if (eventos.trava) eventos.trava(document.pointerLockElement === canvasEl);
      });
      configurarToque();
      desenharTela({ banca: 'BancaDoors', tema: 'Sala de prova', numero: 0, total: 0, cor: '#4fc3f7', enunciado: 'Escolha uma banca no menu para começar.' });
      quadro();
    },

    on: function (nome, fn) { eventos[nome] = fn; },

    definirCor: function (hex) {
      corDestaque.set(hex);
      materiaisDestaque.forEach(function (m) { m.emissive.set(hex); });
      if (tela.luzPortais) tela.luzPortais.color.set(hex);
    },

    // opcoes: [{ rotulo, texto, cor? }]
    montarQuestao: function (info, opcoes) {
      limparPortais();
      var n = opcoes.length;
      var espaco = n >= 5 ? 4.4 : n === 4 ? 5.2 : 6.2;
      opcoes.forEach(function (o, i) {
        portais.push(criarPortal(o, i, (i - (n - 1) / 2) * espaco));
      });
      desenharTela(info);
      jogador.pos.set(0, 0, 8);
      jogador.vel.set(0, 0, 0);
      jogador.yaw = 0;
      jogador.pitch = 0.12;
      mirando = -1;
      confirmacao.indice = -1;
      bloqueado = false;
    },

    // Mostra o resultado nos portais.
    revelar: function (escolhido, correto) {
      portais.forEach(function (p) {
        if (p.indice === correto) {
          p.estado = 'certo';
          p.selo = p.indice === escolhido ? 'SUA RESPOSTA' : 'GABARITO';
          p.abertura = 0.001;
          p.fundo.material.color.set('#3ddc84');
        } else if (p.indice === escolhido) {
          p.estado = 'errado';
          p.selo = 'SUA RESPOSTA';
          p.tremor = 0.5;
        } else {
          p.estado = 'apagado';
          p.selo = '';
        }
        desenharPainel(p);
      });
    },

    ativar: function (sim) {
      ativo = sim;
      if (!sim) { teclas = {}; toque.vetor.x = toque.vetor.y = 0; arrasto = null; }
    },

    travarMouse: function () {
      if (!canvasEl.requestPointerLock || ('ontouchstart' in window && !window.matchMedia('(pointer: fine)').matches)) return;
      try {
        var r = canvasEl.requestPointerLock();
        if (r && r.catch) r.catch(function () { /* o arrastar com o mouse continua funcionando */ });
      } catch (e) { /* idem */ }
    },

    liberarMouse: function () {
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    },

    mouseTravado: function () { return document.pointerLockElement === canvasEl; },

    definirSensibilidade: function (v) { sensibilidade = v; },

    // Usado em testes automatizados.
    depurar: function () {
      return { x: jogador.pos.x, z: jogador.pos.z, ativo: ativo, bloqueado: bloqueado, confirmacao: confirmacao.indice, tempo: confirmacao.tempo, mirando: mirando };
    }
  };
})();
