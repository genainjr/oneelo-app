-- Prevent the same member from being assigned to multiple functions on the same scale day.
CREATE UNIQUE INDEX "EscalaItem_escalaDiaId_membroId_key" ON "EscalaItem"("escalaDiaId", "membroId");
