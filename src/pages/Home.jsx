import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bell, Building2, CarFront, FileCheck2, Search, ShieldCheck, Wrench } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { readStoredJson, removeStoredValue, writeStoredJson } from '@/lib/browserStorage';
import BrandLogo from '@/components/BrandLogo';
import DiscoverHeader from '@/components/discover/DiscoverHeader';
import ListingCard from '@/components/listings/ListingCard';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { featureFlags } from '@/lib/featureFlags';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';
import { AUTOMOTIVE_BODY_TYPES, AUTOMOTIVE_FEATURED_MAKES } from '@/lib/automotiveConfig';
import { getLatestPublicListings } from '@/services/publicListingsService';

const LOCATION_STORAGE_KEY = 'peekalisting.automotive-location';

function publicLocation(value) {
  if (!value || typeof value !== 'object' || typeof value.city !== 'string' || !value.city) return null;
  const countryCode = String(value.countryCode || '').trim().toUpperCase();
  const countryName = String(value.countryName || '').trim().toLowerCase();
  if ((countryCode && countryCode !== LAUNCH_COUNTRY_CODE) || (!countryCode && countryName && countryName !== 'zimbabwe')) return null;
  return {
    country: typeof value.country === 'string' ? value.country : '',
    countryName: typeof value.countryName === 'string' ? value.countryName : '',
    countryCode: LAUNCH_COUNTRY_CODE,
    state: typeof value.state === 'string' ? value.state : '',
    stateName: typeof value.stateName === 'string' ? value.stateName : '',
    city: value.city,
    cityName: typeof value.cityName === 'string' ? value.cityName : '',
    placeType: typeof value.placeType === 'string' ? value.placeType : '',
    source: value.source === 'device' ? 'device' : 'manual',
  };
}

function readSavedLocation() {
  return publicLocation(readStoredJson('local', LOCATION_STORAGE_KEY, null));
}

function searchPath({ query = '', location = null, bodyType = '', make = '' } = {}) {
  const params = new URLSearchParams({ type: 'car' });
  if (query.trim()) params.set('q', query.trim().slice(0, 100));
  if (bodyType) params.set('bodyType', bodyType);
  if (make) params.set('make', make);
  if (location?.city) {
    params.set('location', location.city);
    if (location.cityName) params.set('locationName', location.cityName);
    params.set('country', LAUNCH_COUNTRY_CODE);
    if (location.state) params.set('province', location.state);
  }
  return `/search?${params.toString()}`;
}

function VehicleSkeletons() {
  return (
    <SkeletonRegion label="Loading vehicles" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [location, setLocation] = useState(readSavedLocation);
  const [query, setQuery] = useState('');
  const latest = useQuery({
    queryKey: ['automotive-home-latest', 'car'],
    queryFn: () => getLatestPublicListings('car', 8),
    staleTime: 60_000,
    retry: 1,
  });

  const updateLocation = (nextLocation) => {
    const safeLocation = publicLocation(nextLocation);
    setLocation(safeLocation);
    if (safeLocation) writeStoredJson('local', LOCATION_STORAGE_KEY, safeLocation);
    else removeStoredValue('local', LOCATION_STORAGE_KEY);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(searchPath({ query, location }));
  };

  return (
    <div className="findit-screen">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <header className="relative mb-5 flex min-h-11 items-center justify-center md:justify-between">
          <BrandLogo className="gap-2" markClassName="h-8 w-8" wordmarkClassName="text-[1.7rem] tracking-[-0.045em]" />
          <div className="absolute right-0 flex items-center gap-2 md:static">
            {featureFlags.essentialNotifications ? (
              <Link to="/notifications" aria-label="Open notifications" className="findit-header-action"><Bell className="h-5 w-5" /></Link>
            ) : null}
            <Link to="/post" className="hidden min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground md:inline-flex">Sell a car</Link>
          </div>
        </header>

        <section className="overflow-hidden rounded-[1.75rem] border border-border/75 bg-card px-5 py-7 shadow-sm sm:px-8 sm:py-10 lg:px-10" aria-labelledby="automotive-home-title">
          <div className="max-w-3xl">
            <p className="findit-overline">Zimbabwe automotive marketplace</p>
            <h1 id="automotive-home-title" className="mt-3 text-[2.35rem] font-black leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-[3.65rem]">Find the car. See more before you go.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Browse cars across Zimbabwe, compare the facts that matter, and contact sellers with confidence before you spend time travelling to see a vehicle.</p>
          </div>

          <form onSubmit={submitSearch} className="mt-7 grid gap-3 md:grid-cols-[minmax(0,1fr)_260px_auto]" role="search">
            <label className="locked-control flex h-14 items-center gap-3 rounded-2xl px-4">
              <Search className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="sr-only">Search vehicles</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder="Search make, model or keyword" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
            </label>
            <DiscoverHeader location={location} onLocationChange={updateLocation} />
            <button type="submit" className="inline-flex h-14 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-extrabold text-primary-foreground hover:bg-primary-hover">Search cars</button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2" aria-label="Browse by body type">
            {AUTOMOTIVE_BODY_TYPES.slice(0, 8).map((body) => (
              <Link key={body.value} to={searchPath({ bodyType: body.value, location })} className="inline-flex min-h-10 items-center rounded-full border border-border bg-background/65 px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/35 hover:text-foreground">{body.label}</Link>
            ))}
          </div>
        </section>

        <section className="mt-8" aria-labelledby="latest-vehicles-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div><p className="findit-overline">Fresh inventory</p><h2 id="latest-vehicles-title" className="fluid-section-title mt-1">Newly listed cars</h2></div>
            <Link to="/search?type=car" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary">Browse all <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {latest.isLoading ? <VehicleSkeletons /> : latest.isError ? (
            <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Vehicles could not be loaded right now.</div>
          ) : latest.data?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{latest.data.map((vehicle) => <ListingCard key={vehicle.id} listing={vehicle} type="car" />)}</div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center"><CarFront className="mx-auto h-7 w-7 text-primary" /><p className="mt-2 font-bold">Vehicle inventory is being prepared</p><p className="mt-1 text-sm text-muted-foreground">Be among the first sellers to submit a vehicle for review.</p><Link to="/post" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Sell a car</Link></div>
          )}
        </section>

        <section className="mt-9" aria-labelledby="browse-makes-title">
          <div className="mb-4"><p className="findit-overline">Quick discovery</p><h2 id="browse-makes-title" className="fluid-section-title mt-1">Browse by make</h2></div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            {AUTOMOTIVE_FEATURED_MAKES.map((make) => <Link key={make} to={searchPath({ make, location })} className="flex min-h-14 items-center justify-center rounded-2xl border border-border bg-card px-3 text-sm font-extrabold transition hover:-translate-y-0.5 hover:border-primary/35">{make}</Link>)}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="evidence-title">
          <div className="max-w-2xl"><p className="findit-overline">Before you travel</p><h2 id="evidence-title" className="fluid-section-title mt-1">Know what you are comparing.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">PeekaListing keeps vehicle facts, seller declarations, location context and contact choices clear so you can make a better-informed shortlist.</p></div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <EvidenceCard icon={CarFront} title="Useful vehicle facts" text="Compare model year, mileage, body style, fuel, transmission, drivetrain and registration details in one place." />
            <EvidenceCard icon={FileCheck2} title="Seller declarations" text="See clearly which details come from the seller and which questions still need an in-person check." />
            <EvidenceCard icon={ShieldCheck} title="Safer contact" text="Contact methods stay hidden until you deliberately open a phone, WhatsApp or email action." />
          </div>
        </section>

        <section className="mt-10" aria-labelledby="automotive-ecosystem-title">
          <div className="mb-4"><p className="findit-overline">Beyond the listing</p><h2 id="automotive-ecosystem-title" className="fluid-section-title mt-1">The automotive ecosystem around the car</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Move from discovery to a better-informed purchase, then find the businesses that can inspect, transport, maintain and support the vehicle.</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            <EcosystemCard to="/dealers" icon={Building2} title="Browse dealers" text="Explore PeekaListing-approved vehicle businesses and their current inventory." action="Find dealers" />
            <EcosystemCard to="/services" icon={Wrench} title="Automotive services" text="Find pre-purchase inspection, diagnostics, tyres, repairs, bodywork, towing, transport and more." action="Find services" />
          </div>
        </section>

        <section className="mt-10 flex flex-col gap-4 rounded-[1.75rem] border border-primary/20 bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div><p className="findit-overline">Selling a vehicle?</p><h2 className="mt-1 text-2xl font-black tracking-tight">Submit it free for review.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Private sellers can submit vehicles directly. Dealer approval unlocks dealership identity and business inventory capabilities.</p></div>
          <Link to="/post" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground">Sell your car</Link>
        </section>
      </div>
    </div>
  );
}

function EvidenceCard({ icon: Icon, title, text }) {
  return <article className="rounded-2xl border border-border bg-card p-5"><span className="locked-icon-tile h-11 w-11"><Icon className="h-5 w-5" /></span><h3 className="mt-4 font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></article>;
}

function EcosystemCard({ to, icon: Icon, title, text, action }) {
  return <Link to={to} className="clay-card group rounded-3xl p-6 transition hover:-translate-y-0.5 hover:border-primary/30"><span className="locked-icon-tile h-12 w-12"><Icon className="h-5 w-5" /></span><h3 className="mt-4 text-xl font-extrabold tracking-tight">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p><span className="mt-5 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary">{action}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span></Link>;
}
