// apps/api/prisma/seed.ts

import { PrismaClient, Plano, StatusAssinatura, Role, StatusMembro, StatusEscala, StatusConfirmacao, StatusEvento } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetando banco de dados...');
  
  // Limpar tabelas na ordem correta devido a chaves estrangeiras
  await prisma.auditLog.deleteMany();
  await prisma.escalaItem.deleteMany();
  await prisma.escala.deleteMany();
  await prisma.evento.deleteMany();
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
      nome: 'Igreja Piloto',
      slug: 'igreja-piloto',
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
    data: { tenantId: tenant.id, nome: 'Admin Geral', email: 'admin@igreja.com', senhaHash: senhaHashAdmin, role: Role.ADMIN_GERAL },
  });
  const pastorUser = await prisma.user.create({
    data: { tenantId: tenant.id, nome: 'Pr. Carlos', email: 'pastor@igreja.com', senhaHash: senhaHashPastor, role: Role.PASTOR },
  });
  const liderUser = await prisma.user.create({
    data: { tenantId: tenant.id, nome: 'Mariana Louvor', email: 'lider@igreja.com', senhaHash: senhaHashLider, role: Role.LIDER_MINISTERIO },
  });
  const secretarioUser = await prisma.user.create({
    data: { tenantId: tenant.id, nome: 'Lucas Secretaria', email: 'secretario@igreja.com', senhaHash: senhaHashSecretario, role: Role.SECRETARIO },
  });
  const membroUser = await prisma.user.create({
    data: { tenantId: tenant.id, nome: 'Membro Teste', email: 'membro@igreja.com', senhaHash: senhaHashMembro, role: Role.MEMBRO },
  });

  // 4. Criar Tags Padrão
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

  const tags: Record<string, any> = {};
  for (const tag of tagsData) {
    tags[tag.nome] = await prisma.tag.create({
      data: { tenantId: tenant.id, nome: tag.nome, corHex: tag.corHex },
    });
  }

  // 5. Criar Ministérios
  console.log('Criando Ministérios...');
  const ministeriosData = [
    { nome: 'Louvor', descricao: 'Ministério de música e adoração nos cultos' },
    { nome: 'Mídia', descricao: 'Operação de som, projeção, filmagem e redes sociais' },
    { nome: 'Infantil', descricao: 'Pastoreio e ensino bíblico de crianças' },
    { nome: 'Recepção', descricao: 'Acolhimento de membros e visitantes na entrada' },
    { nome: 'Intercessão', descricao: 'Grupo de oração e suporte espiritual' },
  ];

  const ministerios: Record<string, any> = {};
  for (const min of ministeriosData) {
    ministerios[min.nome] = await prisma.ministerio.create({
      data: { tenantId: tenant.id, nome: min.nome, descricao: min.descricao, ativo: true },
    });
  }

  // Associar Líder ao Ministério de Louvor
  await prisma.ministerioLider.create({
    data: { ministerioId: ministerios['Louvor'].id, userId: liderUser.id },
  });

  // 6. Criar 30 Membros
  console.log('Criando 30 Membros fictícios...');
  const nomesMembros = [
    'Ana Souza', 'Bruno Lima', 'Carla Dias', 'Daniel Oliveira', 'Eduardo Santos',
    'Fernanda Costa', 'Gabriel Jesus', 'Helena Roza', 'Igor Guimarães', 'Julia Melo',
    'Kevin Rodrigues', 'Larissa Nobre', 'Mateus Silva', 'Nicole Xavier', 'Otávio Neto',
    'Patricia Gomes', 'Rafael Ramos', 'Sofia Alencar', 'Tiago Abreu', 'Vanessa Pires',
    'Willian Cardoso', 'Yasmin Mendes', 'Zeca Silva', 'Alice Fernandes', 'Arthur Rocha',
    'Beatriz Albuquerque', 'Caio Valente', 'Diana Fontes', 'Emílio Castro', 'Flávia Rezende'
  ];

  const membrosCriados: any[] = [];
  for (let i = 0; i < nomesMembros.length; i++) {
    const nome = nomesMembros[i];
    const status = i % 10 === 0 ? StatusMembro.INATIVO : (i % 15 === 0 ? StatusMembro.VISITANTE : StatusMembro.ATIVO);
    const whatsapp = `551199999${1000 + i}`;
    const email = `${nome.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    
    // Gerar uma data de nascimento aleatória (entre 18 e 60 anos atrás)
    const anosAtras = 18 + (i % 43);
    const dataNascimento = new Date();
    dataNascimento.setFullYear(dataNascimento.getFullYear() - anosAtras);

    const membro = await prisma.membro.create({
      data: {
        tenantId: tenant.id,
        nome,
        whatsapp,
        email,
        dataNascimento,
        status,
        observacoes: `Membro inserido via seed para fins de teste operacional. Número sequencial: ${i + 1}`,
      },
    });

    membrosCriados.push(membro);

    // Associação de Tags com base no índice
    if (i % 3 === 0) {
      await prisma.membroTag.create({ data: { membroId: membro.id, tagId: tags['Jovens'].id } });
    }
    if (i % 5 === 0 && status === StatusMembro.ATIVO) {
      await prisma.membroTag.create({ data: { membroId: membro.id, tagId: tags['Músicos'].id } });
    }
    if (i % 4 === 0) {
      await prisma.membroTag.create({ data: { membroId: membro.id, tagId: tags['Batizados'].id } });
    }
    if (status === StatusMembro.VISITANTE) {
      await prisma.membroTag.create({ data: { membroId: membro.id, tagId: tags['Visitantes'].id } });
    }

    // Associação de Ministérios
    if (i % 5 === 0) {
      await prisma.ministerioMembro.create({ data: { ministerioId: ministerios['Louvor'].id, membroId: membro.id } });
    }
    if (i % 6 === 0) {
      await prisma.ministerioMembro.create({ data: { ministerioId: ministerios['Mídia'].id, membroId: membro.id } });
    }
    if (i % 7 === 0) {
      await prisma.ministerioMembro.create({ data: { ministerioId: ministerios['Recepção'].id, membroId: membro.id } });
    }
  }

  // 7. Criar Escalas
  console.log('Criando Escalas e Itens...');
  
  // Escala Semana Atual (Domingo)
  const hoje = new Date();
  const proximoDomingo = new Date();
  proximoDomingo.setDate(hoje.getDate() + (7 - hoje.getDay()));
  proximoDomingo.setHours(18, 0, 0, 0);

  const escalaSemanaAtual = await prisma.escala.create({
    data: {
      tenantId: tenant.id,
      ministerioId: ministerios['Louvor'].id,
      titulo: 'Culto da Família - Louvor Semanal',
      data: proximoDomingo,
      status: StatusEscala.PUBLICADA,
      observacoes: 'Chegar às 16:30 para passagem de som.',
    },
  });

  // Encontrar alguns membros do Louvor
  const musicosMembros = membrosCriados.filter((_, idx) => idx % 5 === 0).slice(0, 4);

  // Escala Itens da semana atual
  if (musicosMembros[0]) {
    await prisma.escalaItem.create({
      data: { escalaId: escalaSemanaAtual.id, membroId: musicosMembros[0].id, funcao: 'Ministro de Louvor', statusConfirmacao: StatusConfirmacao.CONFIRMADO },
    });
  }
  if (musicosMembros[1]) {
    await prisma.escalaItem.create({
      data: { escalaId: escalaSemanaAtual.id, membroId: musicosMembros[1].id, funcao: 'Teclado', statusConfirmacao: StatusConfirmacao.CONFIRMADO },
    });
  }
  if (musicosMembros[2]) {
    await prisma.escalaItem.create({
      data: { escalaId: escalaSemanaAtual.id, membroId: musicosMembros[2].id, funcao: 'Bateria', statusConfirmacao: StatusConfirmacao.PENDENTE },
    });
  }
  if (musicosMembros[3]) {
    await prisma.escalaItem.create({
      data: { escalaId: escalaSemanaAtual.id, membroId: musicosMembros[3].id, funcao: 'Vocal 1', statusConfirmacao: StatusConfirmacao.RECUSADO, observacoes: 'Viajando a trabalho' },
    });
  }

  // Escala Semana Seguinte (Domingo)
  const domingoSeguinte = new Date(proximoDomingo);
  domingoSeguinte.setDate(proximoDomingo.getDate() + 7);

  const escalaSemanaSeguinte = await prisma.escala.create({
    data: {
      tenantId: tenant.id,
      ministerioId: ministerios['Louvor'].id,
      titulo: 'Culto de Celebração - Escala Futura',
      data: domingoSeguinte,
      status: StatusEscala.RASCUNHO,
      observacoes: 'Escala em elaboração.',
    },
  });

  // Escala Itens da semana seguinte
  if (musicosMembros[0]) {
    await prisma.escalaItem.create({
      data: { escalaId: escalaSemanaSeguinte.id, membroId: musicosMembros[0].id, funcao: 'Violão / Voz', statusConfirmacao: StatusConfirmacao.PENDENTE },
    });
  }
  if (musicosMembros[3]) {
    await prisma.escalaItem.create({
      data: { escalaId: escalaSemanaSeguinte.id, membroId: musicosMembros[3].id, funcao: 'Contrabaixo', statusConfirmacao: StatusConfirmacao.PENDENTE },
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
