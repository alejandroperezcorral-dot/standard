const PRODUCTION_ORIGINS = [
  "https://stdtex.com",
  "https://fw26-buying-tool.netlify.app"
];

const LOCAL_ORIGINS = [
  "http://127.0.0.1:8790",
  "http://localhost:8790"
];

function parseOrigins(value: string | null) {
  return (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function runtimeEnvironment() {
  return (Deno.env.get("STDTEX_EDGE_ENV") || Deno.env.get("STDTEX_ENV") || "production").toLowerCase();
}

function allowedOrigins() {
  const configured = parseOrigins(Deno.env.get("STDTEX_ALLOWED_ORIGINS"));
  const origins = configured.length ? configured : PRODUCTION_ORIGINS.slice();
  const env = runtimeEnvironment();
  if (env === "local" || env === "development" || env === "test") {
    origins.push(...LOCAL_ORIGINS);
  }
  return new Set(origins);
}

export function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  if (!allowedOrigins().has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

export function preflightResponse(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
