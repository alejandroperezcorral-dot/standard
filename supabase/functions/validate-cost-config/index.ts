import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import "../../../src/features/costing/core/costModel001WorkbookDefaults.js";
import "../../../src/features/costing/core/costModel001.js";
import "../../../src/features/costing/core/costConfigValidator.js";
import "../calculate-style-cost/contract.js";
import { corsHeaders, preflightResponse } from "../_shared/cors.ts";

type JsonResponseInit = ResponseInit & { status?: number };

const validator = (globalThis as any).CostConfigValidator;
const contract = (globalThis as any).StdtexCostingEdgeContract;

function json(data: unknown, init: JsonResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(init.headers || {})
    }
  });
}

function safeError(req: Request, status: number, code: string) {
  return json({ ok: false, error: code }, { status, headers: corsHeaders(req) });
}

function isUuid(value: unknown) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeAccessRole(value: unknown) {
  return contract.normalizeLower(value).replace(/[_-]+/g, " ");
}

function isCompanyAdminMembership(membership: any) {
  return normalizeAccessRole(membership && membership.access_role) === "company admin";
}

function mapOverride(row: any) {
  return {
    season_key: row.season_key,
    origin_key: row.origin_key,
    category_key: row.category_key,
    values: row.values || {}
  };
}

function mapComponent(row: any) {
  return {
    name: row.name,
    calculation_type: row.calculation_type,
    value: Number(row.value),
    currency: row.currency,
    percentage_basis: row.percentage_basis,
    enabled: row.enabled,
    season_key: row.season_key,
    origin_key: row.origin_key,
    category_key: row.category_key
  };
}

async function fetchUserProfile(serviceClient: any, userId: string) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id,email,role,company_type,access_role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("PROFILE_LOOKUP_FAILED");
  return data || null;
}

async function assertCanValidate(serviceClient: any, user: any, config: any) {
  const profile = await fetchUserProfile(serviceClient, user.id);
  if (contract.isPlatformAdmin(user, profile)) {
    return { ok: true, profile, platformAdmin: true };
  }
  const { data, error } = await serviceClient
    .from("company_memberships")
    .select("company_id,access_role,membership_status")
    .eq("user_id", user.id)
    .eq("company_id", config.company_id)
    .eq("membership_status", "Active")
    .maybeSingle();
  if (error) throw new Error("MEMBERSHIP_LOOKUP_FAILED");
  if (!data || !isCompanyAdminMembership(data)) {
    return { ok: false, status: 403, error: "COMPANY_ADMIN_REQUIRED" };
  }
  return { ok: true, profile, membership: data, platformAdmin: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }
  if (req.method !== "POST") return safeError(req, 405, "METHOD_NOT_ALLOWED");
  try {
    const responseHeaders = corsHeaders(req);
    if (!validator || !contract) return safeError(req, 500, "COSTING_RUNTIME_UNAVAILABLE");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return safeError(req, 500, "EDGE_ENV_MISSING");

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization) return safeError(req, 401, "UNAUTHENTICATED");

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } }
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData || !userData.user) return safeError(req, 401, "UNAUTHENTICATED");

    const body = await req.json().catch(() => null);
    const configId = body && body.configId ? String(body.configId) : "";
    if (!isUuid(configId)) return safeError(req, 400, "CONFIG_ID_REQUIRED");

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: config, error: configError } = await serviceClient
      .from("cost_config_versions")
      .select("id,company_id,cost_model_id,formula_version,config_code,lifecycle_status,base_config")
      .eq("id", configId)
      .maybeSingle();
    if (configError) throw new Error("COST_CONFIG_LOOKUP_FAILED");
    if (!config) return safeError(req, 404, "CONFIG_NOT_FOUND");
    if (config.lifecycle_status !== "DRAFT") return safeError(req, 400, "ONLY_DRAFT_CONFIGS_CAN_BE_VALIDATED");

    const authorizationResult = await assertCanValidate(serviceClient, userData.user, config);
    if (!authorizationResult.ok) return safeError(req, authorizationResult.status, authorizationResult.error);

    const [{ data: model, error: modelError }, { data: overrides, error: overrideError }, { data: components, error: componentError }] = await Promise.all([
      serviceClient
        .from("cost_models")
        .select("id,code,status,current_formula_version")
        .eq("id", config.cost_model_id)
        .maybeSingle(),
      serviceClient
        .from("cost_config_overrides")
        .select("season_key,origin_key,category_key,values")
        .eq("config_version_id", config.id),
      serviceClient
        .from("cost_additional_components")
        .select("name,calculation_type,value,currency,percentage_basis,enabled,season_key,origin_key,category_key")
        .eq("config_version_id", config.id)
    ]);
    if (modelError) throw new Error("COST_MODEL_LOOKUP_FAILED");
    if (overrideError) throw new Error("COST_OVERRIDE_LOOKUP_FAILED");
    if (componentError) throw new Error("COST_COMPONENT_LOOKUP_FAILED");
    if (!model || model.status !== "AVAILABLE") return safeError(req, 400, "COST_MODEL_NOT_AVAILABLE");

    const result = validator.validateCostConfiguration({
      modelCode: model.code,
      formulaVersion: config.formula_version,
      baseConfig: config.base_config,
      overrides: (overrides || []).map(mapOverride),
      additionalComponents: (components || []).map(mapComponent)
    });

    if (!result.valid) {
      return json({
        ok: true,
        valid: false,
        status: "INVALID",
        configId: config.id,
        formulaVersion: config.formula_version,
        errors: result.errors || []
      }, { headers: responseHeaders });
    }

    const { data: marked, error: markError } = await serviceClient.rpc("mark_cost_config_semantically_validated", {
      p_config_version_id: config.id,
      p_formula_version: config.formula_version,
      p_validation_result: {
        validator: "CostConfigValidator",
        modelCode: model.code,
        formulaVersion: config.formula_version,
        status: "VALID"
      }
    });
    if (markError) throw new Error("SEMANTIC_VALIDATION_MARK_FAILED");

    console.log("validate-cost-config", JSON.stringify({
      configId: config.id,
      companyId: config.company_id,
      valid: true,
      platformAdmin: !!authorizationResult.platformAdmin
    }));
    return json({
      ok: true,
      valid: true,
      status: "VALID",
      configId: config.id,
      formulaVersion: config.formula_version,
      semanticValidationStatus: marked && marked.semantic_validation_status ? marked.semantic_validation_status : "VALID"
    }, { headers: responseHeaders });
  } catch (err) {
    console.error("validate-cost-config failed", err instanceof Error ? err.message : String(err));
    return safeError(req, 500, "COST_CONFIG_VALIDATION_SERVICE_ERROR");
  }
});
