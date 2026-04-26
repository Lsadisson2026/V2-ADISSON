-- Fix: Corrigir função get_notifications que referencia tabela inexistente

-- Recriar a função sem referência a auth.users
DROP FUNCTION IF EXISTS get_notifications(INT);

CREATE OR REPLACE FUNCTION get_notifications(p_limit INT DEFAULT 50) RETURNS TABLE (
  id BIGINT, type TEXT, title TEXT, body TEXT, data JSONB, read BOOLEAN, created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY SELECT n.id, n.type, n.title, n.body, n.data, n.read, n.created_at
  FROM notifications n ORDER BY n.created_at DESC LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
