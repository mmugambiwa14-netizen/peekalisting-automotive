import { supabase } from '@/lib/supabaseClient';

export async function findApprovedAutomotiveDealerIdentities(sellerUserIds) {
  if (!Array.isArray(sellerUserIds) || sellerUserIds.length === 0) return [];

  const { data, error } = await supabase.rpc('public_automotive_dealer_identities', {
    p_user_ids: sellerUserIds,
  });

  if (error) {
    const repositoryError = new Error('Unable to load automotive dealer identities');
    repositoryError.cause = error;
    throw repositoryError;
  }

  return data ?? [];
}
