# 🚀 Setup Novo Projeto V2-ADISSON

Guia passo a passo para clonar e configurar um novo projeto V2-ADISSON com suas próprias credenciais do Supabase.

## 📋 Pré-requisitos

- Node.js 16+ instalado
- Git instalado
- Conta Supabase criada (https://supabase.com)
- Projeto Supabase criado

## 🔧 Passo 1: Clonar o Repositório

```bash
git clone https://github.com/Lsadisson2026/V2-ADISSON.git
cd V2-ADISSON
```

## 🗄️ Passo 2: Configurar Banco de Dados Supabase

### 2.1 Acessar SQL Editor do Supabase

1. Abrir https://supabase.com
2. Fazer login na sua conta
3. Selecionar seu projeto
4. Ir para **SQL Editor** (ícone de banco de dados)

### 2.2 Executar Script de Setup

1. Abrir arquivo: `database/SETUP_COMPLETO.sql`
2. Copiar TODO o conteúdo
3. Colar no SQL Editor do Supabase
4. Clicar em **Run** (ou Ctrl+Enter)
5. Aguardar conclusão (pode levar alguns segundos)

✅ Pronto! Seu banco de dados está 100% configurado!

## 🔐 Passo 3: Configurar Credenciais

### 3.1 Obter Credenciais do Supabase

1. No Supabase, ir para **Settings** → **API**
2. Copiar:
   - **Project URL** (VITE_SUPABASE_URL)
   - **anon public** (VITE_SUPABASE_ANON_KEY)

### 3.2 Configurar .env

1. Abrir arquivo `.env.example`
2. Renomear para `.env`
3. Preencher com suas credenciais:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
```

## 📦 Passo 4: Instalar Dependências

```bash
npm install
```

## ▶️ Passo 5: Executar Projeto

```bash
npm run dev
```

Abrir http://localhost:3000 no navegador.

## 👤 Passo 6: Criar Usuário Admin (Opcional)

Se quiser criar um usuário admin no Supabase:

1. Ir para **Authentication** → **Users**
2. Clicar em **Add user**
3. Preencher email e senha
4. Após criar, ir para **SQL Editor** e executar:

```sql
UPDATE profiles 
SET role = 'ADMIN' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com');
```

## ✅ Verificação Final

Após seguir todos os passos, você deve conseguir:

- ✅ Fazer login no sistema
- ✅ Criar clientes
- ✅ Criar contratos
- ✅ Registrar pagamentos
- ✅ Ver relatórios
- ✅ Arquivar contratos

## 🆘 Troubleshooting

### Erro: "Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias"

**Solução**: Verificar se o arquivo `.env` foi criado corretamente com as credenciais.

### Erro: "Failed to run sql query"

**Solução**: 
1. Verificar se o script foi executado completamente
2. Tentar executar novamente
3. Verificar se há erros de sintaxe

### Erro: "Permission denied"

**Solução**: Verificar se as políticas RLS foram criadas corretamente. Executar novamente o script `database/SETUP_COMPLETO.sql`.

## 📚 Próximos Passos

- Ler `docs/README.md` para entender a arquitetura
- Ler `docs/SECURITY_SETUP.md` para entender segurança
- Ler `docs/ARCHIVE_SETUP.md` para entender sistema de arquivamento

## 🐛 Problemas?

Se encontrar problemas:

1. Verificar logs no console do navegador (F12)
2. Verificar logs do Supabase (SQL Editor)
3. Consultar documentação em `docs/`

---

**Pronto! Seu projeto está 100% funcional! 🎉**
