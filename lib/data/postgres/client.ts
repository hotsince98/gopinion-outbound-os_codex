import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@/lib/data/postgres/schema";

export type PostgresProvider = "supabase" | "postgres";

export interface PostgresConnectionConfig {
  provider?: PostgresProvider;
  url?: string;
  serviceRoleKey?: string;
  schema?: string;
}

export interface SupabaseServerConfig {
  provider: "supabase";
  url: string;
  serviceRoleKey: string;
  schema: string;
}

export function resolveSupabaseServerConfig(
  config: PostgresConnectionConfig = {},
): SupabaseServerConfig {
  const provider = config.provider ?? "supabase";
  if (provider !== "supabase") {
    throw new Error(
      `Unsupported Postgres provider "${provider}". The first persistence layer only supports Supabase-backed Postgres.`,
    );
  }

  const url = config.url ?? process.env.SUPABASE_URL;
  const serviceRoleKey =
    config.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = config.schema ?? process.env.SUPABASE_DB_SCHEMA ?? "public";

  if (!url) {
    throw new Error(
      "SUPABASE_URL is required when DATA_BACKEND=postgres.",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required when DATA_BACKEND=postgres.",
    );
  }

  if (schema !== "public") {
    throw new Error(
      `Unsupported Supabase schema "${schema}". The first Postgres tranche currently targets the public schema only.`,
    );
  }

  return {
    provider,
    url,
    serviceRoleKey,
    schema,
  };
}

export function createSupabaseServerClient(
  config: SupabaseServerConfig,
): SupabaseClient {
  return createClient<Database>(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "gopinion-outbound-os/server",
      },
    },
  });
}
