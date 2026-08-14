import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import "../../../src/features/costing/core/costModel001.js";
import "./contract.js";

type JsonResponseInit = ResponseInit & { status?: number };

const core = (globalThis as any).CostModel001Core;
const contract = (globalThis as any).StdtexCostingEdgeContract;

const STYLE_COLUMNS = [
  "id","modelo","description","supplier","origin","transport","temporada","dept","cat",
  "pvp_rub","fob1","fob2","fob3","fob_closed","weight","units","target_imu",
  "status","fsd","hod","user_id"
].join(",");

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

function safeError(status: number, code: string) {
  return json({ ok: false, error: code }, { status });
}

function mapOverride(row: any) {
  return {
    id: row.id,
    scope: { origin: row.origin_key, category: row.category_key },
    period: { season: row.season_key },
    values: row.values || {},
    source: row.source_reference || "Company override"
  };
}

function buildConfiguration(version: any, overrides: any[]) {
  const base = version && version.base_config ? version.base_config : {};
  const model = Object.assign({}, base, {
    dutyOverrides: (overrides || []).map(mapOverride),
    configurationVersion: version && version.config_code ? version.config_code : null
  });
  return core.createCostModel001Configuration(model);
}

function resolveForStyle(configuration: any, input: any) {
  return core.resolveCostModelConfiguration({
    model: configuration,
    context: {
      season: input.season,
      department: input.department,
      category: input.category,
      origin: input.origin
    }
  });
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

async function deriveCompanyScope(serviceClient: any, user: any, body: any) {
  const profile = await fetchUserProfile(serviceClient, user.id);
  const platformAdmin = contract.isPlatformAdmin(user, profile);

  if (platformAdmin) {
    const targetCompanyId = body && body.targetCompanyId ? String(body.targetCompanyId) : "";
    if (!targetCompanyId) {
      return { ok: false, status: 400, error: "PLATFORM_ADMIN_TARGET_COMPANY_REQUIRED" };
    }
    const { data: company, error: companyError } = await serviceClient
      .from("companies")
      .select("id,name,type,status")
      .eq("id", targetCompanyId)
      .maybeSingle();
    if (companyError) throw new Error("COMPANY_LOOKUP_FAILED");
    if (!company) return { ok: false, status: 403, error: "COMPANY_SCOPE_DENIED" };
    return { ok: true, platformAdmin: true, company, profile };
  }

  const { data: memberships, error } = await serviceClient
    .from("company_memberships")
    .select("company_id,access_role,membership_status,companies(id,name,type,status)")
    .eq("user_id", user.id)
    .eq("membership_status", "Active");
  if (error) throw new Error("MEMBERSHIP_LOOKUP_FAILED");
  if (!memberships || memberships.length < 1) {
    return { ok: false, status: 403, error: "NO_ACTIVE_COMPANY_MEMBERSHIP" };
  }
  if (memberships.length > 1) {
    return { ok: false, status: 403, error: "MULTIPLE_COMPANY_MEMBERSHIPS" };
  }
  const membership = memberships[0];
  const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;
  if (!company) return { ok: false, status: 403, error: "COMPANY_SCOPE_DENIED" };
  return { ok: true, platformAdmin: false, company, profile, membership };
}

async function buildAuthorizationScope(serviceClient: any, companyScope: any, styleIds: number[]) {
  const company = companyScope.company;
  const groupNames: Record<string, boolean> = {};
  const companyUserIds: Record<string, boolean> = {};
  const supplierAccess: Record<string, any[]> = {};
  const collectionAssignments: Record<string, any[]> = {};

  const { data: companyMembers, error: memberError } = await serviceClient
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", company.id)
    .eq("membership_status", "Active");
  if (memberError) throw new Error("COMPANY_MEMBER_SCOPE_FAILED");
  (companyMembers || []).forEach((row: any) => {
    if (row.user_id) companyUserIds[String(row.user_id)] = true;
  });

  const { data: groupMemberships, error: groupError } = await serviceClient
    .from("company_group_memberships")
    .select("company_group_id")
    .eq("company_id", company.id)
    .eq("user_id", companyScope.profile && companyScope.profile.id ? companyScope.profile.id : "");
  if (groupError) throw new Error("GROUP_SCOPE_FAILED");
  const groupIds = (groupMemberships || [])
    .map((row: any) => row.company_group_id)
    .filter(Boolean);
  if (groupIds.length) {
    const { data: groups, error: groupNameError } = await serviceClient
      .from("company_groups")
      .select("id,name")
      .in("id", groupIds)
      .eq("company_id", company.id);
    if (groupNameError) throw new Error("GROUP_NAME_SCOPE_FAILED");
    (groups || []).forEach((group: any) => {
      if (group && group.name) groupNames[contract.normalizeLower(group.name)] = true;
    });
  }

  if (contract.normalizeLower(company.type) === "brand") {
    const { data: accessRows, error: accessError } = await serviceClient
      .from("supplier_brand_access")
      .select("supplier_company,brand_company,group_name,status")
      .eq("status", "Active");
    if (accessError) throw new Error("SUPPLIER_ACCESS_SCOPE_FAILED");
    (accessRows || []).forEach((row: any) => {
      if (contract.normalizeLower(row.brand_company) !== contract.normalizeLower(company.name)) return;
      const key = contract.normalizeLower(row.supplier_company);
      if (!key) return;
      if (!supplierAccess[key]) supplierAccess[key] = [];
      supplierAccess[key].push(row);
    });
  }

  const { data: assignments, error: assignmentError } = await serviceClient
    .from("style_collection_assignments")
    .select("row_id,owner_company,owner_group,owner_type")
    .in("row_id", styleIds);
  if (assignmentError) throw new Error("COLLECTION_ASSIGNMENT_SCOPE_FAILED");
  (assignments || []).forEach((row: any) => {
    const key = String(row.row_id);
    if (!collectionAssignments[key]) collectionAssignments[key] = [];
    collectionAssignments[key].push(row);
  });

  return {
    platformAdmin: companyScope.platformAdmin,
    company,
    companyUserIds,
    groupNames,
    supplierAccess,
    collectionAssignments
  };
}

async function loadActiveConfiguration(serviceClient: any, companyId: string) {
  const { data: settings, error: settingsError } = await serviceClient
    .from("company_costing_settings")
    .select("company_id,cost_source_type,active_config_version_id,fallback_behavior")
    .eq("company_id", companyId)
    .maybeSingle();
  if (settingsError) throw new Error("COST_SETTINGS_LOOKUP_FAILED");
  if (!settings || settings.cost_source_type !== "STDTEX_MODEL" || !settings.active_config_version_id) {
    return { ok: false, status: "NOT_AVAILABLE", reason: "FOB_ONLY" };
  }

  const { data: version, error: versionError } = await serviceClient
    .from("cost_config_versions")
    .select("id,company_id,formula_version,config_code,lifecycle_status,semantic_validation_status,base_config")
    .eq("id", settings.active_config_version_id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (versionError) throw new Error("COST_CONFIG_LOOKUP_FAILED");
  if (!version || version.lifecycle_status !== "ACTIVE" || version.formula_version !== 1) {
    return { ok: false, status: "NOT_AVAILABLE", reason: "NO_ACTIVE_MODEL_001_CONFIG" };
  }

  const { data: components, error: componentsError } = await serviceClient
    .from("cost_additional_components")
    .select("id,enabled")
    .eq("config_version_id", version.id)
    .eq("enabled", true);
  if (componentsError) throw new Error("COST_COMPONENT_LOOKUP_FAILED");
  if (components && components.length) {
    return { ok: false, status: "ERROR", reason: "ADDITIONAL_COMPONENTS_NOT_SUPPORTED" };
  }

  const { data: overrides, error: overrideError } = await serviceClient
    .from("cost_config_overrides")
    .select("id,season_key,origin_key,category_key,values,source_reference")
    .eq("config_version_id", version.id);
  if (overrideError) throw new Error("COST_OVERRIDE_LOOKUP_FAILED");

  return {
    ok: true,
    settings,
    version,
    overrides: overrides || [],
    configuration: buildConfiguration(version, overrides || [])
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return safeError(405, "METHOD_NOT_ALLOWED");
  try {
    if (!core || !contract) return safeError(500, "COSTING_RUNTIME_UNAVAILABLE");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return safeError(500, "EDGE_ENV_MISSING");

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization) return safeError(401, "UNAUTHENTICATED");

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } }
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData || !userData.user) return safeError(401, "UNAUTHENTICATED");

    const body = await req.json().catch(() => null);
    const parsed = contract.normalizeStyleIds(body && body.styleIds);
    if (!parsed.ok) return safeError(400, parsed.error);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const companyScope = await deriveCompanyScope(serviceClient, userData.user, body || {});
    if (!companyScope.ok) return safeError(companyScope.status, companyScope.error);

    const [authorizationScope, activeConfig] = await Promise.all([
      buildAuthorizationScope(serviceClient, companyScope, parsed.styleIds),
      loadActiveConfiguration(serviceClient, companyScope.company.id)
    ]);

    const { data: styles, error: styleError } = await serviceClient
      .from("negotiation_rows")
      .select(STYLE_COLUMNS)
      .in("id", parsed.styleIds);
    if (styleError) throw new Error("STYLE_LOOKUP_FAILED");

    const stylesById: Record<string, any> = {};
    (styles || []).forEach((style: any) => {
      stylesById[String(style.id)] = style;
    });

    const results = parsed.styleIds.map((styleId: number) => {
      const style = stylesById[String(styleId)];
      if (!style) return contract.noCostResult(styleId, "DENIED", "STYLE_NOT_AVAILABLE", null);
      if (!contract.styleIsAuthorized(style, authorizationScope)) {
        return contract.noCostResult(styleId, "DENIED", "STYLE_NOT_AVAILABLE", null);
      }
      const normalized = core.normalizeCostingInput(style, {
        season: style.temporada || null,
        department: style.dept || null,
        category: style.cat || null,
        origin: style.origin || null,
        currency: style.currency || "USD"
      });
      const fob = normalized.fob == null ? null : Number(normalized.fob);
      if (!activeConfig.ok) {
        return contract.noCostResult(styleId, activeConfig.status, activeConfig.reason, fob);
      }
      const resolved = resolveForStyle(activeConfig.configuration, normalized);
      const result = core.evaluateCostModel001(normalized, resolved);
      return contract.sanitizeCostResult(styleId, result, {
        currency: normalized.currency,
        configurationVersion: activeConfig.version.config_code
      });
    });

    const response = {
      ok: true,
      source: "STDTEX_MODEL",
      model: "cost-model-001",
      formulaVersion: 1,
      count: results.length,
      results
    };
    if (contract.responseContainsForbiddenKey(response)) {
      return safeError(500, "COST_RESPONSE_PRIVACY_FAILURE");
    }
    return json(response);
  } catch (err) {
    console.error("calculate-style-cost failed", err instanceof Error ? err.message : String(err));
    return safeError(500, "COSTING_SERVICE_ERROR");
  }
});
