-- The Supabase platform-owned `supabase_admin` role has default ACLs that the
-- project `postgres` role cannot alter. Keep the public API fail-closed anyway:
-- every new/replaced public function loses implicit browser EXECUTE until the
-- migration explicitly grants it, and every new public table/partition loses
-- DDL-adjacent browser privileges that are never needed through PostgREST.

begin;

create or replace function private.enforce_public_browser_acl_guard()
returns event_trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  command record;
begin
  for command in
    select * from pg_event_trigger_ddl_commands()
  loop
    if command.schema_name is distinct from 'public' then
      continue;
    end if;

    if command.object_type in ('table', 'partitioned table') then
      execute format(
        'revoke truncate, references, trigger, maintain on table %s from anon, authenticated',
        command.object_identity
      );
    elsif command.object_type = 'function' then
      execute format(
        'revoke execute on function %s from public, anon, authenticated',
        command.object_identity
      );
    end if;
  end loop;
end;
$function$;

revoke all on function private.enforce_public_browser_acl_guard()
  from public, anon, authenticated, service_role;

drop event trigger if exists automotive_public_browser_acl_guard;
create event trigger automotive_public_browser_acl_guard
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'CREATE FUNCTION')
  execute function private.enforce_public_browser_acl_guard();

commit;
