-- PostgreSQL enum values cannot be removed safely without rebuilding the type
-- and every dependent column. This migration is intentionally additive and
-- backward-compatible; rollback is therefore a documented no-op.
begin;
commit;
