/*
  Warnings:

  - You are about to drop the `EscalaFuncaoExcluida` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EscalaFuncaoExcluida" DROP CONSTRAINT "EscalaFuncaoExcluida_escalaId_fkey";

-- DropForeignKey
ALTER TABLE "EscalaFuncaoExcluida" DROP CONSTRAINT "EscalaFuncaoExcluida_funcaoId_fkey";

-- DropTable
DROP TABLE "EscalaFuncaoExcluida";

-- CreateTable
CREATE TABLE "EscalaDiaFuncaoOculta" (
    "diaId" TEXT NOT NULL,
    "funcaoId" TEXT NOT NULL,

    CONSTRAINT "EscalaDiaFuncaoOculta_pkey" PRIMARY KEY ("diaId","funcaoId")
);

-- AddForeignKey
ALTER TABLE "EscalaDiaFuncaoOculta" ADD CONSTRAINT "EscalaDiaFuncaoOculta_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES "EscalaDia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaDiaFuncaoOculta" ADD CONSTRAINT "EscalaDiaFuncaoOculta_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "MinisterioFuncao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
