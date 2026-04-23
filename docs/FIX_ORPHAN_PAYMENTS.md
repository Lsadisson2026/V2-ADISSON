# Fix: Orphan Payments Issue

## Problem Identified

Payments were being registered with `cycle_id = NULL` when using the "Só Capital" (Capital Only) payment mode, causing cycles to remain as PENDING even after payment was received.

### Root Cause

In `src/App.tsx`, the `PaymentForm` component's `buildData()` function had a bug on line 503:

```typescript
} else {
  return { contract_id: contract.id, cycle_id: null, amount,  // ❌ BUG
    payment_type: 'CAPITAL', payment_method: 'PIX',
    next_due_date: isFullQuitacao ? null : nextDate };
}
```

When `capMode === 'capital-only'`, it was hardcoding `cycle_id: null` instead of using `cycle?.id ?? null`.

### Impact

- Cycles remained PENDING after payment
- Clients appeared in "VENCENDO HOJE" and "ATRASADOS" even after being paid
- Reports showed incorrect pending amounts
- Payment history was not linked to cycles

## Solution

### 1. Frontend Fix (DONE)

Changed line 503 in `src/App.tsx`:

```typescript
} else {
  return { contract_id: contract.id, cycle_id: cycle?.id ?? null, amount,  // ✅ FIXED
    payment_type: 'CAPITAL', payment_method: 'PIX',
    next_due_date: isFullQuitacao ? null : nextDate };
}
```

### 2. Database Fix (TO RUN)

Execute these SQL scripts in order:

#### A. Fix Carmendeia's specific case:
```bash
Run: fix_carmendeia.sql
```

#### B. Find all orphan payments:
```bash
Run: find_all_orphan_payments.sql
```

#### C. Fix all orphan payments:
```bash
Run: fix_all_orphan_payments.sql
```

## What the Database Fix Does

1. Links orphan payments to their correct cycles based on payment date
2. Updates cycle `paid_amount` with sum of linked payments
3. Updates cycle `status` to PAID if fully paid
4. Shows summary of fixed payments and affected cycles

## Testing

After running the fixes:

1. Check that Carmendeia no longer appears in "VENCENDO HOJE"
2. Verify her contract shows correct next_due_date (2026-05-11)
3. Check that cycle 181 is marked as PAID
4. Verify all other clients with similar issues are fixed

## Prevention

The frontend fix prevents this issue from happening again. All future payments will correctly link to their cycles.
