-- Close the remaining hosted-staging performance lint gaps without changing
-- product semantics: cover active FK paths and remove one exact duplicate index.

begin;

create index if not exists idx_peek_response_binding_intents_owner
  on public.peek_response_binding_intents(owner_id);
create index if not exists idx_peek_response_binding_intents_request
  on public.peek_response_binding_intents(request_id);
create index if not exists idx_web_push_delivery_jobs_user
  on public.web_push_delivery_jobs(user_id);

-- 0044_v1_admin_keyset_pagination.sql owns the canonical admin audit cursor
-- index. This restored index has the identical key definition and no repository
-- contract depends on its duplicate name.
drop index if exists public.idx_audit_logs_target_created_keyset;

do $verify$
begin
  if to_regclass('public.idx_peek_response_binding_intents_owner') is null
     or to_regclass('public.idx_peek_response_binding_intents_request') is null
     or to_regclass('public.idx_web_push_delivery_jobs_user') is null then
    raise exception 'hosted launch FK indexes are incomplete';
  end if;

  if to_regclass('public.idx_audit_logs_target_created_keyset') is not null then
    raise exception 'duplicate audit cursor index still exists';
  end if;
end;
$verify$;

commit;
