-- Rollback de moka_coins_v1. Revierte en orden inverso, sin tocar datos de usage.
DROP TRIGGER IF EXISTS trg_credit_debit_integration ON public.integration_usage;
DROP TRIGGER IF EXISTS trg_credit_debit_llm ON public.llm_usage;
DROP FUNCTION IF EXISTS public.credit_debit_from_usage();
DROP FUNCTION IF EXISTS public.credit_category(text);
ALTER PUBLICATION supabase_realtime DROP TABLE public.workspace_credit_balances;
DROP TABLE IF EXISTS public.workspace_credit_balances;
