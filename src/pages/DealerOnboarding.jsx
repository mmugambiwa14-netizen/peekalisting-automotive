import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Clock3, ShieldAlert, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import BusinessProfileForm from '@/components/business/BusinessProfileForm';
import BackButton from '@/components/layout/BackButton';
import { FormSkeleton } from '@/components/loading/LoadingSkeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/AuthContext';
import {
  getMyPublishingAccess,
  respondToBusinessApplication,
  submitBusinessApplication,
} from '@/services/businessPublishingService';
import {
  getOwnerBusinessProfile,
  saveOwnerBusinessProfile,
} from '@/services/businessProfilesService';

function fieldValue(user, key) {
  if (!user) return '';
  if (key === 'name') return user.full_name || user.name || user.user_metadata?.full_name || '';
  if (key === 'email') return user.email || '';
  return '';
}

function StatusCard({ icon: Icon, title, children, tone = 'default' }) {
  const tones = {
    default: 'border-border bg-card',
    success: 'border-success/25 bg-success/5',
    warning: 'border-amber-500/25 bg-amber-500/5',
    danger: 'border-destructive/30 bg-destructive/5',
  };
  return (
    <section className={`rounded-2xl border p-5 ${tones[tone] || tones.default}`}>
      <div className="flex items-start gap-3">
        <span className="locked-icon-tile h-11 w-11 shrink-0"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0"><h2 className="font-extrabold">{title}</h2><div className="mt-1 text-sm leading-6 text-muted-foreground">{children}</div></div>
      </div>
    </section>
  );
}

export default function DealerOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [response, setResponse] = useState('');
  const [application, setApplication] = useState(() => ({
    businessName: '',
    contactName: fieldValue(user, 'name'),
    businessEmail: fieldValue(user, 'email'),
    businessPhone: '',
    countryCode: 'ZW',
    city: '',
    description: '',
    websiteUrl: '',
    socialUrl: '',
    expectedInventoryBand: '1-10',
    requestedCategories: ['car'],
  }));

  const accessQuery = useQuery({
    queryKey: ['publishing-access', 'dealer-onboarding', user?.id],
    queryFn: getMyPublishingAccess,
    enabled: Boolean(user?.id),
    staleTime: 15_000,
  });
  const profileQuery = useQuery({
    queryKey: ['owner-business-profile', user?.id],
    queryFn: () => getOwnerBusinessProfile(user.id),
    enabled: Boolean(user?.id),
  });

  const access = accessQuery.data;
  const profile = profileQuery.data;
  const carsApproved = Boolean(access?.approvedCategories?.includes('car'));
  const carsPending = Boolean(access?.pendingCategories?.includes('car'));
  const carsSuspended = Boolean(access?.suspendedCategories?.includes('car'));
  const needsInformation = access?.applicationStatus === 'needs_information' || access?.needsInformation;
  const hasApplication = Boolean(access?.applicationId && access?.applicationStatus !== 'not_started');
  const dealerProfileReady = profile?.business_type === 'car_dealership';

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['publishing-access'] }),
      queryClient.invalidateQueries({ queryKey: ['owner-business-profile', user?.id] }),
      accessQuery.refetch(),
      profileQuery.refetch(),
    ]);
  };

  const applicationMutation = useMutation({
    mutationFn: async () => {
      const result = await submitBusinessApplication({ ...application, requestedCategories: ['car'] });
      const profileInput = profile ? {
        company_name: profile.company_name,
        business_type: 'car_dealership',
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
        social_links: profile.social_links,
        city: profile.city,
        address: profile.address,
        description: profile.description,
      } : {
        company_name: application.businessName,
        business_type: 'car_dealership',
        phone: application.businessPhone,
        email: application.businessEmail,
        website: application.websiteUrl || null,
        social_links: {},
        city: application.city,
        address: null,
        description: application.description,
      };

      try {
        await saveOwnerBusinessProfile(user.id, profile?.id, profileInput);
      } catch (profileError) {
        return { result, profileError };
      }
      return { result, profileError: null };
    },
    onSuccess: async ({ profileError }) => {
      toast.success('Dealer application submitted');
      if (profileError) toast.warning('Application submitted. Finish your dealer profile separately.');
      await refresh();
    },
    onError: (error) => toast.error(error.message || 'Dealer application could not be submitted.'),
  });

  const responseMutation = useMutation({
    mutationFn: () => respondToBusinessApplication(access.applicationId, response),
    onSuccess: async () => {
      toast.success('Information sent for review');
      setResponse('');
      await refresh();
    },
    onError: (error) => toast.error(error.message || 'The information could not be sent.'),
  });

  const profileMutation = useMutation({
    mutationFn: ({ input, logoChange }) => saveOwnerBusinessProfile(user.id, profile?.id, input, logoChange),
    onSuccess: async () => {
      toast.success('Dealer profile saved');
      await refresh();
    },
    onError: (error) => toast.error(error.message || 'Dealer profile could not be saved.'),
  });

  const applicationStatus = useMemo(() => {
    if (carsSuspended) return 'suspended';
    if (carsApproved) return 'approved';
    if (needsInformation) return 'needs_information';
    if (carsPending || ['submitted', 'reviewing'].includes(access?.applicationStatus)) return 'pending';
    return 'not_started';
  }, [access?.applicationStatus, carsApproved, carsPending, carsSuspended, needsInformation]);

  if (accessQuery.isLoading || profileQuery.isLoading) {
    return <main className="relative mx-auto min-h-[70vh] max-w-3xl px-4 pb-10 pt-20"><BackButton className="absolute left-4 top-4" fallback="/dealers" label="Back to Dealers" /><FormSkeleton fields={6} label="Loading dealer onboarding" /></main>;
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <BackButton className="-ml-2" fallback="/dealers" label="Back to Dealers" />
          <div className="mt-4 max-w-2xl">
            <p className="findit-overline">Sell as a business</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Become a PeekaListing dealer</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">Private sellers can already submit individual vehicles. Dealer onboarding is for registered vehicle businesses that want a public dealership profile and a searchable inventory page.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {accessQuery.isError && <StatusCard icon={ShieldAlert} title="We could not load your dealer application" tone="danger"><p>Check your connection and try again.</p><Button type="button" variant="outline" className="mt-3" onClick={() => accessQuery.refetch()}>Try again</Button></StatusCard>}

        {applicationStatus === 'approved' && (
          <StatusCard icon={CheckCircle2} title="Cars business approval is active" tone="success">
            <p>Your dealership can appear in Dealers once the public profile below is set to Vehicle dealership and complete enough for buyers to understand who they are contacting.</p>
            {dealerProfileReady && profile?.public_path && <Button asChild variant="outline" className="mt-3"><Link to={profile.public_path}>View public dealer page</Link></Button>}
          </StatusCard>
        )}

        {applicationStatus === 'pending' && (
          <StatusCard icon={Clock3} title="Dealer application is under review" tone="warning"><p>You can prepare your public dealer profile while the Cars business application is reviewed. Approval controls dealer-directory eligibility; it does not change your normal ability to submit a private vehicle for review.</p></StatusCard>
        )}

        {applicationStatus === 'suspended' && (
          <StatusCard icon={ShieldAlert} title="Dealer capability is suspended" tone="danger"><p>{access?.reviewerMessage || 'Your Cars business approval is currently suspended.'}</p><p className="mt-2">This affects dealership identity and directory eligibility, not the separate private-seller vehicle submission path.</p></StatusCard>
        )}

        {applicationStatus === 'needs_information' && (
          <section className="rounded-2xl border border-amber-500/25 bg-card p-5">
            <p className="findit-overline">More information required</p>
            <h2 className="mt-2 text-xl font-extrabold">Respond to the reviewer</h2>
            {access?.reviewerMessage && <p className="mt-2 rounded-xl bg-amber-500/8 p-3 text-sm text-muted-foreground">{access.reviewerMessage}</p>}
            <Textarea className="mt-4" rows={5} minLength={5} maxLength={3000} value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Provide the requested dealership information" />
            <Button type="button" className="mt-3" disabled={responseMutation.isPending || response.trim().length < 5} onClick={() => responseMutation.mutate()}>{responseMutation.isPending ? 'Sending…' : 'Send information'}</Button>
          </section>
        )}

        {applicationStatus === 'not_started' && !accessQuery.isError && (
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="locked-icon-tile h-11 w-11 shrink-0"><Store className="h-5 w-5" /></span><div><p className="findit-overline">Step 1</p><h2 className="mt-1 text-xl font-extrabold">Apply as a vehicle dealership</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">This application is only for the Cars business category. PeekaListing reviews dealership eligibility separately from individual vehicle moderation.</p></div></div>
            <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); applicationMutation.mutate(); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dealership name"><Input required minLength={2} maxLength={160} value={application.businessName} onChange={(event) => setApplication((current) => ({ ...current, businessName: event.target.value }))} /></Field>
                <Field label="Contact person"><Input required minLength={2} maxLength={120} value={application.contactName} onChange={(event) => setApplication((current) => ({ ...current, contactName: event.target.value }))} /></Field>
                <Field label="Business email"><Input required type="email" value={application.businessEmail} onChange={(event) => setApplication((current) => ({ ...current, businessEmail: event.target.value }))} /></Field>
                <Field label="Business phone"><Input required type="tel" value={application.businessPhone} onChange={(event) => setApplication((current) => ({ ...current, businessPhone: event.target.value }))} /></Field>
                <Field label="City"><Input required minLength={2} maxLength={120} value={application.city} onChange={(event) => setApplication((current) => ({ ...current, city: event.target.value }))} /></Field>
                <Field label="Expected active inventory"><select className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base md:text-sm" value={application.expectedInventoryBand} onChange={(event) => setApplication((current) => ({ ...current, expectedInventoryBand: event.target.value }))}><option value="1-10">1–10 vehicles</option><option value="11-50">11–50 vehicles</option><option value="51-200">51–200 vehicles</option><option value="200+">200+ vehicles</option></select></Field>
              </div>
              <Field label="Dealership description"><Textarea required minLength={20} maxLength={1000} rows={4} value={application.description} onChange={(event) => setApplication((current) => ({ ...current, description: event.target.value }))} placeholder="Describe your dealership, stock and where buyers can view vehicles." /></Field>
              <Field label="Website (optional)"><Input type="url" value={application.websiteUrl} onChange={(event) => setApplication((current) => ({ ...current, websiteUrl: event.target.value }))} placeholder="https://..." /></Field>
              <Button type="submit" className="w-full sm:w-auto" disabled={applicationMutation.isPending}>{applicationMutation.isPending ? 'Submitting…' : 'Submit dealer application'}</Button>
            </form>
          </section>
        )}

        {hasApplication && applicationStatus !== 'not_started' && (
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="locked-icon-tile h-11 w-11 shrink-0"><Building2 className="h-5 w-5" /></span><div><p className="findit-overline">Step 2</p><h2 className="mt-1 text-xl font-extrabold">{profile ? 'Dealer profile' : 'Create your dealer profile'}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">This is the public identity buyers see. It does not become directory-eligible until Cars business approval is active.</p></div></div>
            <div className="mt-6">
              <BusinessProfileForm
                key={`${profile?.updated_at || 'new'}-${applicationStatus}`}
                profile={profile}
                fixedBusinessType="car_dealership"
                onSubmit={(input, logoChange) => profileMutation.mutate({ input, logoChange })}
                isPending={profileMutation.isPending}
                error={profileMutation.error}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold">{label}</span>{children}</label>;
}
