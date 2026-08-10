import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Building2, Loader2, MapPin, Search, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import BackButton from '@/components/layout/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { getPublicDealersPage } from '@/services/dealersService';

function DealerSkeletons() {
  return (
    <SkeletonRegion label="Loading dealers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-5"><div className="flex gap-4"><Skeleton className="h-16 w-16 rounded-2xl" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-full" /></div></div></div>
      ))}
    </SkeletonRegion>
  );
}

export default function Dealers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [input, setInput] = useState(query);

  useEffect(() => setInput(query), [query]);

  const dealersQuery = useInfiniteQuery({
    queryKey: ['public-automotive-dealers', query],
    queryFn: ({ pageParam }) => getPublicDealersPage({ query, cursor: pageParam || null, limit: 24 }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 60_000,
  });

  const dealers = useMemo(() => {
    const byId = new Map();
    for (const page of dealersQuery.data?.pages || []) for (const dealer of page.items) byId.set(dealer.id, dealer);
    return [...byId.values()];
  }, [dealersQuery.data]);

  const submit = (event) => {
    event.preventDefault();
    const next = input.trim().slice(0, 80);
    setSearchParams(next ? { q: next } : {});
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <BackButton className="-ml-2" fallback="/" label="Back to Discover" />
          <div className="mt-4 max-w-3xl"><p className="findit-overline">PeekaListing automotive</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Dealers</h1><p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">Browse PeekaListing-approved vehicle businesses and open each dealer's current inventory in one place.</p></div>
          <form onSubmit={submit} className="relative mt-5 max-w-2xl" role="search">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Search dealer or city" className="h-12 rounded-2xl pl-12 pr-12" aria-label="Search dealers" />
            {input && <button type="button" onClick={() => { setInput(''); setSearchParams({}); }} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground" aria-label="Clear dealer search"><X className="h-4 w-4" /></button>}
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {dealersQuery.isLoading ? <DealerSkeletons /> : dealersQuery.isError ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center"><p className="font-bold">Dealers could not be loaded</p><p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p><Button type="button" variant="outline" className="mt-4" onClick={() => dealersQuery.refetch()}>Try again</Button></div>
        ) : dealers.length ? (
          <>
            <div className="mb-4"><h2 className="text-lg font-extrabold">{query ? 'Matching dealers' : 'Browse dealers'}</h2><p className="mt-1 text-sm text-muted-foreground">{dealers.length} dealer{dealers.length === 1 ? '' : 's'} loaded</p></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dealers.map((dealer) => (
                <Link key={dealer.id} to={dealer.public_path} className="clay-card group rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-primary/30">
                  <div className="flex gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10">{dealer.avatar_url ? <img src={dealer.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <Building2 className="h-7 w-7 text-primary" />}</div>
                    <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">PeekaListing dealer</p><h3 className="mt-1 truncate text-lg font-extrabold">{dealer.company_name}</h3>{dealer.city && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{dealer.city}</p>}</div>
                  </div>
                  {dealer.description && <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{dealer.description}</p>}
                  <p className="mt-4 text-sm font-bold text-primary">View dealer inventory</p>
                </Link>
              ))}
            </div>
            {dealersQuery.hasNextPage && <div className="mt-7 flex justify-center"><Button type="button" variant="outline" className="min-w-48" disabled={dealersQuery.isFetchingNextPage} onClick={() => dealersQuery.fetchNextPage()}>{dealersQuery.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" />Loading</> : 'Load more dealers'}</Button></div>}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center"><Building2 className="mx-auto h-7 w-7 text-primary" /><h2 className="mt-3 text-lg font-extrabold">{query ? 'No dealers matched that search' : 'Dealer directory is being prepared'}</h2><p className="mt-1 text-sm text-muted-foreground">Approved dealerships will appear here as they onboard.</p></div>
        )}
      </main>
    </div>
  );
}
