// Integration API — exposes the CRM data over REST so external agents
// (e.g. Claude Code) can read and write it, including scheduling data
// (tasks, pre_vendas_agenda, opportunity_activities, ...).
//
// Auth: dedicated bearer token in `Authorization: Bearer <API_TOKEN>` or
// `x-api-key: <API_TOKEN>`. The token is a Supabase secret (never the
// service_role key). All DB access uses the service role server-side.
//
// Routes (base: /functions/v1/api):
//   GET    /                  → discover available routes
//   GET    /_schema           → tables, columns and relationships
//   GET    /:table            → list (select, filters, order, limit, offset, count)
//   GET    /:table/:id        → single row by id
//   POST   /:table            → insert (object or array); ?upsert=true&on_conflict=col
//   PATCH  /:table/:id        → update by id (or /:table?filters)
//   DELETE /:table/:id        → delete by id (or /:table?filters)
//
// Filters use PostgREST syntax in the query string, e.g.:
//   ?status=eq.pending&due_date=lt.2026-10-10&assigned_to=in.(uuid1,uuid2)
// supported operators: eq, neq, gt, gte, lt, lte, like, ilike, in, is
// plus `not.` prefix (e.g. ?status=not.eq.done).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_TOKEN = Deno.env.get("API_TOKEN") ?? "";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"]);
const RESERVED_KEYS = new Set([
  "select",
  "order",
  "limit",
  "offset",
  "count",
  "on_conflict",
  "upsert",
]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function coerce(value: string): unknown {
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function applyFilters(query: any, params: URLSearchParams): any {
  for (const [key, raw] of params.entries()) {
    if (RESERVED_KEYS.has(key)) continue;
    let op = "eq";
    let value = raw;
    const negate = value.startsWith("not.");
    if (negate) value = value.slice(4);
    const dot = value.indexOf(".");
    if (dot > 0 && OPS.has(value.slice(0, dot))) {
      op = value.slice(0, dot);
      value = value.slice(dot + 1);
    }
    if (negate) {
      query = query.not(key, op, coerce(value));
      continue;
    }
    if (op === "in") {
      const items = value.replace(/^\(|\)$/g, "").split(",").map((v) => coerce(v.trim()));
      query = query.in(key, items);
    } else if (op === "is") {
      query = query.is(key, coerce(value));
    } else {
      query = query[op](key, coerce(value));
    }
  }
  return query;
}

function applyOrder(query: any, order: string | null): any {
  if (!order) return query;
  for (const clause of order.split(",")) {
    const [column, dir] = clause.split(".");
    if (!column) continue;
    query = query.order(column.trim(), { ascending: (dir ?? "asc").toLowerCase() !== "desc" });
  }
  return query;
}

function activeFilterCount(params: URLSearchParams): number {
  let n = 0;
  for (const key of params.keys()) if (!RESERVED_KEYS.has(key)) n++;
  return n;
}

function dbError(error: any): Response {
  const code = error?.code ?? "";
  const status =
    code === "23505" || code === "23503"
      ? 409
      : code === "23502" || code === "23514" || code === "22P02"
        ? 400
        : code === "42501"
          ? 403
          : code === "PGRST116"
            ? 404
            : 400;
  return jsonResponse(
    {
      error: {
        message: error?.message ?? "Erro no banco de dados",
        code,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
      },
    },
    status,
  );
}

async function handleGet(
  client: SupabaseClient,
  table: string,
  id: string | undefined,
  params: URLSearchParams,
): Promise<Response> {
  const select = params.get("select") ?? "*";
  const wantsCount = params.get("count") === "exact";
  let query = client.from(table).select(select, wantsCount ? { count: "exact" } : undefined);

  if (id) {
    query = applyFilters(query, params).eq("id", id).limit(1);
  } else {
    query = applyFilters(query, params);
    query = applyOrder(query, params.get("order"));
    const limit = Math.min(parseInt(params.get("limit") ?? "100", 10) || 100, 1000);
    const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;
  if (error) return dbError(error);
  if (id) return jsonResponse({ data: Array.isArray(data) ? (data[0] ?? null) : data });
  return jsonResponse({ data, count: wantsCount ? count : undefined });
}

async function handlePost(
  client: SupabaseClient,
  table: string,
  req: Request,
  params: URLSearchParams,
): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (body === null) return jsonResponse({ error: { message: "JSON inválido" } }, 400);

  const upsert = params.get("upsert") === "true";
  const onConflict = params.get("on_conflict") ?? undefined;
  const query = upsert
    ? client.from(table).upsert(body as any, onConflict ? { onConflict } : undefined)
    : client.from(table).insert(body as any);

  const { data, error } = await query.select();
  if (error) return dbError(error);
  return jsonResponse({ data }, 201);
}

async function handlePatch(
  client: SupabaseClient,
  table: string,
  id: string | undefined,
  req: Request,
  params: URLSearchParams,
): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: { message: "Corpo deve ser um objeto JSON" } }, 400);
  }

  let query = client.from(table).update(body as any);
  if (id) {
    query = query.eq("id", id);
  } else {
    if (activeFilterCount(params) === 0) {
      return jsonResponse(
        { error: { message: "Informe /:table/:id ou ao menos um filtro para atualizar" } },
        400,
      );
    }
    query = applyFilters(query, params);
  }

  const { data, error } = await query.select();
  if (error) return dbError(error);
  return jsonResponse({ data });
}

async function handleDelete(
  client: SupabaseClient,
  table: string,
  id: string | undefined,
  params: URLSearchParams,
): Promise<Response> {
  let query = client.from(table).delete();
  if (id) {
    query = query.eq("id", id);
  } else {
    if (activeFilterCount(params) === 0) {
      return jsonResponse(
        { error: { message: "Informe /:table/:id ou ao menos um filtro para remover" } },
        400,
      );
    }
    query = applyFilters(query, params);
  }

  const { data, error } = await query.select();
  if (error) return dbError(error);
  return jsonResponse({ data });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = req.headers.get("x-api-key") ??
    (req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  if (!API_TOKEN || !token || !timingSafeEqual(token, API_TOKEN)) {
    return jsonResponse({ error: { message: "Unauthorized" } }, 401);
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("api");
  const route = idx >= 0 ? parts.slice(idx + 1) : [];
  const params = url.searchParams;

  try {
    if (route.length === 0) {
      return jsonResponse({
        name: "Evolua CRM API",
        version: "1.0.0",
        discovery: "/functions/v1/api/_schema",
        endpoints: {
          "GET    /:table": "lista (select, filtros, order, limit, offset, count)",
          "GET    /:table/:id": "registro por id",
          "POST   /:table": "cria objeto/array; ?upsert=true&on_conflict=col",
          "PATCH  /:table/:id": "atualiza por id (ou /:table?filtros)",
          "DELETE /:table/:id": "remove por id (ou /:table?filtros)",
          "GET    /_schema": "tabelas, colunas e relacionamentos",
        },
      });
    }

    if (route[0] === "_schema") {
      const { data, error } = await client.rpc("api_schema");
      if (error) return dbError(error);
      return jsonResponse({ data });
    }

    if (route[0] === "_health") return jsonResponse({ ok: true });

    const table = route[0];
    if (!/^[a-z_][a-z0-9_]*$/i.test(table)) {
      return jsonResponse({ error: { message: "Nome de tabela inválido" } }, 400);
    }
    const id = route[1];

    switch (req.method) {
      case "GET":
        return await handleGet(client, table, id, params);
      case "POST":
        return await handlePost(client, table, req, params);
      case "PATCH":
        return await handlePatch(client, table, id, req, params);
      case "DELETE":
        return await handleDelete(client, table, id, params);
      default:
        return jsonResponse({ error: { message: `Método ${req.method} não suportado` } }, 405);
    }
  } catch (e) {
    return jsonResponse({ error: { message: (e as Error)?.message ?? String(e) } }, 400);
  }
});
