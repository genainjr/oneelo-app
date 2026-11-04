import { PrismaClient, Plano } from '@prisma/client';
import { getDefaultStoredMemberLimit } from '../src/common/utils/tenant-plan';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando sincronização de limites de membros para tenants...');

  // 1. Tenants PROFISSIONAL com limite inferior ao padrão
  const profResult = await prisma.tenant.updateMany({
    where: {
      plano: Plano.PROFISSIONAL,
      limiteMembros: { lt: getDefaultStoredMemberLimit(Plano.PROFISSIONAL) },
    },
    data: {
      limiteMembros: getDefaultStoredMemberLimit(Plano.PROFISSIONAL),
    },
  });
  console.log(`Atualizados ${profResult.count} tenants PROFISSIONAL para limite ilimitado.`);

  // 2. Tenants BASICO com limite legado de 50
  const basicoResult = await prisma.tenant.updateMany({
    where: {
      plano: Plano.BASICO,
      limiteMembros: 50,
    },
    data: {
      limiteMembros: getDefaultStoredMemberLimit(Plano.BASICO),
    },
  });
  console.log(`Atualizados ${basicoResult.count} tenants BASICO para limite padrão de 200.`);

  console.log('Sincronização concluída com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro na sincronização de limites:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
