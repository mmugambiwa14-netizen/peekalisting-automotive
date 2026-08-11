-- Keep the Cars launch owner/admin/Peek authorization rules unchanged while
-- avoiding per-row auth.uid() re-evaluation and filling the FK lookup indexes
-- used by the hosted business and Buyer Peek workflows.

begin;

-- Business publishing/application reads.
drop policy if exists business_applications_owner_read on public.business_applications;
create policy business_applications_owner_read
  on public.business_applications
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists category_approvals_owner_read on public.business_category_approvals;
create policy category_approvals_owner_read
  on public.business_category_approvals
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists managed_listing_requests_owner_read on public.managed_listing_requests;
create policy managed_listing_requests_owner_read
  on public.managed_listing_requests
  for select to authenticated
  using (requester_user_id = (select auth.uid()) or public.is_admin());

drop policy if exists business_application_responses_owner_read on public.business_application_responses;
create policy business_application_responses_owner_read
  on public.business_application_responses
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Audited contact reveal reads.
drop policy if exists contact_reveal_events_own_read on public.contact_reveal_events;
create policy contact_reveal_events_own_read
  on public.contact_reveal_events
  for select to public
  using (user_id = (select auth.uid()) or public.is_admin());

-- Buyer Peek participant access. The public projection remains a separate
-- permissive SELECT policy by design; this only optimizes the participant path.
drop policy if exists peek_requests_participant_read on public.peek_requests;
create policy peek_requests_participant_read
  on public.peek_requests
  for select to public
  using (
    requester_id = (select auth.uid())
    or public.is_admin()
    or (
      listing_id is not null
      and exists (
        select 1
        from public.listings l
        where l.id = peek_requests.listing_id
          and l.seller_id = (select auth.uid())
      )
    )
    or (
      service_id is not null
      and exists (
        select 1
        from public.services s
        where s.id = peek_requests.service_id
          and s.provider_id = (select auth.uid())
      )
    )
  );

drop policy if exists peek_requests_create on public.peek_requests;
create policy peek_requests_create
  on public.peek_requests
  for insert to public
  with check (
    public.is_active_user()
    and requester_id = (select auth.uid())
    and status = 'pending'::public.peek_request_status
    and moderation_status = 'pending'
    and supporter_count = 0
    and current_response_id is null
    and merged_into_id is null
    and answered_at is null
    and declined_at is null
    and (
      listing_id is null
      or not exists (
        select 1
        from public.listings l
        where l.id = peek_requests.listing_id
          and l.seller_id = (select auth.uid())
      )
    )
    and (
      service_id is null
      or not exists (
        select 1
        from public.services s
        where s.id = peek_requests.service_id
          and s.provider_id = (select auth.uid())
      )
    )
  );

drop policy if exists peek_request_supporters_own_read on public.peek_request_supporters;
create policy peek_request_supporters_own_read
  on public.peek_request_supporters
  for select to public
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists peek_request_supporters_withdraw on public.peek_request_supporters;
create policy peek_request_supporters_withdraw
  on public.peek_request_supporters
  for delete to public
  using (user_id = (select auth.uid()));

drop policy if exists peek_request_supporters_create on public.peek_request_supporters;
create policy peek_request_supporters_create
  on public.peek_request_supporters
  for insert to public
  with check (
    public.is_active_user()
    and user_id = (select auth.uid())
    and private.can_support_peek_request(request_id)
  );

drop policy if exists peek_request_fulfilments_owner_read on public.peek_request_fulfilments;
create policy peek_request_fulfilments_owner_read
  on public.peek_request_fulfilments
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());

-- Web Push is part of the same authenticated PWA runtime and had the same
-- per-row JWT lookup warning.
drop policy if exists users_manage_own_web_push_subscriptions on public.web_push_subscriptions;
create policy users_manage_own_web_push_subscriptions
  on public.web_push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Cover the launch-path foreign keys that are otherwise forced into table scans
-- during parent deletion, moderation and owner history reads.
create index if not exists idx_business_application_responses_application
  on public.business_application_responses(application_id);
create index if not exists idx_business_application_responses_user
  on public.business_application_responses(user_id);
create index if not exists idx_business_applications_reviewed_by
  on public.business_applications(reviewed_by) where reviewed_by is not null;
create index if not exists idx_business_category_approvals_application
  on public.business_category_approvals(business_application_id);
create index if not exists idx_business_category_approvals_approved_by
  on public.business_category_approvals(approved_by) where approved_by is not null;
create index if not exists idx_business_review_events_application
  on public.business_review_events(application_id, created_at desc);
create index if not exists idx_business_review_events_category
  on public.business_review_events(category_approval_id) where category_approval_id is not null;
create index if not exists idx_business_review_events_actor
  on public.business_review_events(actor_user_id, created_at desc);
create index if not exists idx_managed_listing_requests_requester
  on public.managed_listing_requests(requester_user_id, created_at desc);
create index if not exists idx_managed_listing_requests_assigned
  on public.managed_listing_requests(assigned_to) where assigned_to is not null;
create index if not exists idx_contact_reveal_events_listing
  on public.contact_reveal_events(listing_id) where listing_id is not null;
create index if not exists idx_contact_reveal_events_service
  on public.contact_reveal_events(service_id) where service_id is not null;
create index if not exists idx_peek_requests_requester
  on public.peek_requests(requester_id, created_at desc, id desc);
create index if not exists idx_peek_requests_merged_into
  on public.peek_requests(merged_into_id) where merged_into_id is not null;
create index if not exists idx_peek_requests_current_response
  on public.peek_requests(current_response_id) where current_response_id is not null;

-- Fail the migration if the optimized policies accidentally drift from their
-- role/action contract or still contain direct auth.uid() calls.
do $verify$
declare
  remaining_direct_auth_uid integer;
  policy_count integer;
begin
  select count(*)::integer into policy_count
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'business_applications_owner_read',
      'category_approvals_owner_read',
      'managed_listing_requests_owner_read',
      'business_application_responses_owner_read',
      'contact_reveal_events_own_read',
      'peek_requests_participant_read',
      'peek_requests_create',
      'peek_request_supporters_own_read',
      'peek_request_supporters_withdraw',
      'peek_request_supporters_create',
      'peek_request_fulfilments_owner_read',
      'users_manage_own_web_push_subscriptions'
    );

  if policy_count <> 12 then
    raise exception 'automotive launch RLS policy set is incomplete: %/12', policy_count;
  end if;

  select count(*)::integer into remaining_direct_auth_uid
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'business_applications_owner_read',
      'category_approvals_owner_read',
      'managed_listing_requests_owner_read',
      'business_application_responses_owner_read',
      'contact_reveal_events_own_read',
      'peek_requests_participant_read',
      'peek_requests_create',
      'peek_request_supporters_own_read',
      'peek_request_supporters_withdraw',
      'peek_request_supporters_create',
      'peek_request_fulfilments_owner_read',
      'users_manage_own_web_push_subscriptions'
    )
    and (
      coalesce(qual, '') ~ '(^|[^A-Za-z0-9_])auth\\.uid\\(\\)'
      or coalesce(with_check, '') ~ '(^|[^A-Za-z0-9_])auth\\.uid\\(\\)'
    );

  if remaining_direct_auth_uid <> 0 then
    raise exception 'direct auth.uid() calls remain in % launch policies', remaining_direct_auth_uid;
  end if;
end;
$verify$;

commit;
