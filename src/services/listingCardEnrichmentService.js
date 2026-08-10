import { attachAutomotiveDealerIdentities } from '@/services/dealerIdentityService';
import { hydrateListingCardImages } from '@/services/listingCreationService';
import { mapPublicListing } from '@/services/listingMappers';
import { attachPublicTourSummaries } from '@/services/listingToursService';

/**
 * Builds the public card projection with independent remote enrichments running
 * in parallel: cover-image signing, Peek summary lookup and current automotive
 * dealer identity. Detail pages intentionally use the full media boundary.
 */
export async function enrichPublicListingCards(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (source.length === 0) return [];

  const baseListings = source.map(mapPublicListing);
  const [hydratedRows, tourListings, identityListings] = await Promise.all([
    hydrateListingCardImages(source),
    attachPublicTourSummaries(baseListings, 'listing'),
    attachAutomotiveDealerIdentities(baseListings),
  ]);
  const tourById = new Map(tourListings.map((listing) => [listing.id, listing.tour ?? null]));
  const identityById = new Map(identityListings.map((listing) => [listing.id, {
    seller_type: listing.seller_type,
    dealer_profile_id: listing.dealer_profile_id,
    dealer_company_name: listing.dealer_company_name,
    dealer_city: listing.dealer_city,
  }]));

  return hydratedRows.map(mapPublicListing).map((listing) => ({
    ...listing,
    tour: tourById.get(listing.id) ?? null,
    ...(identityById.get(listing.id) || {}),
  }));
}
