import { findApprovedAutomotiveDealerIdentities } from '@/repositories/dealerIdentityRepository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH = 50;

function sellerIds(listings) {
  const ids = [];
  const seen = new Set();
  for (const listing of listings) {
    if (listing?.kind !== 'car' || typeof listing.seller_id !== 'string' || !UUID.test(listing.seller_id) || seen.has(listing.seller_id)) continue;
    seen.add(listing.seller_id);
    ids.push(listing.seller_id);
    if (ids.length === MAX_BATCH) break;
  }
  return ids;
}

function neutralIdentity(listing) {
  if (listing?.kind !== 'car') return listing;
  return {
    ...listing,
    seller_type: 'seller',
    dealer_profile_id: null,
    dealer_company_name: null,
    dealer_city: null,
  };
}

/**
 * Adds current dealership identity to vehicle listings in one bounded lookup.
 * If the optional identity lookup is temporarily unavailable, marketplace reads
 * remain usable but the seller is shown neutrally rather than falsely labelled
 * as either a private seller or an approved dealer.
 */
export async function attachAutomotiveDealerIdentities(listings) {
  const source = Array.isArray(listings) ? listings : [];
  const ids = sellerIds(source);
  if (ids.length === 0) return source;

  let rows;
  try {
    rows = await findApprovedAutomotiveDealerIdentities(ids);
  } catch {
    return source.map(neutralIdentity);
  }

  const bySellerId = new Map(rows.map((row) => [row.seller_user_id, row]));
  return source.map((listing) => {
    if (listing?.kind !== 'car') return listing;
    const identity = bySellerId.get(listing.seller_id);
    if (!identity) {
      return {
        ...listing,
        seller_type: 'private',
        dealer_profile_id: null,
        dealer_company_name: null,
        dealer_city: null,
      };
    }
    return {
      ...listing,
      seller_type: 'dealer',
      dealer_profile_id: identity.dealer_profile_id,
      dealer_company_name: identity.company_name,
      dealer_city: identity.city || null,
    };
  });
}
