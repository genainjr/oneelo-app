-- CreateTable
CREATE TABLE "EscalaFuncaoExcluida" (
    "escalaId" TEXT NOT NULL,
    "funcaoId" TEXT NOT NULL,

    CONSTRAINT "EscalaFuncaoExcluida_pkey" PRIMARY KEY ("escalaId","funcaoId")
);

-- AddForeignKey
ALTER TABLE "EscalaFuncaoExcluida" ADD CONSTRAINT "EscalaFuncaoExcluida_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "Escala"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaFuncaoExcluida" ADD CONSTRAINT "EscalaFuncaoExcluida_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "MinisterioFuncao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
