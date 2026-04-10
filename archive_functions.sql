-- Função para arquivar contrato
CREATE OR REPLACE FUNCTION archive_contract(
  p_contract_id BIGINT
) RETURNS VOID AS $$
BEGIN
  UPDATE contracts
  SET archived = TRUE,
      updated_at = NOW()
  WHERE id = p_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para desarquivar contrato
CREATE OR REPLACE FUNCTION unarchive_contract(
  p_contract_id BIGINT
) RETURNS VOID AS $$
BEGIN
  UPDATE contracts
  SET archived = FALSE,
      updated_at = NOW()
  WHERE id = p_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
