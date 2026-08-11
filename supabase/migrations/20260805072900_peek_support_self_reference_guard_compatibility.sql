-- Compatibility repair for the 20260805073000 authenticated RPC convergence gate.
--
-- The convergence migration rejects truly recursive RPC implementations by
-- looking for `<function_name>(` inside each stored body. The original
-- support_peek_request implementation called private.can_support_peek_request,
-- whose helper name contains the same substring and therefore produced a false
-- self-reference. Keep the behaviour unchanged while routing the check through
-- an internal helper whose identifier cannot collide with the public RPC name.

create or replace function private.peek_request_support_allowed(p_request_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.can_support_peek_request(p_request_id);
$function$;

revoke all on function private.peek_request_support_allowed(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.support_peek_request(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count integer;
begin
  if not public.is_active_user() then
    raise exception 'an active account is required' using errcode = '42501';
  end if;

  if not private.peek_request_support_allowed(p_request_id) then
    raise exception 'this Peek Request cannot be supported' using errcode = '42501';
  end if;

  insert into public.peek_request_supporters(request_id, user_id)
  values (p_request_id, auth.uid())
  on conflict (request_id, user_id) do nothing;

  select supporter_count into v_count
  from public.peek_requests
  where id = p_request_id;

  return coalesce(v_count, 0);
end;
$function$;

revoke all on function public.support_peek_request(uuid) from public;
grant execute on function public.support_peek_request(uuid) to authenticated;
