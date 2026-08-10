import { supabase } from '@/lib/supabaseClient';
import { applyDescendingCreatedAtCursor } from '@/services/keysetPagination';

const PUBLIC_DEALER_SELECT = `
  id,
  user_id,
  company_name,
  business_type,
  profile_type,
  verified,
  city,
  address,
  description,
  avatar_url,
  avatar_storage_path,
  created_at,
  updated_at
`;

function failure(message, error) {
  const result = new Error(message);
  result.cause = error;
  return result;
}

function safeSearchTerm(value) {
  return String(value || '').trim().slice(0, 80).replace(/[,%()]/g, ' ');
}

export async function findPublicDealers({ query = '', cursor = null, limit = 24 } = {}) {
  let request = supabase
    .from('business_profiles_public')
    .select(PUBLIC_DEALER_SELECT)
    .eq('profile_type', 'dealer')
    .eq('verified', true);

  const search = safeSearchTerm(query);
  if (search) {
    const pattern = `%${search}%`;
    request = request.or(`company_name.ilike.${pattern},city.ilike.${pattern},description.ilike.${pattern}`);
  }
  request = applyDescendingCreatedAtCursor(request, cursor);

  const { data, error } = await request
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 24, 1), 48) + 1);

  if (error) throw failure('Unable to load dealers', error);
  return data ?? [];
}
