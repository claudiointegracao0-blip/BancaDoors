/*
 * Estrutura comum do banco de questões.
 * Todas as questões são autorais, escritas no estilo de cada banca.
 *
 * Certo/Errado:      ce(tema, enunciado, gabarito, comentario)
 * Múltipla escolha:  me(tema, enunciado, [correta, distrator, ...], comentario)
 *   Na múltipla escolha a PRIMEIRA alternativa é a correta.
 *   O jogo embaralha a ordem antes de exibir.
 */
window.BANCO = [];

window.TEMAS = {
  redes: 'Redes',
  seguranca: 'Segurança',
  bd: 'Banco de Dados',
  software: 'Engenharia de Software',
  infra: 'Infra e SO',
  programacao: 'Programação',
  governanca: 'Governança e LGPD'
};

window.BANCAS = {
  cebraspe: {
    nome: 'Cebraspe',
    formato: 'ce',
    cor: '#4fc3f7',
    descricao: 'Certo ou Errado. Cada erro anula um acerto, então deixar em branco pode valer a pena.'
  },
  fcc: {
    nome: 'FCC',
    formato: 'me',
    cor: '#ffb74d',
    descricao: 'Múltipla escolha de A a E, enunciados diretos e cobrança de conceitos.'
  },
  fgv: {
    nome: 'FGV',
    formato: 'me',
    cor: '#ef5350',
    descricao: 'Múltipla escolha de A a E com situações práticas e enunciados mais longos.'
  },
  vunesp: {
    nome: 'Vunesp',
    formato: 'me',
    cor: '#66bb6a',
    descricao: 'Múltipla escolha de A a E, objetiva, com foco em fundamentos.'
  },
  cesgranrio: {
    nome: 'Cesgranrio',
    formato: 'me',
    cor: '#ba68c8',
    descricao: 'Múltipla escolha de A a E, comum em estatais, com bastante teoria.'
  }
};

window.registrarQuestoes = function (banca, lista) {
  lista.forEach(function (q, i) {
    q.banca = banca;
    q.id = banca + '-' + (i + 1);
    window.BANCO.push(q);
  });
};

window.ce = function (tema, enunciado, gabarito, comentario) {
  return { tipo: 'ce', tema: tema, enunciado: enunciado, gabarito: gabarito, comentario: comentario };
};

window.me = function (tema, enunciado, alternativas, comentario) {
  return { tipo: 'me', tema: tema, enunciado: enunciado, alternativas: alternativas, comentario: comentario };
};
