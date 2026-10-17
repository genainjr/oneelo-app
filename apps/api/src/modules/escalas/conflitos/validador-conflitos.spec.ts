import {
  validarConflitosEscala,
  normalizarParFuncoes,
  SegmentoInfo,
  FuncaoComSegmentos,
  RegraCompatibilidadePar,
} from './validador-conflitos';

describe('ValidadorConflitosEscala (Função Pura)', () => {
  const segmentosPadrao: SegmentoInfo[] = [
    { id: 'seg-1', nome: 'Abertura', ordem: 1 },
    { id: 'seg-2', nome: 'Louvor', ordem: 2 },
    { id: 'seg-3', nome: 'Pregação', ordem: 3 },
    { id: 'seg-4', nome: 'Encerramento', ordem: 4 },
  ];

  const membroGleison = { id: 'membro-gleison', nome: 'Gleison Silva' };
  const membroThaynara = { id: 'membro-thaynara', nome: 'Thaynara Ramos' };
  const membroCarlos = { id: 'membro-carlos', nome: 'Carlos Eduardo' };
  const membroMessias = { id: 'membro-messias', nome: 'Messias Gomes' };

  const funcaoMinistro: FuncaoComSegmentos = {
    id: 'f-ministro',
    nome: 'Ministro de Louvor',
    ministerioNome: 'Louvor',
    localAtuacao: 'Palco',
    segmentos: [{ id: 'seg-2', nome: 'Louvor', ordem: 2 }],
  };

  const funcaoViolao: FuncaoComSegmentos = {
    id: 'f-violao',
    nome: 'Violão',
    ministerioNome: 'Louvor',
    localAtuacao: 'Palco',
    segmentos: [{ id: 'seg-2', nome: 'Louvor', ordem: 2 }],
  };

  const funcaoBaixo: FuncaoComSegmentos = {
    id: 'f-baixo',
    nome: 'Baixo',
    ministerioNome: 'Louvor',
    localAtuacao: 'Palco',
    segmentos: [{ id: 'seg-2', nome: 'Louvor', ordem: 2 }],
  };

  const funcaoMesaSom: FuncaoComSegmentos = {
    id: 'f-mesa-som',
    nome: 'Mesa de Som',
    ministerioNome: 'Mídia',
    localAtuacao: 'Cabine de Som',
    segmentos: [{ id: 'seg-2', nome: 'Louvor', ordem: 2 }],
  };

  const funcaoPregador: FuncaoComSegmentos = {
    id: 'f-pregador',
    nome: 'Pregador',
    ministerioNome: 'Pastoral',
    localAtuacao: 'Púlpito',
    segmentos: [{ id: 'seg-3', nome: 'Pregação', ordem: 3 }],
  };

  const funcaoBack: FuncaoComSegmentos = {
    id: 'f-back',
    nome: 'Back Vocal',
    ministerioNome: 'Louvor',
    localAtuacao: 'Palco',
    segmentos: [{ id: 'seg-2', nome: 'Louvor', ordem: 2 }],
  };

  const funcaoProfessoraInfantil: FuncaoComSegmentos = {
    id: 'f-professora',
    nome: 'Professora',
    ministerioNome: 'Ministério Infantil',
    localAtuacao: 'Salinha Infantil',
    segmentos: [{ id: 'seg-3', nome: 'Pregação', ordem: 3 }],
  };

  describe('normalizarParFuncoes', () => {
    it('sempre retorna o par ordenado alfabeticamente', () => {
      expect(normalizarParFuncoes('abc', 'xyz')).toEqual(['abc', 'xyz']);
      expect(normalizarParFuncoes('xyz', 'abc')).toEqual(['abc', 'xyz']);
    });
  });

  describe('1. Mesma função na mesma escala/evento', () => {
    it('bloqueia alocação da mesma função para a mesma pessoa', () => {
      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: membroGleison.id,
          membroNome: membroGleison.nome,
          funcao: funcaoMinistro,
        },
        itensExistentes: [
          {
            id: 'item-1',
            membroId: membroGleison.id,
            membroNome: membroGleison.nome,
            funcao: funcaoMinistro,
          },
        ],
        regrasMatriz: [],
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.bloqueios).toHaveLength(1);
      expect(resultado.bloqueios[0].motivo).toBe('FUNCAO_REPETIDA');
      expect(resultado.bloqueios[0].tipo).toBe('BLOQUEIO');
      expect(resultado.requerConfirmacao).toBe(false);
    });

    it('ignora itens de outros membros', () => {
      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: membroGleison.id,
          membroNome: membroGleison.nome,
          funcao: funcaoMinistro,
        },
        itensExistentes: [
          {
            id: 'item-outro',
            membroId: 'outro-membro-id',
            membroNome: 'Outro Irmão',
            funcao: funcaoMinistro,
          },
        ],
        regrasMatriz: [],
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(true);
      expect(resultado.bloqueios).toHaveLength(0);
      expect(resultado.avisos).toHaveLength(0);
    });
  });

  describe('2. Segmentos sem sobreposição', () => {
    it('permite funções com segmentos distintos sem necessidade de regra na matriz', () => {
      // Carlos: Louvor (seg-2) e Pregador (seg-3)
      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: membroCarlos.id,
          membroNome: membroCarlos.nome,
          funcao: funcaoPregador, // local: Púlpito, seg: 3
        },
        itensExistentes: [
          {
            id: 'item-carlos-1',
            membroId: membroCarlos.id,
            membroNome: membroCarlos.nome,
            funcao: {
              ...funcaoViolao,
              localAtuacao: 'Palco', // ordem 2, local Palco
            },
          },
        ],
        regrasMatriz: [],
        segmentosDoTenant: segmentosPadrao,
      });

      // Nota: seg 2 e seg 3 são consecutivos e locais diferentes (Palco -> Púlpito)
      // portanto gera AVISO de transição de local, mas não bloqueio!
      expect(resultado.bloqueios).toHaveLength(0);
      expect(resultado.avisos).toHaveLength(1);
      expect(resultado.avisos[0].motivo).toBe('TRANSICAO_LOCAL');
      expect(resultado.requerConfirmacao).toBe(true);
    });

    it('permite sem qualquer aviso se segmentos não forem adjacentes', () => {
      const funcaoAbertura: FuncaoComSegmentos = {
        id: 'f-abertura',
        nome: 'Dirigente',
        localAtuacao: 'Palco',
        segmentos: [{ id: 'seg-1', nome: 'Abertura', ordem: 1 }],
      };

      const funcaoEncerramento: FuncaoComSegmentos = {
        id: 'f-encerramento',
        nome: 'Oração Final',
        localAtuacao: 'Púlpito',
        segmentos: [{ id: 'seg-4', nome: 'Encerramento', ordem: 4 }],
      };

      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: membroCarlos.id,
          membroNome: membroCarlos.nome,
          funcao: funcaoEncerramento,
        },
        itensExistentes: [
          {
            id: 'item-1',
            membroId: membroCarlos.id,
            funcao: funcaoAbertura,
          },
        ],
        regrasMatriz: [],
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(true);
      expect(resultado.bloqueios).toHaveLength(0);
      expect(resultado.avisos).toHaveLength(0);
      expect(resultado.requerConfirmacao).toBe(false);
    });
  });

  describe('3. Sobreposição de segmentos e Matriz de Compatibilidade', () => {
    it('bloqueia com SEM_REGRA quando segmentos se sobrepõem e não há regra cadastrada', () => {
      // Messias: Baixo (Louvor) + Mesa de Som (Louvor)
      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: membroMessias.id,
          membroNome: membroMessias.nome,
          funcao: funcaoMesaSom,
        },
        itensExistentes: [
          {
            id: 'item-1',
            membroId: membroMessias.id,
            membroNome: membroMessias.nome,
            funcao: funcaoBaixo,
          },
        ],
        regrasMatriz: [], // nenhuma regra
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.bloqueios).toHaveLength(1);
      expect(resultado.bloqueios[0].motivo).toBe('SEM_REGRA');
      expect(resultado.bloqueios[0].tipo).toBe('BLOQUEIO');
      expect(resultado.bloqueios[0].segmentosEmComum).toContain('Louvor');
      expect(resultado.requerConfirmacao).toBe(false);
    });

    it('permite alocação com regra PERMITIR na matriz (ex.: Ministro + Violão para Gleison)', () => {
      const regras: RegraCompatibilidadePar[] = [
        {
          funcaoAId: funcaoMinistro.id,
          funcaoBId: funcaoViolao.id,
          regra: 'PERMITIR',
          observacao: 'Ministro pode tocar violão simultaneamente',
        },
      ];

      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: membroGleison.id,
          membroNome: membroGleison.nome,
          funcao: funcaoViolao,
        },
        itensExistentes: [
          {
            id: 'item-1',
            membroId: membroGleison.id,
            membroNome: membroGleison.nome,
            funcao: funcaoMinistro,
          },
        ],
        regrasMatriz: regras,
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(true);
      expect(resultado.bloqueios).toHaveLength(0);
      expect(resultado.avisos).toHaveLength(0);
      expect(resultado.requerConfirmacao).toBe(false);
    });

    it('funciona comutatividade da regra quando IDs foram cadastrados em ordem inversa', () => {
      // Regra cadastrada com funcaoA e funcaoB trocados
      const regras: RegraCompatibilidadePar[] = [
        {
          funcaoAId: 'zzz-maior',
          funcaoBId: 'aaa-menor',
          regra: 'PERMITIR',
        },
      ];

      const f1: FuncaoComSegmentos = {
        id: 'aaa-menor',
        nome: 'Função A',
        segmentos: [{ id: 'seg-1', nome: 'Abertura', ordem: 1 }],
      };
      const f2: FuncaoComSegmentos = {
        id: 'zzz-maior',
        nome: 'Função B',
        segmentos: [{ id: 'seg-1', nome: 'Abertura', ordem: 1 }],
      };

      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: 'membro-1',
          funcao: f2,
        },
        itensExistentes: [
          {
            id: 'it-1',
            membroId: 'membro-1',
            funcao: f1,
          },
        ],
        regrasMatriz: regras,
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(true);
    });

    it('gera AVISO com REGRA_AVISAR quando matriz define regra AVISAR', () => {
      const regras: RegraCompatibilidadePar[] = [
        {
          funcaoAId: funcaoMinistro.id,
          funcaoBId: funcaoBaixo.id,
          regra: 'AVISAR',
          observacao: 'Ministro tocando baixo requer atenção à dinâmica',
        },
      ];

      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: membroGleison.id,
          membroNome: membroGleison.nome,
          funcao: funcaoBaixo,
        },
        itensExistentes: [
          {
            id: 'item-1',
            membroId: membroGleison.id,
            membroNome: membroGleison.nome,
            funcao: funcaoMinistro,
          },
        ],
        regrasMatriz: regras,
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.requerConfirmacao).toBe(true);
      expect(resultado.bloqueios).toHaveLength(0);
      expect(resultado.avisos).toHaveLength(1);
      expect(resultado.avisos[0].motivo).toBe('REGRA_AVISAR');
    });
  });

  describe('4. Transição consecutiva com locais de atuação', () => {
    it('gera AVISO de transição de local quando segmentos são adjacentes e locais distintos (Thaynara)', () => {
      // Thaynara: Back (Louvor, Palco, ordem 2) -> Professora (Infantil, Salinha, ordem 3)
      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: membroThaynara.id,
          membroNome: membroThaynara.nome,
          funcao: funcaoProfessoraInfantil,
        },
        itensExistentes: [
          {
            id: 'item-thaynara-1',
            membroId: membroThaynara.id,
            membroNome: membroThaynara.nome,
            funcao: funcaoBack,
          },
        ],
        regrasMatriz: [],
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.bloqueios).toHaveLength(0);
      expect(resultado.avisos).toHaveLength(1);
      expect(resultado.avisos[0].motivo).toBe('TRANSICAO_LOCAL');
      expect(resultado.avisos[0].localOrigem).toBe('Palco');
      expect(resultado.avisos[0].localDestino).toBe('Salinha Infantil');
      expect(resultado.requerConfirmacao).toBe(true);
    });

    it('não gera aviso de transição se os locais forem iguais', () => {
      const funcaoPalco1: FuncaoComSegmentos = {
        id: 'f-palco-1',
        nome: 'Abertura Palco',
        localAtuacao: 'Palco',
        segmentos: [{ id: 'seg-1', nome: 'Abertura', ordem: 1 }],
      };
      const funcaoPalco2: FuncaoComSegmentos = {
        id: 'f-palco-2',
        nome: 'Louvor Palco',
        localAtuacao: 'Palco',
        segmentos: [{ id: 'seg-2', nome: 'Louvor', ordem: 2 }],
      };

      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: 'membro-1',
          funcao: funcaoPalco2,
        },
        itensExistentes: [
          {
            id: 'it-1',
            membroId: 'membro-1',
            funcao: funcaoPalco1,
          },
        ],
        regrasMatriz: [],
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(true);
      expect(resultado.avisos).toHaveLength(0);
      expect(resultado.bloqueios).toHaveLength(0);
    });

    it('não gera aviso de transição se algum local estiver vazio', () => {
      const funcaoSemLocal: FuncaoComSegmentos = {
        id: 'f-sem-local',
        nome: 'Avisos Gerais',
        localAtuacao: null,
        segmentos: [{ id: 'seg-1', nome: 'Abertura', ordem: 1 }],
      };

      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: 'membro-1',
          funcao: funcaoBack, // Palco, ordem 2
        },
        itensExistentes: [
          {
            id: 'it-1',
            membroId: 'membro-1',
            funcao: funcaoSemLocal, // ordem 1, local null
          },
        ],
        regrasMatriz: [],
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(true);
      expect(resultado.avisos).toHaveLength(0);
    });
  });

  describe('5. Funções sem segmentos cadastrados (Fallback Conservador)', () => {
    it('trata função sem segmentos como atuando em todos os segmentos do tenant', () => {
      const funcaoGenerica: FuncaoComSegmentos = {
        id: 'f-generica',
        nome: 'Apoio Geral',
        segmentos: [], // vazio = todos
      };

      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: 'membro-1',
          funcao: funcaoGenerica,
        },
        itensExistentes: [
          {
            id: 'it-1',
            membroId: 'membro-1',
            funcao: funcaoMinistro, // Louvor (seg-2)
          },
        ],
        regrasMatriz: [],
        segmentosDoTenant: segmentosPadrao,
      });

      // Como f-generica atua em todos os segmentos, ela sobrepõe seg-2 (Louvor). Sem regra = BLOQUEIO
      expect(resultado.valido).toBe(false);
      expect(resultado.bloqueios).toHaveLength(1);
      expect(resultado.bloqueios[0].motivo).toBe('SEM_REGRA');
    });

    it('se ambas as funções não tiverem segmentos cadastrados, sobrepõem e bloqueiam', () => {
      const fA: FuncaoComSegmentos = { id: 'fa', nome: 'Função A', segmentos: [] };
      const fB: FuncaoComSegmentos = { id: 'fb', nome: 'Função B', segmentos: [] };

      const resultado = validarConflitosEscala({
        novaAlocacao: { membroId: 'm-1', funcao: fB },
        itensExistentes: [{ id: 'it-1', membroId: 'm-1', funcao: fA }],
        regrasMatriz: [],
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.bloqueios[0].motivo).toBe('SEM_REGRA');
    });
  });

  describe('6. Escopo de Eventos no mesmo dia', () => {
    it('permite escalas em eventos com horários distintos no mesmo dia (ex.: EBD manhã e Culto noite)', () => {
      const eventoManha = {
        id: 'ev-ebd',
        dataInicio: '2026-10-18T09:00:00.000Z',
        dataFim: '2026-10-18T11:00:00.000Z',
      };

      const eventoNoite = {
        id: 'ev-culto',
        dataInicio: '2026-10-18T19:00:00.000Z',
        dataFim: '2026-10-18T21:00:00.000Z',
      };

      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: 'membro-lidia',
          membroNome: 'Lídia',
          funcao: funcaoBack,
          evento: eventoNoite,
        },
        itensExistentes: [
          {
            id: 'it-ebd',
            membroId: 'membro-lidia',
            membroNome: 'Lídia',
            funcao: funcaoProfessoraInfantil,
            evento: eventoManha,
          },
        ],
        regrasMatriz: [],
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(true);
      expect(resultado.bloqueios).toHaveLength(0);
      expect(resultado.avisos).toHaveLength(0);
    });

    it('aplica validação normalmente se eventos tiverem horários sobrepostos', () => {
      const eventoA = {
        id: 'ev-a',
        dataInicio: '2026-10-18T19:00:00.000Z',
        dataFim: '2026-10-18T21:00:00.000Z',
      };

      const eventoB = {
        id: 'ev-b',
        dataInicio: '2026-10-18T20:00:00.000Z',
        dataFim: '2026-10-18T22:00:00.000Z',
      };

      const resultado = validarConflitosEscala({
        novaAlocacao: {
          membroId: 'membro-1',
          funcao: funcaoViolao,
          evento: eventoB,
        },
        itensExistentes: [
          {
            id: 'it-1',
            membroId: 'membro-1',
            funcao: funcaoMinistro,
            evento: eventoA,
          },
        ],
        regrasMatriz: [],
        segmentosDoTenant: segmentosPadrao,
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.bloqueios).toHaveLength(1);
      expect(resultado.bloqueios[0].motivo).toBe('SEM_REGRA');
    });
  });
});
