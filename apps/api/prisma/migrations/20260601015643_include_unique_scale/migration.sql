/*
  Warnings:

  - You are about to drop the column `data` on the `Escala` table. All the data in the column will be lost.
  - You are about to drop the column `titulo` on the `Escala` table. All the data in the column will be lost.
  - You are about to drop the column `escalaId` on the `EscalaItem` table. All the data in the column will be lost.
  - You are about to drop the column `funcao` on the `EscalaItem` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ministerioId,mes,ano]` on the table `Escala` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[escalaDiaId,membroId,ministerioFuncaoId]` on the table `EscalaItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ano` to the `Escala` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mes` to the `Escala` table without a default value. This is not possible if the table is not empty.
  - Added the required column `escalaDiaId` to the `EscalaItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ministerioFuncaoId` to the `EscalaItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "EscalaItem" DROP CONSTRAINT "EscalaItem_escalaId_fkey";

-- DropIndex
DROP INDEX "Escala_tenantId_data_idx";

-- DropIndex
DROP INDEX "EscalaItem_escalaId_membroId_key";

-- AlterTable
ALTER TABLE "Escala" DROP COLUMN "data",
DROP COLUMN "titulo",
ADD COLUMN     "ano" INTEGER NOT NULL,
ADD COLUMN     "mes" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "EscalaItem" DROP COLUMN "escalaId",
DROP COLUMN "funcao",
ADD COLUMN     "escalaDiaId" TEXT NOT NULL,
ADD COLUMN     "ministerioFuncaoId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "MinisterioFuncao" (
    "id" TEXT NOT NULL,
    "ministerioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "corHex" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MinisterioFuncao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalaDia" (
    "id" TEXT NOT NULL,
    "escalaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "titulo" TEXT,
    "eventoId" TEXT,
    "observacoes" TEXT,

    CONSTRAINT "EscalaDia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MinisterioFuncao_ministerioId_nome_key" ON "MinisterioFuncao"("ministerioId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Escala_ministerioId_mes_ano_key" ON "Escala"("ministerioId", "mes", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "EscalaItem_escalaDiaId_membroId_ministerioFuncaoId_key" ON "EscalaItem"("escalaDiaId", "membroId", "ministerioFuncaoId");

-- AddForeignKey
ALTER TABLE "MinisterioFuncao" ADD CONSTRAINT "MinisterioFuncao_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "Ministerio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaDia" ADD CONSTRAINT "EscalaDia_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "Escala"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaDia" ADD CONSTRAINT "EscalaDia_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaItem" ADD CONSTRAINT "EscalaItem_escalaDiaId_fkey" FOREIGN KEY ("escalaDiaId") REFERENCES "EscalaDia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaItem" ADD CONSTRAINT "EscalaItem_ministerioFuncaoId_fkey" FOREIGN KEY ("ministerioFuncaoId") REFERENCES "MinisterioFuncao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
