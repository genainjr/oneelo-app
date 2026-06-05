-- CreateTable
CREATE TABLE "MinisterioMembroFuncao" (
    "ministerioId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "funcaoId" TEXT NOT NULL,

    CONSTRAINT "MinisterioMembroFuncao_pkey" PRIMARY KEY ("ministerioId","membroId","funcaoId")
);

-- AddForeignKey
ALTER TABLE "MinisterioMembroFuncao" ADD CONSTRAINT "MinisterioMembroFuncao_ministerioId_membroId_fkey" FOREIGN KEY ("ministerioId", "membroId") REFERENCES "MinisterioMembro"("ministerioId", "membroId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinisterioMembroFuncao" ADD CONSTRAINT "MinisterioMembroFuncao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "MinisterioFuncao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
