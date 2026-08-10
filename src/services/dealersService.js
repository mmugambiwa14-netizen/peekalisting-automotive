import { findPublicDealers } from '@/repositories/dealersRepository';
import { resolveMarketplaceImage } from '@/services/marketplaceImagesService';
import { createKeysetPage, normalizeKeysetCursor, normalizePageLimit } from '@/services/keysetPagination';

function normalizeDealerDirectoryRequest(input = {}) {
  return {
    query: String(input.query || '').trim().slice(0, 80),
    cursor: normalizeKeysetCursor(input.cursor),
    limit: normalizePageLimit(input.limit, { fallback: 24, maximum: 48 }),
  };
}

function safeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function mapDealer(row) {
  return {
    ...row,
    avatar_url: row.avatar_storage_path
      ? await resolveMarketplaceImage(row.avatar_storage_path, 'business_logo')
      : safeHttpUrl(row.avatar_url),
    public_path: `/dealer/${row.id}`,
  };
}

export async function getPublicDealersPage(input = {}) {
  const request = normalizeDealerDirectoryRequest(input);
  const page = createKeysetPage(await findPublicDealers(request), request.limit);
  return {
    items: await Promise.all(page.items.map(mapDealer)),
    nextCursor: page.nextCursor,
  };
}
