-- Adiciona coluna archived para arquivar contratos
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Cria índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_contracts_archived ON contracts(archived);

-- Atualiza contratos CLOSED/FINISHED para não aparecerem por padrão
-- (opcional - descomente se quiser arquivar automaticamente os finalizados)
-- UPDATE contracts SET archived = TRUE WHERE status IN ('CLOSED', 'FINISHED');
