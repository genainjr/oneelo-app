// apps/api/prisma/seed.ts

import { PrismaClient, Plano, StatusAssinatura, Role, StatusMembro, StatusEscala, StatusConfirmacao, StatusEvento } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetando banco de dados...');
  
  // Limpar tabelas na ordem correta devido a chaves estrangeiras
  await prisma.auditLog.deleteMany();
  await prisma.escalaItem.deleteMany();
  await prisma.escalaDia.deleteMany();
  await prisma.escala.deleteMany();
  await prisma.evento.deleteMany();
  await prisma.ministerioFuncao.deleteMany();
  await prisma.ministerioMembro.deleteMany();
  await prisma.ministerioLider.deleteMany();
  await prisma.ministerio.deleteMany();
  await prisma.membroTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.membro.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  console.log('Banco de dados resetado com sucesso!');

  // 1. Criar Tenant
  console.log('Criando Tenant Piloto...');
  const tenant = await prisma.tenant.create({
    data: {
      nome: 'Comunidade Cristã Resgate de Vida',
      slug: 'Resgatando Vidas',
      plano: Plano.PROFISSIONAL,
      statusAssinatura: StatusAssinatura.ATIVA,
      limiteMembros: 100,
      ativo: true,
    },
  });

  // 2. Criar Senhas Hashed
  const salt = await bcrypt.genSalt(10);
  const senhaHashAdmin = await bcrypt.hash('admin123', salt);
  const senhaHashPastor = await bcrypt.hash('pastor123', salt);
  const senhaHashLider = await bcrypt.hash('lider123', salt);
  const senhaHashSecretario = await bcrypt.hash('secretario123', salt);
  const senhaHashMembro = await bcrypt.hash('membro123', salt);

  // 3. Criar Usuários (Users)
  console.log('Criando Usuários...');
  const adminUser = await prisma.user.create({
    data: { tenantId: tenant.id, nome: 'Admin Geral', email: 'admin@ccrv.com', senhaHash: senhaHashAdmin, role: Role.ADMIN_GERAL },
  });
  const pastorUser = await prisma.user.create({
    data: { tenantId: tenant.id, nome: 'Pr. Carlos', email: 'pastor@ccrv.com', senhaHash: senhaHashPastor, role: Role.PASTOR },
  });
  const liderUser = await prisma.user.create({
    data: { tenantId: tenant.id, nome: 'Mariana Louvor', email: 'lider@ccrv.com', senhaHash: senhaHashLider, role: Role.LIDER_MINISTERIO },
  });
  const secretarioUser = await prisma.user.create({
    data: { tenantId: tenant.id, nome: 'Lucas Secretaria', email: 'secretario@ccrv.com', senhaHash: senhaHashSecretario, role: Role.SECRETARIO },
  });
  const membroUser = await prisma.user.create({
    data: { tenantId: tenant.id, nome: 'Membro Teste', email: 'membro@ccrv.com', senhaHash: senhaHashMembro, role: Role.MEMBRO },
  });

  // Carregar dados reais
  const seedDataPath = path.join(__dirname, 'seedData.json');
  const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf-8'));

  // 4. Criar Tags
  console.log('Criando Tags...');
  const tagsData = [
    { nome: 'Jovens', corHex: '#3b82f6' },
    { nome: 'Músicos', corHex: '#10b981' },
    { nome: 'Batizados', corHex: '#6366f1' },
    { nome: 'Visitantes', corHex: '#f59e0b' },
    { nome: 'Liderança', corHex: '#ef4444' },
    { nome: 'Casados', corHex: '#ec4899' },
    { nome: 'Discipulado', corHex: '#8b5cf6' },
  ];

  // Adicionar tags vindas da planilha
  const coresExtra = ['#64748b', '#78716c', '#0ea5e9', '#8b5cf6', '#d946ef', '#f43f5e', '#eab308', '#22c55e', '#14b8a6'];
  let colorIndex = 0;
  for (const t of seedData.tags || []) {
    if (!tagsData.find(x => x.nome.toUpperCase() === t.toUpperCase())) {
      tagsData.push({ nome: t, corHex: coresExtra[colorIndex % coresExtra.length] });
      colorIndex++;
    }
  }

  const tags: Record<string, any> = {};
  for (const tag of tagsData) {
    tags[tag.nome.toUpperCase()] = await prisma.tag.create({
      data: { tenantId: tenant.id, nome: tag.nome, corHex: tag.corHex },
    });
  }

  // 5. Criar Ministérios
  console.log('Criando Ministérios...');
  const ministerios: Record<string, any> = {};

  // Vamos garantir que todos os ministérios do JSON sejam criados, 
  // mais alguns fixos para manter compatibilidade com outras lógicas, se necessário.
  const nomesMinisteriosParaCriar = Array.from(new Set([
    ...seedData.ministerios,
    'Mídia', 'Recepção'
  ]));

  for (const nomeMin of nomesMinisteriosParaCriar) {
    ministerios[nomeMin as string] = await prisma.ministerio.create({
      data: { tenantId: tenant.id, nome: nomeMin as string, descricao: `Ministério de ${nomeMin}`, ativo: true },
    });
  }

  // Associar Líder ao Ministério de Louvor se existir
  if (ministerios['Louvor']) {
    await prisma.ministerioLider.create({
      data: { ministerioId: ministerios['Louvor'].id, userId: liderUser.id },
    });
  }

  // 6. Criar Membros reais e alocar em ministérios
  console.log('Criando Membros a partir da planilha e associando aos Ministérios...');
  const membrosCriados: any[] = [];
  
  for (let i = 0; i < seedData.membros.length; i++) {
    const memData = seedData.membros[i];
    const nome = memData.nome;
    const whatsapp = memData.telefone ? memData.telefone : null;
    const email = `${nome.toLowerCase().replace(/[^a-z0-9]/g, '')}${i}@example.com`;
    const status = StatusMembro.ATIVO;
    
    // Data de nascimento vinda do excel ou undefined
    let dataNascimento: Date | undefined;
    if (memData.dataNascimento) {
      dataNascimento = new Date(memData.dataNascimento);
    }

    const membro = await prisma.membro.create({
      data: {
        tenantId: tenant.id,
        nome,
        ...(whatsapp && { whatsapp }),
        email,
        ...(dataNascimento && { dataNascimento }),
        status,
        observacoes: `Membro inserido via importação do arquivo. Número sequencial: ${i + 1}`,
      },
    });

    membrosCriados.push(membro);

    // Associação de Tags vindas do excel
    if (memData.tags && memData.tags.length > 0) {
      for (const t of memData.tags) {
        const tagUpper = t.toUpperCase();
        if (tags[tagUpper]) {
          await prisma.membroTag.create({ data: { membroId: membro.id, tagId: tags[tagUpper].id } });
        }
      }
    }

    // Associação aos Ministérios Reais
    for (const minNome of memData.ministerios) {
      if (ministerios[minNome]) {
        await prisma.ministerioMembro.create({
          data: {
            ministerioId: ministerios[minNome].id,
            membroId: membro.id
          }
        });
        
        // Se entrou no Louvor, ganha tag de músicos também para ajudar nos filtros
        if (minNome === 'Louvor') {
          // verificar se ja tem a tag para n dar erro
          const jaTemTag = await prisma.membroTag.findFirst({
            where: { membroId: membro.id, tagId: tags['MÚSICOS'].id }
          });
          if (!jaTemTag) {
            await prisma.membroTag.create({ data: { membroId: membro.id, tagId: tags['MÚSICOS'].id } });
          }
        }
      }
    }
  }

  // 6.5. Criar Funções dos Ministérios
  console.log('Criando Funções (Cargos) dos Ministérios...');
  const funcoesDict: Record<string, any> = {};

  const funcoesBase = {
    'Louvor': ['Ministro', 'Back 1', 'Back 2', 'Violão', 'Guitarra', 'Teclado', 'Baixo', 'Bateria', 'Mesa', 'Letra'],
    'Obreiros': ['Portaria', 'Limpeza', 'Salão 1', 'Salão 2', 'Salão 3'],
    'Infantil': ['2-3 anos', '4-6 anos', '7-9 anos']
  };

  for (const [minNome, nomesFunc] of Object.entries(funcoesBase)) {
    if (ministerios[minNome]) {
      for (let idx = 0; idx < nomesFunc.length; idx++) {
        const fNome = nomesFunc[idx];
        const func = await prisma.ministerioFuncao.create({
          data: {
            ministerioId: ministerios[minNome].id,
            nome: fNome,
            ordem: idx
          }
        });
        funcoesDict[`${minNome}-${fNome}`] = func;
      }
    }
  }

  // 7. Criar Escalas Mensais
  console.log('Criando Escalas e Itens (Visão Mensal)...');
  
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  const escalaMensalLouvor = await prisma.escala.create({
    data: {
      tenantId: tenant.id,
      ministerioId: ministerios['Louvor'].id,
      mes: mesAtual,
      ano: anoAtual,
      status: StatusEscala.PUBLICADA,
      observacoes: 'Escala mensal gerada automaticamente.'
    },
  });

  const proximoDomingo = new Date();
  proximoDomingo.setDate(hoje.getDate() + (7 - hoje.getDay()));
  proximoDomingo.setHours(18, 0, 0, 0);

  const escalaDia1 = await prisma.escalaDia.create({
    data: {
      escalaId: escalaMensalLouvor.id,
      data: proximoDomingo,
      titulo: 'Culto da Família'
    }
  });

  const domingoSeguinte = new Date(proximoDomingo);
  domingoSeguinte.setDate(proximoDomingo.getDate() + 7);
  const escalaDia2 = await prisma.escalaDia.create({
    data: {
      escalaId: escalaMensalLouvor.id,
      data: domingoSeguinte,
      titulo: 'Culto de Celebração'
    }
  });

  // Encontrar alguns membros do Louvor usando os dados inseridos
  const musicosMembros = await prisma.membro.findMany({
    where: { ministerios: { some: { ministerioId: ministerios['Louvor'].id } } },
    take: 4
  });

  // Escala Itens
  if (musicosMembros[0] && funcoesDict['Louvor-Ministro']) {
    await prisma.escalaItem.create({
      data: { escalaDiaId: escalaDia1.id, membroId: musicosMembros[0].id, ministerioFuncaoId: funcoesDict['Louvor-Ministro'].id, statusConfirmacao: StatusConfirmacao.CONFIRMADO },
    });
  }
  if (musicosMembros[1] && funcoesDict['Louvor-Teclado']) {
    await prisma.escalaItem.create({
      data: { escalaDiaId: escalaDia1.id, membroId: musicosMembros[1].id, ministerioFuncaoId: funcoesDict['Louvor-Teclado'].id, statusConfirmacao: StatusConfirmacao.CONFIRMADO },
    });
  }
  if (musicosMembros[2] && funcoesDict['Louvor-Bateria']) {
    await prisma.escalaItem.create({
      data: { escalaDiaId: escalaDia1.id, membroId: musicosMembros[2].id, ministerioFuncaoId: funcoesDict['Louvor-Bateria'].id, statusConfirmacao: StatusConfirmacao.PENDENTE },
    });
  }
  if (musicosMembros[3] && funcoesDict['Louvor-Back 1']) {
    await prisma.escalaItem.create({
      data: { escalaDiaId: escalaDia2.id, membroId: musicosMembros[3].id, ministerioFuncaoId: funcoesDict['Louvor-Back 1'].id, statusConfirmacao: StatusConfirmacao.RECUSADO, observacoes: 'Viajando a trabalho' },
    });
  }

  // 8. Criar Eventos (Agenda)
  console.log('Criando Eventos...');
  
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);
  amanha.setHours(19, 30, 0, 0);
  const amanhaFim = new Date(amanha);
  amanhaFim.setHours(21, 30, 0, 0);

  await prisma.evento.create({
    data: {
      tenantId: tenant.id,
      titulo: 'Culto de Ensino',
      descricao: 'Estudo bíblico semanal na igreja sede.',
      dataInicio: amanha,
      dataFim: amanhaFim,
      local: 'Santuário Principal',
      status: StatusEvento.AGENDADO,
    },
  });

  const quartaFeira = new Date(hoje);
  quartaFeira.setDate(hoje.getDate() + (3 - hoje.getDay() + 7) % 7);
  quartaFeira.setHours(20, 0, 0, 0);
  const quartaFeiraFim = new Date(quartaFeira);
  quartaFeiraFim.setHours(22, 0, 0, 0);

  await prisma.evento.create({
    data: {
      tenantId: tenant.id,
      titulo: 'Ensaio Geral do Louvor',
      descricao: 'Ensaio semanal dos músicos escalados para o final de semana.',
      dataInicio: quartaFeira,
      dataFim: quartaFeiraFim,
      local: 'Santuário Principal',
      status: StatusEvento.AGENDADO,
    },
  });

  const proximoSabado = new Date(hoje);
  proximoSabado.setDate(hoje.getDate() + (6 - hoje.getDay() + 7) % 7);
  proximoSabado.setHours(19, 0, 0, 0);
  const proximoSabadoFim = new Date(proximoSabado);
  proximoSabadoFim.setHours(22, 0, 0, 0);

  await prisma.evento.create({
    data: {
      tenantId: tenant.id,
      titulo: 'Culto de Jovens - Conexão',
      descricao: 'Programação mensal liderada pela juventude.',
      dataInicio: proximoSabado,
      dataFim: proximoSabadoFim,
      local: 'Salão Social',
      status: StatusEvento.AGENDADO,
    },
  });

  console.log('Seed do banco de dados concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
