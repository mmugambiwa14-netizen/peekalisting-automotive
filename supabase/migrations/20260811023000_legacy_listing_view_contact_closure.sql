-- Legacy compatibility views select `l.*` from public.listings and therefore
-- carry seller contact columns even though the base-table grants are correctly
-- closed by 0109/0115. Automotive browser reads use the bounded public search
-- and detail APIs, so these legacy views must not provide a second contact path.

revoke all on table public.cars from anon, authenticated;
revoke all on table public.properties from anon, authenticated;
revoke all on table public.machinery from anon, authenticated;

do $verify$
begin
  if has_column_privilege('anon', 'public.cars', 'contact_phone', 'SELECT')
     or has_column_privilege('authenticated', 'public.cars', 'contact_phone', 'SELECT')
     or has_column_privilege('anon', 'public.properties', 'contact_phone', 'SELECT')
     or has_column_privilege('authenticated', 'public.properties', 'contact_phone', 'SELECT')
     or has_column_privilege('anon', 'public.machinery', 'contact_phone', 'SELECT')
     or has_column_privilege('authenticated', 'public.machinery', 'contact_phone', 'SELECT') then
    raise exception 'legacy listing view contact access remains browser-readable';
  end if;
end;
$verify$;
