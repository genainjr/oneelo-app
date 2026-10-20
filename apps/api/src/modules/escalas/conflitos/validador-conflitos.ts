export type TipoConflito = 'BLOQUEIO' | 'AVISO';

export type MotivoConflito =
  | 'FUNCAO_REPETIDA'
  | 'SEM_REGRA'
  | 'REGRA_AVISAR'
  | 'TRANSICAO_LOCAL';

export interface ConflitoEscala {
  tipo: TipoConflito;
  motivo: MotivoConflito;
  membroNome: string;
  funcaoExistenteId: string;
  funcaoExistenteNome: string;
  ministerioExistenteNome: string;
  funcaoNovaId: string;
  funcaoNovaNome: string;
  ministerioNovoNome: string;
  segmentosEmComum?: string[];
  localOrigem?: string;
  localDestino?: string;
  mensagem: string;
}

export interface ResultadoValidacaoConflito {
  valido: boolean;
  requerConfirmacao: boolean;
  bloqueios: ConflitoEscala[];
  avisos: ConflitoEscala[];
  conflitos: ConflitoEscala[];
}

export interface SegmentoInfo {
  id: string;
  nome: string;
  ordem: number;
}

export interface FuncaoComSegmentos {
  id: string;
  nome: string;
  ministerioNome?: string;
  localAtuacao?: string | null;
  segmentos: SegmentoInfo[];
}

export interface EventoInfo {
  id: string;
  dataInicio: Date | string;
  dataFim?: Date | string | null;
}

export interface ItemEscalaExistente {
  id: string;
  membroId: string;
  membroNome?: string;
  funcao: FuncaoComSegmentos;
  evento?: EventoInfo | null;
}

export interface NovaAlocacao {
  membroId: string;
  membroNome?: string;
  funcao: FuncaoComSegmentos;
  evento?: EventoInfo | null;
}

export interface RegraCompatibilidadePar {
  funcaoAId: string;
  funcaoBId: string;
  regra: 'PERMITIR' | 'AVISAR';
  observacao?: string | null;
}

export interface ValidarConflitosParams {
  novaAlocacao: NovaAlocacao;
  itensExistentes: ItemEscalaExistente[];
  regrasMatriz: RegraCompatibilidadePar[];
  segmentosDoTenant: SegmentoInfo[];
}

export function normalizarParFuncoes(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

function eventosNaoSeSobrepoem(
  eventoA?: EventoInfo | null,
  eventoB?: EventoInfo | null,
): boolean {
  if (!eventoA || !eventoB || eventoA.id === eventoB.id) {
    return false;
  }

  const inicioA = new Date(eventoA.dataInicio).getTime();
  const fimA = eventoA.dataFim ? new Date(eventoA.dataFim).getTime() : inicioA;
  const inicioB = new Date(eventoB.dataInicio).getTime();
  const fimB = eventoB.dataFim ? new Date(eventoB.dataFim).getTime() : inicioB;

  if (Number.isNaN(inicioA) || Number.isNaN(inicioB)) {
    return false;
  }

  return fimA <= inicioB || fimB <= inicioA;
}

function resolverSegmentosEfetivos(
  funcao: FuncaoComSegmentos,
  segmentosDoTenant: SegmentoInfo[],
): SegmentoInfo[] {
  if (funcao.segmentos && funcao.segmentos.length > 0) {
    return [...funcao.segmentos].sort((a, b) => a.ordem - b.ordem);
  }
  if (segmentosDoTenant && segmentosDoTenant.length > 0) {
    return [...segmentosDoTenant].sort((a, b) => a.ordem - b.ordem);
  }
  return [{ id: '__default_all__', nome: 'Culto', ordem: 1 }];
}

export function validarConflitosEscala({
  novaAlocacao,
  itensExistentes,
  regrasMatriz,
  segmentosDoTenant,
}: ValidarConflitosParams): ResultadoValidacaoConflito {
  const bloqueios: ConflitoEscala[] = [];
  const avisos: ConflitoEscala[] = [];

  const mapaRegras = new Map<string, RegraCompatibilidadePar>();
  for (const regra of regrasMatriz) {
    const [minId, maxId] = normalizarParFuncoes(regra.funcaoAId, regra.funcaoBId);
    mapaRegras.set(`${minId}:${maxId}`, regra);
  }

  const membroNome = novaAlocacao.membroNome || 'Membro';
  const funcaoNovaNome = novaAlocacao.funcao.nome;
  const ministerioNovoNome = novaAlocacao.funcao.ministerioNome || 'Ministério';

  const segsNova = resolverSegmentosEfetivos(novaAlocacao.funcao, segmentosDoTenant);

  for (const item of itensExistentes) {
    if (item.membroId !== novaAlocacao.membroId) {
      continue;
    }

    if (eventosNaoSeSobrepoem(item.evento, novaAlocacao.evento)) {
      continue;
    }

    const funcaoExistenteNome = item.funcao.nome;
    const ministerioExistenteNome = item.funcao.ministerioNome || 'Outro ministério';

    if (item.funcao.id === novaAlocacao.funcao.id) {
      bloqueios.push({
        tipo: 'BLOQUEIO',
        motivo: 'FUNCAO_REPETIDA',
        membroNome,
        funcaoExistenteId: item.funcao.id,
        funcaoExistenteNome,
        ministerioExistenteNome,
        funcaoNovaId: novaAlocacao.funcao.id,
        funcaoNovaNome,
        ministerioNovoNome,
        mensagem: `${membroNome} já está escalado(a) na função ${funcaoNovaNome} em ${ministerioNovoNome} neste culto/evento.`,
      });
      continue;
    }

    const segsExistente = resolverSegmentosEfetivos(item.funcao, segmentosDoTenant);

    const idsSegsExistente = new Set(segsExistente.map((s) => s.id));
    const segmentosEmComum = segsNova.filter((s) => idsSegsExistente.has(s.id));

    if (segmentosEmComum.length > 0) {
      const [minId, maxId] = normalizarParFuncoes(item.funcao.id, novaAlocacao.funcao.id);
      const regra = mapaRegras.get(`${minId}:${maxId}`);

      if (!regra) {
        bloqueios.push({
          tipo: 'BLOQUEIO',
          motivo: 'SEM_REGRA',
          membroNome,
          funcaoExistenteId: item.funcao.id,
          funcaoExistenteNome,
          ministerioExistenteNome,
          funcaoNovaId: novaAlocacao.funcao.id,
          funcaoNovaNome,
          ministerioNovoNome,
          segmentosEmComum: segmentosEmComum.map((s) => s.nome),
          mensagem: `${membroNome} já está escalado(a) como ${funcaoExistenteNome} (${ministerioExistenteNome}) e as funções não possuem regra de compatibilidade para os momentos em comum (${segmentosEmComum.map((s) => s.nome).join(', ')}).`,
        });
      } else if (regra.regra === 'AVISAR') {
        avisos.push({
          tipo: 'AVISO',
          motivo: 'REGRA_AVISAR',
          membroNome,
          funcaoExistenteId: item.funcao.id,
          funcaoExistenteNome,
          ministerioExistenteNome,
          funcaoNovaId: novaAlocacao.funcao.id,
          funcaoNovaNome,
          ministerioNovoNome,
          segmentosEmComum: segmentosEmComum.map((s) => s.nome),
          mensagem: `${membroNome} atuará simultaneamente como ${funcaoExistenteNome} (${ministerioExistenteNome}) e ${funcaoNovaNome} (${ministerioNovoNome}) nos segmentos: ${segmentosEmComum.map((s) => s.nome).join(', ')}.`,
        });
      }
      continue;
    }

    const localExistente = (item.funcao.localAtuacao || '').trim();
    const localNovo = (novaAlocacao.funcao.localAtuacao || '').trim();

    if (localExistente && localNovo && localExistente.toLowerCase() !== localNovo.toLowerCase()) {
      let transicaoDetectada: { segOrigem: SegmentoInfo; segDestino: SegmentoInfo; direcao: 'existente_para_novo' | 'novo_para_existente' } | null = null;

      for (const segE of segsExistente) {
        for (const segN of segsNova) {
          if (segE.ordem + 1 === segN.ordem) {
            transicaoDetectada = { segOrigem: segE, segDestino: segN, direcao: 'existente_para_novo' };
            break;
          }
          if (segN.ordem + 1 === segE.ordem) {
            transicaoDetectada = { segOrigem: segN, segDestino: segE, direcao: 'novo_para_existente' };
            break;
          }
        }
        if (transicaoDetectada) break;
      }

      if (transicaoDetectada) {
        const localOrigem = transicaoDetectada.direcao === 'existente_para_novo' ? localExistente : localNovo;
        const localDestino = transicaoDetectada.direcao === 'existente_para_novo' ? localNovo : localExistente;
        const funcaoOrigem = transicaoDetectada.direcao === 'existente_para_novo' ? funcaoExistenteNome : funcaoNovaNome;
        const funcaoDestino = transicaoDetectada.direcao === 'existente_para_novo' ? funcaoNovaNome : funcaoExistenteNome;

        avisos.push({
          tipo: 'AVISO',
          motivo: 'TRANSICAO_LOCAL',
          membroNome,
          funcaoExistenteId: item.funcao.id,
          funcaoExistenteNome,
          ministerioExistenteNome,
          funcaoNovaId: novaAlocacao.funcao.id,
          funcaoNovaNome,
          ministerioNovoNome,
          localOrigem,
          localDestino,
          mensagem: `${membroNome} atua em segmentos consecutivos com troca de local: ${localOrigem} (${funcaoOrigem}) → ${localDestino} (${funcaoDestino}).`,
        });
      }
    }
  }

  const conflitos = [...bloqueios, ...avisos];
  const valido = bloqueios.length === 0 && avisos.length === 0;
  const requerConfirmacao = bloqueios.length === 0 && avisos.length > 0;

  return {
    valido,
    requerConfirmacao,
    bloqueios,
    avisos,
    conflitos,
  };
}
