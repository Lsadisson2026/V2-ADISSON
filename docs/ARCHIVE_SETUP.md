# 📦 Sistema de Arquivamento de Contratos

## O que foi implementado?

Sistema completo para arquivar contratos de empréstimos, removendo-os do kanban principal mas mantendo-os acessíveis em um modal separado.

## 🎯 Funcionalidades:

1. **Botão "Arquivados"** na seção Empréstimos (só admin)
2. **Botão "Arquivar"** em cada card de contrato (só admin)
3. **Modal de Arquivados** listando todos os contratos arquivados
4. **Botão "Desarquivar"** para restaurar contratos ao kanban
5. **Filtro automático** - contratos arquivados não aparecem no kanban

## 📋 Passos para Aplicar no Supabase:

### 1. Adicionar coluna `archived`

Execute no SQL Editor do Supabase:

```sql
-- Arquivo: add_archived_column.sql
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_contracts_archived ON contracts(archived);
```

### 2. Adicionar funções RPC

Execute no SQL Editor do Supabase:

```sql
-- Arquivo: archive_functions.sql
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
```

### 3. Atualizar RLS Policies (Opcional)

Se você já aplicou o RLS, adicione políticas para a coluna `archived`:

```sql
-- Permitir que usuários autenticados vejam contratos arquivados
-- (já está coberto pelas políticas existentes de SELECT em contracts)
```

## 🎨 Como Usar:

### Arquivar um Contrato:

1. Vá em **Empréstimos**
2. Encontre o contrato que deseja arquivar
3. Clique no botão **📖 Arquivar** (ícone de livro amarelo)
4. Confirme a ação
5. O contrato desaparece do kanban

### Ver Contratos Arquivados:

1. Vá em **Empréstimos**
2. Clique no botão **📖** no canto superior direito (ao lado de "Clientes")
3. Modal abre com todos os contratos arquivados

### Desarquivar um Contrato:

1. Abra o modal de **Arquivados**
2. Encontre o contrato
3. Clique em **↻ Desarquivar**
4. Confirme a ação
5. O contrato volta para o kanban

## 🔒 Permissões:

- **ADMIN:** Pode arquivar, desarquivar e ver arquivados
- **COLLECTOR:** Não tem acesso a essas funcionalidades

## 💡 Casos de Uso:

- Arquivar contratos quitados para limpar o kanban
- Arquivar contratos antigos que não estão mais ativos
- Manter histórico sem poluir a visualização principal
- Organizar contratos por período ou status

## ⚠️ Importante:

- Arquivar NÃO deleta o contrato
- Todos os dados permanecem no banco
- Contratos arquivados podem ser desarquivados a qualquer momento
- Contratos arquivados NÃO aparecem nos relatórios (a menos que sejam desarquivados)

## 🧪 Testar:

1. Crie um contrato de teste
2. Arquive-o
3. Verifique que sumiu do kanban
4. Abra "Arquivados" e veja que está lá
5. Desarquive
6. Verifique que voltou ao kanban

---

**Pronto! Sistema de arquivamento configurado.** 🎉
