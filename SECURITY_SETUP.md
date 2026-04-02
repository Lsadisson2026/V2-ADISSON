# 🔒 Guia de Configuração de Segurança - Supabase RLS

## O que é RLS (Row Level Security)?

RLS é uma camada de segurança que controla quem pode acessar quais dados no banco. Mesmo que alguém tenha suas credenciais públicas (ANON_KEY), não conseguirá acessar dados sem estar autenticado.

---

## 📋 Passo a Passo

### 1. Acesse o Supabase Dashboard

1. Vá para: https://supabase.com/dashboard
2. Faça login
3. Selecione seu projeto

### 2. Abra o SQL Editor

1. No menu lateral, clique em **SQL Editor**
2. Clique em **New Query**

### 3. Execute o Script de Segurança

1. Abra o arquivo `supabase_rls_policies.sql` deste projeto
2. Copie TODO o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** (ou pressione Ctrl+Enter)

### 4. Verifique se Funcionou

Execute esta query no SQL Editor:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Você deve ver várias políticas listadas para cada tabela.

---

## 🛡️ O que as Políticas Fazem?

### Profiles (Usuários)
- ✅ Usuários veem apenas seu próprio perfil
- ✅ Admins veem todos os perfis
- ✅ Apenas admins podem criar/editar/deletar usuários

### Clients (Clientes)
- ✅ Todos autenticados podem ver clientes
- ✅ Todos autenticados podem criar clientes
- ✅ Apenas admins podem editar/deletar

### Contracts (Contratos)
- ✅ Todos autenticados podem ver contratos
- ✅ Todos autenticados podem criar contratos
- ✅ Apenas admins podem editar/deletar

### Payments (Pagamentos)
- ✅ Todos autenticados podem ver pagamentos
- ✅ Todos autenticados podem registrar pagamentos
- ✅ Apenas admins podem editar/deletar

### Notifications (Notificações)
- ✅ Usuários veem apenas suas notificações
- ✅ Admins veem todas
- ✅ Usuários podem marcar como lida

---

## 🧪 Como Testar

### Teste 1: Acesso Sem Login (deve falhar)

Abra o console do navegador (F12) e execute:

```javascript
const { data, error } = await supabase.from('clients').select('*');
console.log(data, error);
```

**Resultado esperado:** Erro ou array vazio (sem dados)

### Teste 2: Acesso Com Login (deve funcionar)

1. Faça login no sistema
2. Execute o mesmo código acima
3. **Resultado esperado:** Lista de clientes

---

## ⚠️ Problemas Comuns

### Erro: "new row violates row-level security policy"

**Causa:** Você está tentando inserir dados sem permissão

**Solução:** 
1. Verifique se está autenticado
2. Verifique se o usuário tem a role correta (ADMIN/COLLECTOR)

### Erro: "permission denied for table"

**Causa:** RLS está ativo mas faltam políticas

**Solução:**
1. Execute novamente o script `supabase_rls_policies.sql`
2. Verifique se todas as políticas foram criadas

---

## 🔧 Desabilitar RLS (NÃO RECOMENDADO)

Se precisar desabilitar temporariamente para debug:

```sql
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE contracts DISABLE ROW LEVEL SECURITY;
-- etc...
```

**⚠️ ATENÇÃO:** Isso deixa seus dados expostos! Use apenas para testes.

---

## 📊 Monitoramento

### Ver quem está acessando

No Supabase Dashboard:
1. Vá em **Authentication** > **Users**
2. Veja todos os usuários cadastrados
3. Monitore logins suspeitos

### Logs de Acesso

1. Vá em **Logs** no menu lateral
2. Filtre por tipo: `API`, `Auth`, `Database`
3. Monitore acessos não autorizados

---

## ✅ Checklist Final

Antes de fazer push para o GitHub:

- [ ] RLS habilitado em todas as tabelas
- [ ] Políticas criadas e testadas
- [ ] `.env` no `.gitignore`
- [ ] `.env.example` sem credenciais reais
- [ ] `finance.db` no `.gitignore`
- [ ] Testado login e acesso aos dados
- [ ] Testado que sem login não acessa dados

---

## 🆘 Precisa de Ajuda?

Se algo não funcionar:

1. Verifique os logs no Supabase Dashboard
2. Execute a query de verificação de políticas
3. Confirme que o usuário tem role correta na tabela `profiles`

---

## 🔐 Segurança Extra (Opcional)

### 1. Habilitar Email Confirmation

No Supabase Dashboard:
- Authentication > Settings
- Marque "Enable email confirmations"

### 2. Configurar Rate Limiting

- Settings > API
- Configure limites de requisições por IP

### 3. Habilitar 2FA para Admins

- Implemente autenticação de dois fatores
- Use Supabase Auth com MFA

---

**Pronto! Seu sistema agora está protegido com RLS.** 🎉

Mesmo que alguém tenha suas credenciais públicas, não conseguirá acessar dados sem fazer login no sistema.
