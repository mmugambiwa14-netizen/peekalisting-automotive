import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calendar, CarFront, CirclePlay, Fuel, Gauge, Palette, Settings, ShieldCheck, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GuestPromptSheet } from "@/components/auth/GuestPromptSheet";
import ContactButtons from "@/components/listings/ContactButtons";
import ListingCode from "@/components/listings/ListingCode";
import ListingDetailActions from "@/components/listings/ListingDetailActions";
import ListingFeatureItem from "@/components/listings/ListingFeatureItem";
import ListingMediaActions from "@/components/listings/ListingMediaActions";
import ListingMediaViewer from "@/components/listings/ListingMediaViewer";
import ListingRecommendations from "@/components/listings/ListingRecommendations";
import ListingSummary from "@/components/listings/ListingSummary";
import PeekThreadsSection from "@/components/peekThreads/PeekThreadsSection";
import PeekRequestIntentHandler from "@/components/peekThreads/PeekRequestIntentHandler";
import MakeOfferButton from "@/components/listings/MakeOfferButton";
import PriceBreakdown from "@/components/listings/PriceBreakdown";
import ReportListingDialog from "@/components/listings/ReportListingDialog";
import VariantSelector from "@/components/listings/VariantSelector";
import {
  ListingDescription,
  ListingDetailTabs,
  ListingLocation,
  ListingSeller,
  ListingTabSection,
} from "@/components/listings/ListingDetailTabs";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useListingFavourite } from "@/hooks/useListingFavourite";
import { useAuth } from "@/lib/AuthContext";
import { useCurrency } from "@/lib/CurrencyContext";
import { getListingPlaceholder } from "@/lib/listingPlaceholders";
import { shareListing } from "@/lib/share";
import { goBackOrHome } from "@/lib/navigation";
import { applyListingDocumentMetadata } from "@/lib/documentMetadata";
import { getPublicListing } from "@/services/publicListingsService";
import { ContactBar, DetailError, DetailLoading, DetailMissing, SafetyPanel } from "@/components/listings/ListingDetailLayout";

const placeholderCar = getListingPlaceholder("car");

const VALUE_LABELS = Object.freeze({
  fwd: "Front-wheel drive",
  rwd: "Rear-wheel drive",
  awd: "All-wheel drive",
  "4x4": "4x4",
  locally_registered: "Locally registered",
  imported_registered: "Imported, registered",
  imported_unregistered: "Imported, not yet registered",
  panel_van: "Panel van",
  minibus: "Minibus / kombi",
  bakkie: "Pickup / bakkie",
  plug_in_hybrid: "Plug-in hybrid",
  full: "Full",
  partial: "Partial",
  none: "None",
  unknown: "Unknown",
  minor: "Minor, repaired",
  major: "Major, repaired",
});

function displayValue(value) {
  if (value === null || value === undefined || value === "") return null;
  return VALUE_LABELS[value] || String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function peekFreshness(publishedAt) {
  const timestamp = Date.parse(String(publishedAt || ""));
  if (!Number.isFinite(timestamp)) return null;
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return "Captured today";
  if (days === 1) return "Captured yesterday";
  if (days < 30) return `Captured ${days} days ago`;
  const months = Math.max(1, Math.floor(days / 30));
  return `Captured about ${months} ${months === 1 ? "month" : "months"} ago`;
}

export default function CarDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const { guestOpen, guestAction, guard, closeGuest } = useGuestGuard();
  const [selectedVariant, setSelectedVariant] = useState(0);

  const { data: car, isLoading, error, refetch } = useQuery({ queryKey: ["car", id], queryFn: () => getPublicListing("car", id), enabled: Boolean(id), staleTime: 300000 });
  const { isSaved, isSaving, toggle: toggleSave } = useListingFavourite({ userId: user?.id, listingId: id, queryClient, guard });

  useEffect(() => {
    if (!car) return;
    applyListingDocumentMetadata({ title: car.title, description: car.description, imageUrl: car.photos?.[0], path: `/car/${car.id}` });
  }, [car]);

  if (isLoading) return <DetailLoading />;
  if (error) return <DetailError label="Vehicle" onRetry={refetch} />;
  if (!car) return <DetailMissing label="Vehicle" />;

  const variants = (car.variants || []).filter((variant) => variant && Number(variant.price) > 0);
  const activePrice = variants[selectedVariant]?.price ?? car.price;
  const location = car.public_location_label || [car.suburb, car.city, car.province].filter(Boolean).join(", ");
  const currentPeek = car.tour?.status === "ready" ? car.tour : null;
  const currentPeekFreshness = peekFreshness(currentPeek?.publishedAt);
  const accidentHistory = displayValue(car.accident_history);

  return (
    <div className="findit-screen pb-24">
      <PeekRequestIntentHandler />
      <ListingDetailActions onBack={() => goBackOrHome(navigate, '/')} />
      <main className="mx-auto max-w-4xl">
        <div className="relative">
          <ListingMediaViewer photos={car.photos} title={car.title} fallbackImage={placeholderCar} tour={car.tour || null} tourActionLabel="Watch current Peek" tourOwnerId={car.seller_id} parentType="listing" parentId={car.id} className="md:mt-4 md:rounded-3xl md:border" />
          <ListingMediaActions onShare={() => shareListing("car", car)} onSave={toggleSave} isSaved={isSaved} isSaving={isSaving} />
        </div>

        <ListingDetailTabs>
          <ListingTabSection id="listing-info" title="Details">
            <ListingSummary
              embedded
              badges={(
                <>
                  {car.condition && <Badge variant="secondary" className="rounded-full bg-primary/12 text-primary">Seller-declared: {displayValue(car.condition)}</Badge>}
                  {currentPeek && <Badge className="bg-success/15 text-success">Current Peek</Badge>}
                  {car.negotiable && <Badge variant="outline">Negotiable</Badge>}
                  {car.status !== "available" && <Badge variant="destructive" className="capitalize">{String(car.status).replaceAll("_", " ")}</Badge>}
                </>
              )}
              price={format(activePrice)}
              pricePrefix={variants.length > 1 ? "From" : null}
              title={car.title}
              location={location}
              metadata={[<ListingCode key="car-code" type="car" id={car.id} />]}
            />

            <section className="mt-5 rounded-3xl border border-primary/20 bg-primary/5 p-5" aria-labelledby="vehicle-evidence-title">
              <div className="flex gap-3">
                <span className="locked-icon-tile h-11 w-11 shrink-0"><CirclePlay className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="findit-overline">Visual evidence</p>
                  <h2 id="vehicle-evidence-title" className="mt-1 text-lg font-extrabold">{currentPeek ? "Current vehicle Peek available" : "No current vehicle Peek yet"}</h2>
                  {currentPeek ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Captured through PeekaListing{currentPeekFreshness ? ` · ${currentPeekFreshness}` : ""}. Watch what has been shown, then request another specific view if something important is missing.</p>
                  ) : (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Ask the seller for a current exterior walkaround, engine start, dashboard, tyres, engine bay, interior or another specific view.</p>
                  )}
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">A Peek records visual information tied to this listing. It is not a mechanical inspection, ownership verification or guarantee of condition.</p>
                </div>
              </div>
            </section>

            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h2 className="text-sm font-extrabold">Vehicle facts and seller declarations</h2></div>
              <div className="overflow-hidden rounded-3xl border border-border/80 bg-card/90 shadow-sm">
                <ListingFeatureItem icon={Calendar} label="Model year" value={car.year} />
                <ListingFeatureItem icon={Gauge} label="Mileage" value={Number.isFinite(Number(car.mileage)) ? `${Number(car.mileage).toLocaleString()} km` : null} />
                <ListingFeatureItem icon={CarFront} label="Body style" value={displayValue(car.body_type)} />
                <ListingFeatureItem icon={Fuel} label="Fuel / power" value={displayValue(car.fuel_type)} />
                <ListingFeatureItem icon={Settings} label="Transmission" value={displayValue(car.transmission)} />
                <ListingFeatureItem icon={Settings} label="Drivetrain" value={displayValue(car.drivetrain)} />
                <ListingFeatureItem icon={Palette} label="Exterior colour" value={displayValue(car.exterior_colour)} />
                <ListingFeatureItem icon={Wrench} label="Service history" value={displayValue(car.service_history) || "Not supplied"} />
                <ListingFeatureItem icon={ShieldCheck} label="Import / registration" value={displayValue(car.import_status)} />
                <ListingFeatureItem icon={ShieldCheck} label="Registration status" value={displayValue(car.registration_status)} />
              </div>
            </div>

            {car.accident_history && car.accident_history !== "none" && (
              <div className="mt-5 rounded-2xl border border-warning/30 bg-warning/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle className="h-5 w-5 text-warning" />Seller-declared accident history: {accidentHistory}</p>
              </div>
            )}

            <div className="mt-6 space-y-5">
              <PeekThreadsSection parentType="listing" parentId={car.id} listingKind="car" ownerId={car.seller_id} guard={guard} />
              <VariantSelector variants={car.variants} selectedIndex={selectedVariant} onSelect={setSelectedVariant} />
              <PriceBreakdown listing={car} />
              {car.accepts_offers && <MakeOfferButton listing={car} />}
              <SafetyPanel>A Peek can help you decide whether a vehicle is worth pursuing, but it does not replace an independent mechanical inspection. Verify seller identity and ownership documents, inspect the vehicle in person where possible, and never send money only because a video or listing looks convincing.</SafetyPanel>
              <ListingRecommendations subjectListingId={car.id} />
              <ReportListingDialog listing={car} listingType="car" />
            </div>
          </ListingTabSection>

          <ListingTabSection id="description" title="Description">
            <ListingDescription value={car.description} />
          </ListingTabSection>

          <ListingTabSection id="location" title="Location">
            <ListingLocation label={location} latitude={car.latitude} longitude={car.longitude} listingType="car" />
          </ListingTabSection>

          <ListingTabSection id="seller" title="Seller">
            <ListingSeller name={car.seller_name} sellerId={car.seller_id} joinedAt={car.seller_joined_at} activeListingCount={car.seller_active_listing_count} actions={<ContactButtons listing={car} type="car" placement="browse" />} />
          </ListingTabSection>
        </ListingDetailTabs>
      </main>
      <ContactBar><ContactButtons listing={car} type="car" /></ContactBar>
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />
    </div>
  );
}
