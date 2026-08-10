import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';
import { launchVehicleCategoryOptions } from '@/lib/automotiveConfig';
import { Button } from '@/components/ui/button';
import { getCategoryTaxonomy } from '@/services/taxonomyService';
import { seedListingSchemaValues } from '@/services/listingSchemaBinding';
import StepNav from './StepNav';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';

export default function Step1Category({ formData, update, onContinue }) {
  const [error, setError] = useState('');
  const marketCountry = String(formData.country_code || LAUNCH_COUNTRY_CODE).toUpperCase();
  const taxonomyQuery = useQuery({
    queryKey: ['public-category-taxonomy', 'automotive-post', marketCountry],
    queryFn: () => getCategoryTaxonomy('car', marketCountry),
    staleTime: 5 * 60 * 1000,
  });

  const options = useMemo(() => launchVehicleCategoryOptions(taxonomyQuery.data || []), [taxonomyQuery.data]);
  const selected = options.find((option) => option.value === formData.category) || null;

  useEffect(() => {
    if (formData.listing_category !== 'car') update('listing_category', 'car');
    if (formData.type !== 'car') update('type', 'car');
    if (!formData.listing_type) update('listing_type', 'sale');
  }, [formData.listing_category, formData.listing_type, formData.type, update]);

  const choose = (option) => {
    try {
      const seed = seedListingSchemaValues('car', option.schemaBinding);
      update('listing_category', 'car');
      update('type', 'car');
      update('category', option.value);
      update('taxonomy_binding', option.schemaBinding);
      update('taxonomy_context', seed.taxonomyDimensions);
      update('detail', seed.values);
      update('listing_type', seed.offerType || 'sale');
      setError('');
    } catch {
      setError('That vehicle type is not compatible with the current listing schema. Refresh and try again.');
    }
  };

  const continueToDetails = () => {
    if (!selected) return setError('Choose the type of vehicle you are selling.');
    setError('');
    onContinue();
  };

  if (taxonomyQuery.isLoading) {
    return (
      <div className="space-y-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Sell a vehicle</p><h1 className="mt-2 text-3xl font-black tracking-tight">What are you selling?</h1><Skeleton className="mt-2 h-4 w-72 max-w-full" /></div>
        <SkeletonRegion label="Loading vehicle types" className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-2xl border border-border" />)}</SkeletonRegion>
      </div>
    );
  }

  if (taxonomyQuery.isError) {
    return (
      <div className="space-y-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Sell a vehicle</p><h1 className="mt-2 text-3xl font-black tracking-tight">Vehicle types are temporarily unavailable</h1><p className="mt-1.5 text-sm leading-6 text-muted-foreground">We could not load the current automotive taxonomy. PeekaListing will not submit against stale category rules.</p></div>
        <Button type="button" variant="outline" onClick={() => taxonomyQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
      </div>
    );
  }

  if (!options.length) {
    return (
      <div className="space-y-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Sell a vehicle</p><h1 className="mt-2 text-3xl font-black tracking-tight">Vehicle submissions are temporarily paused</h1><p className="mt-1.5 text-sm leading-6 text-muted-foreground">There are no launch-approved vehicle types available for {marketCountry} right now.</p></div>
        <Button type="button" variant="outline" onClick={() => taxonomyQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Sell a vehicle</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">What are you selling?</h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Choose the closest vehicle type. The next step captures the detailed make, model, history and specifications buyers need.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const active = selected?.value === option.value;
          const context = option.pathLabels.slice(1, -1).join(' · ');
          return (
            <button key={option.value} type="button" onClick={() => choose(option)} aria-pressed={active} className={cn('clay-card relative min-h-24 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30', active && 'border-primary/65 bg-primary/5 ring-1 ring-primary/20')}>
              {active && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 fill-primary text-background" />}
              <h2 className="pr-8 text-base font-extrabold">{option.label}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{context || 'Vehicle for sale'}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold"><ShieldCheck className="h-4 w-4 text-primary" />Submission is open; publication is controlled</p>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Private sellers can submit directly. New vehicle listings enter review before they become public. Dealer approval is separate and unlocks dealership identity and business publishing tools.</p>
      </div>

      {error && <p className="rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
      <StepNav showBack={false} onContinue={continueToDetails} />
    </div>
  );
}
