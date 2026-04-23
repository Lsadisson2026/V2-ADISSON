# V2-ADISSON - Documentação do Projeto

## 📁 Estrutura de Pastas

### `/docs` - Documentação
- **README.md** - Visão geral do projeto
- **SECURITY_SETUP.md** - Configuração de segurança e RLS policies
- **ARCHIVE_SETUP.md** - Sistema de arquivamento de contratos
- **FIX_ORPHAN_PAYMENTS.md** - Documentação do bug de pagamentos órfãos
- **FIX_REPORTS.md** - Correções no sistema de relatórios

### `/database/migrations` - Scripts de Migração
Scripts SQL para criar/alterar estrutura do banco de dados:
- `add_archived_column.sql` - Adiciona coluna archived aos contratos
- `add_cycle_id_to_payments.sql` - Adiciona cycle_id aos pagamentos
- `add_payment_date_to_interest_cycles.sql` - Adiciona data de pagamento aos ciclos
- `add_updated_at_columns.sql` - Adiciona updated_at em tabelas
- `fix_capital_constraint.sql` - Corrige constraint de capital
- `fix_status_case_and_constraint.sql` - Corrige status para uppercase
- `supabase_functions.sql` - Funções RPC do Supabase
- `supabase_rls_policies.sql` - Políticas de Row Level Security
- `update_get_reports.sql` - Atualiza função get_reports
- `archive_functions.sql` - Funções para arquivamento

### `/database/diagnostics` - Scripts de Diagnóstico
Scripts para investigar problemas no banco:
- `check_orphan_payments.sql` - Verifica pagamentos órfãos
- `find_all_orphan_payments.sql` - Lista todos os pagamentos órfãos
- `diagnostico_carmendeia.sql` - Diagnóstico do caso Carmendeia
- `diagnostico_nivia.sql` - Diagnóstico do caso Nivia
- `diagnostico_nivia_pagamentos.sql` - Pagamentos de Nivia
- `diagnostico_elizabete.sql` - Diagnóstico do caso Elizabete
- `diagnostico_elizabete_ciclos.sql` - Ciclos de Elizabete

### `/database/fixes` - Scripts de Correção
Scripts para corrigir problemas identificados:
- `fix_all_orphan_payments.sql` - Corrige todos os pagamentos órfãos
- `fix_carmendeia.sql` - Corrige caso específico da Carmendeia
- `fix_nivia.sql` - Corrige caso específico da Nivia
- `fix_lucas.sql` - Corrige caso específico do Lucas
- `fix_lucas_elizabete.sql` - Corrige casos de Lucas e Elizabete

## 🔧 Como Usar

### Executar Migrations
1. Abrir Supabase SQL Editor
2. Copiar conteúdo de `/database/migrations/*.sql`
3. Executar no banco de dados

### Diagnosticar Problemas
1. Executar script em `/database/diagnostics/`
2. Analisar resultados
3. Se necessário, executar script correspondente em `/database/fixes/`

### Exemplo: Corrigir Pagamentos Órfãos
```bash
# 1. Diagnosticar
database/diagnostics/check_orphan_payments.sql

# 2. Se encontrar problemas, corrigir
database/fixes/fix_all_orphan_payments.sql
```

## 📝 Notas Importantes

- Sempre fazer backup antes de executar scripts de correção
- Executar diagnostics primeiro para entender o problema
- Documentar qualquer novo problema em `/database/diagnostics/`
- Criar script de correção correspondente em `/database/fixes/`

## 🐛 Bugs Conhecidos e Corrigidos

### Pagamentos Órfãos (CORRIGIDO)
- **Problema**: Pagamentos registrados com `cycle_id = NULL`
- **Causa**: Bug no frontend ao registrar pagamento em modo "Só Capital"
- **Solução**: Corrigido em `src/App.tsx` linha 503
- **Documentação**: `docs/FIX_ORPHAN_PAYMENTS.md`

### Relatórios Limitados (CORRIGIDO)
- **Problema**: Apenas últimos 20 clientes apareciam
- **Causa**: LIMIT 20 na função `get_reports`
- **Solução**: Removido limite
- **Documentação**: `docs/FIX_REPORTS.md`
