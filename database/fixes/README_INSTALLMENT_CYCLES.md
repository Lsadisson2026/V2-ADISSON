# Fix: Contratos Parcelados Atrasados Não Aparecem na Home

## Problema
Contratos parcelados atrasados aparecem na seção "Empréstimos" mas não aparecem no card "Atrasados" da home.

## Causa
Contratos parcelados não estavam criando ciclos (`interest_cycles`) automaticamente, então não apareciam no dashboard.

## Solução

### Passo 1: Criar Ciclos Faltantes (Executar UMA VEZ)
Execute o script: `database/fixes/create_missing_installment_cycles.sql`

Isso vai criar ciclos PENDING para todos os contratos parcelados que não têm ciclo.

### Passo 2: Automatizar Criação de Ciclos (Executar UMA VEZ)
Execute o script: `database/migrations/auto_create_installment_cycles.sql`

Isso vai:
- ✅ Criar função `create_next_installment_cycle()` que cria o próximo ciclo
- ✅ Criar trigger que cria ciclo automaticamente após pagamento de parcela
- ✅ Criar função `initialize_installment_contract()` para criar ciclo inicial

### Passo 3: Atualizar Frontend (JÁ FEITO)
O frontend foi atualizado para:
- ✅ Chamar `initialize_installment_contract()` ao criar contrato parcelado
- ✅ Chamar `initialize_installment_contract()` ao aprovar contrato parcelado

### Passo 4: Push para GitHub
Fazer commit e push das alterações:
```bash
git add -A
git commit -m "Fix: Contratos parcelados atrasados agora aparecem na home"
git push origin main
```

## Resultado Esperado
✅ Contratos parcelados atrasados aparecem no card "Atrasados" da home
✅ Contratos parcelados vencendo hoje aparecem no card "Vencendo Hoje"
✅ Ciclos são criados automaticamente após cada pagamento de parcela
✅ Ciclos são criados automaticamente ao criar novo contrato parcelado

## Testes
1. Criar novo contrato parcelado → Deve aparecer no card "Vencendo Hoje" ou "Atrasados"
2. Pagar parcela de contrato parcelado → Próximo ciclo deve ser criado automaticamente
3. Verificar contratos parcelados existentes → Devem aparecer na home se estiverem atrasados
