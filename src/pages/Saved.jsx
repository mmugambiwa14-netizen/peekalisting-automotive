import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import ListingGrid from "@/components/listings/ListingGrid";
import ServiceGrid from "@/components/services/ServiceGrid";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/AuthContext";
import { getFavouriteListingsPage } from "@/services/favouritesService";
import { getFavouriteServicesPage } from "@/services/serviceFavouritesService";
import { CardGridSkeleton } from '@/components/loading/LoadingSkeletons';

export default function Saved() {
  const { user } = useAuth();
  const favouritesQuery = useInfiniteQuery({
    queryKey: ["favourite-listings", user?.id],
    queryFn: ({ pageParam }) => getFavouriteListingsPage(user.id, { cursor: pageParam || null, limit: 30 }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });
  const favourites = useMemo(() => {
    const byId = new Map();
    for (const page of favouritesQuery.data?.pages || []) {
      for (const listing of page.items) byId.set(listing.id, listing);
    }
    return [...byId.values()];
  }, [favouritesQuery.data]);
  const servicesQuery = useInfiniteQuery({
    queryKey: ["favourite-services", user?.id],
    queryFn: ({ pageParam }) => getFavouriteServicesPage(user.id, { cursor: pageParam || null, limit: 30 }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });
  const savedServices = useMemo(() => {
    const byId = new Map();
    for (const page of servicesQuery.data?.pages || []) {
      for (const service of page.items) byId.set(service.id, service);
    }
    return [...byId.values()];
  }, [servicesQuery.data]);
  const { isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = favouritesQuery;
  const savedCars = favourites.filter((listing) => listing._type === "car");
  const totalSaved = savedCars.length + savedServices.length;
  const savedIds = savedCars.map((listing) => listing.id);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" aria-label="Back to Discover" className="flex h-11 w-11 items-center justify-center rounded-xl"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex items-center gap-1.5">
          <Bookmark className="w-4 h-4 text-primary" />
          <h1 className="font-bold text-lg">Saved</h1>
        </div>
        {totalSaved > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">{totalSaved} saved</span>
        )}
      </div>

      {isLoading || servicesQuery.isLoading ? (
        <CardGridSkeleton count={6} className="px-4 py-4" label="Loading saved items" />
      ) : totalSaved === 0 && (isError || servicesQuery.isError) ? (
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <Bookmark className="mb-3 h-12 w-12 stroke-1 text-muted-foreground" />
          <p className="font-medium">Saved items could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button type="button" onClick={() => { void refetch(); void servicesQuery.refetch(); }} className="mt-4">Try again</Button>
        </div>
      ) : totalSaved === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Bookmark className="w-12 h-12 mb-3 stroke-1" />
          <p className="font-medium">No saved cars or services yet</p>
          <p className="text-sm mt-1">Tap the heart icon on a car or service to keep it here</p>
        </div>
      ) : (
        <div className="px-4 py-4">
          <Tabs defaultValue={savedCars.length ? "cars" : "services"}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cars">Cars ({savedCars.length})</TabsTrigger>
              <TabsTrigger value="services">Services ({savedServices.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="cars" className="mt-4">
              <ListingGrid listings={savedCars} type="car" savedIds={savedIds} />
            </TabsContent>
            <TabsContent value="services" className="mt-4">
              {servicesQuery.isError ? (
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <p>Saved services could not be loaded.</p>
                  <Button type="button" variant="outline" className="mt-4" onClick={() => servicesQuery.refetch()}>Try again</Button>
                </div>
              ) : <ServiceGrid services={savedServices} isLoading={servicesQuery.isLoading} />}
              {servicesQuery.hasNextPage && (
                <div className="mt-6 flex justify-center">
                  <Button type="button" variant="outline" className="min-w-48" disabled={servicesQuery.isFetchingNextPage} onClick={() => servicesQuery.fetchNextPage()}>
                    {servicesQuery.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</> : 'Load more services'}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
          {isError && <p className="mt-4 text-center text-sm text-destructive">Some saved listings could not be loaded. <button type="button" className="font-semibold underline" onClick={() => refetch()}>Try again</button></p>}
          {hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button type="button" variant="outline" className="min-w-48" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</> : 'Load more favourites'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
