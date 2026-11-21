/*
 * Efeitos sonoros sintetizados com Web Audio (sem arquivos externos).
 */
(function () {
  var ctx = null;
  var ligado = true;

  function contexto() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tom(freq, inicio, duracao, tipo, volume) {
    var c = contexto();
    if (!c || !ligado) return;
    var t0 = c.currentTime + inicio;
    var osc = c.createOscillator();
    var ganho = c.createGain();
    osc.type = tipo || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    ganho.gain.setValueAtTime(0.0001, t0);
    ganho.gain.exponentialRampToValueAtTime(volume || 0.15, t0 + 0.015);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);
    osc.connect(ganho).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duracao + 0.05);
  }

  window.Som = {
    destravar: function () { contexto(); },
    definir: function (v) { ligado = v; },
    ligado: function () { return ligado; },
    mira: function () { tom(880, 0, 0.05, 'square', 0.025); },
    acerto: function () {
      tom(523.25, 0, 0.18, 'triangle', 0.18);
      tom(659.25, 0.09, 0.18, 'triangle', 0.18);
      tom(783.99, 0.18, 0.35, 'triangle', 0.2);
    },
    erro: function () {
      tom(196, 0, 0.25, 'sawtooth', 0.09);
      tom(146.83, 0.14, 0.4, 'sawtooth', 0.09);
    },
    branco: function () { tom(440, 0, 0.2, 'sine', 0.12); },
    clique: function () { tom(660, 0, 0.06, 'triangle', 0.08); },
    alerta: function () { tom(1046.5, 0, 0.08, 'square', 0.05); },
    fim: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tom(f, i * 0.12, 0.4, 'triangle', 0.15); });
    }
  };
})();
