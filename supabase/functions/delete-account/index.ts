import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "https://staging.peekalisting.com",
  "https://staging.peekalisting.pages.dev",
  "https://cars-staging.peekalisting.com",
];

const ALLOWED_ORIGINS = new Set(
  [...DEFAULT_ALLOWED_ORIGINS, ...(Deno.env.get("FINDIT_ALLOWED_ORIGINS") ?? "").split(",")]
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
);

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === "staging.peekalisting.com" || hostname === "staging.peekalisting.pages.dev" ||
      hostname === "cars-staging.peekalisting.com";
  } catch {
    return false;
  }
}

function configuredKey(name: string, legacyName: string): string {
  const direct = Deno.env.get(name) ?? Deno.env.get(legacyName);
  if (direct) return direct;
  const pluralName = name.endsWith("SECRET_KEY") ? "SUPABASE_SECRET_KEYS" : "SUPABASE_PUBLISHABLE_KEYS";
  const serialized = Deno.env.get(pluralName);
  if (serialized) {
    try {
      const values = JSON.parse(serialized) as Record<string, string>;
      const value = values.default ?? Object.values(values)[0];
      if (value) return value;
    } catch {
      throw new Error(`Invalid ${pluralName}`);
    }
  }
  throw new Error(`Missing ${name}`);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : "";
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
    "content-type": "application/json; charset=utf-8",
  };
}

const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: corsHeaders(request),
});

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  const origin = request.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return json(request, { error: "This account action origin is not allowed." }, 403);
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json(request, { error: "Sign in again to continue." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return json(request, { error: "Account deletion is temporarily unavailable." }, 503);

  let publishableKey: string;
  let secretKey: string;
  try {
    publishableKey = configuredKey("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
    secretKey = configuredKey("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  } catch (error) {
    console.error("Account deletion key configuration failed", error);
    return json(request, { error: "Account deletion is temporarily unavailable." }, 503);
  }

  let body: { confirmation?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json(request, { error: "Type DELETE to confirm." }, 400);
  }
  if ((body.confirmation || "").trim().toUpperCase() !== "DELETE") {
    return json(request, { error: "Type DELETE to confirm." }, 400);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json(request, { error: "Your session has expired. Log in again to continue." }, 401);

  const { data: prepared, error: prepareError } = await userClient.rpc("prepare_own_account_deletion", {
    p_confirmation: "DELETE",
  });
  if (prepareError) {
    const message = /administrator/i.test(prepareError.message)
      ? "Administrator accounts must transfer their responsibilities before deletion."
      : "We could not delete your account. Please try again.";
    return json(request, { error: message }, 400);
  }

  const deletedEmail = `deleted-${user.id.replaceAll("-", "")}@deleted.invalid`;
  const randomPassword = `${crypto.randomUUID()}${crypto.randomUUID()}Aa1!`;
  const { error: identityError } = await adminClient.auth.admin.updateUserById(user.id, {
    email: deletedEmail,
    password: randomPassword,
    email_confirm: true,
    ban_duration: "876000h",
    user_metadata: { deleted: true, deleted_at: new Date().toISOString() },
    app_metadata: { ...(user.app_metadata || {}), account_deleted: true },
  });

  if (identityError) {
    console.error("Account identity anonymisation failed", { userId: user.id, error: identityError.message });
    return json(
      request,
      {
        error: "Your profile was removed, but sign-in closure needs support. Please contact PeekaListing support.",
        deletion_started: true,
      },
      500,
    );
  }

  return json(request, {
    deleted: true,
    completed_at: prepared?.completed_at || new Date().toISOString(),
    retained_records_anonymised: true,
  });
});
