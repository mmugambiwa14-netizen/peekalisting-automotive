import { supabase } from '@/lib/supabaseClient';

function failure(message, error) {
  const result = new Error(message);
  result.cause = error;
  return result;
}

export async function findPublicDealers({ query = '', cursor = null, limit = 24 } = {}) {
  const { data, error } = await supabase.rpc('public_automotive_dealers_page', {
    p_query: String(query || '').trim().slice(0, 80),
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: Math.min(Math.max(Number(limit) || 24, 1), 48),
  });
  if (error) throw failure('Unable to load dealers', error);
  return data ?? [];
}
