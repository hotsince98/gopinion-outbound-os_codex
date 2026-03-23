import type { DataAccess } from "@/lib/data/core/contracts";
import type { PostgresConnectionConfig } from "@/lib/data/postgres/client";

export interface PostgresDataAccessConfig extends PostgresConnectionConfig {}

export function createPostgresDataAccess(
  config: PostgresDataAccessConfig = {},
): DataAccess {
  const provider = config.provider ?? "supabase";
  const target = config.url ?? "DATABASE_URL";

  throw new Error(
    `Postgres data access is not wired yet for provider "${provider}" (${target}). Keep DATA_BACKEND=mock for now and follow docs/persistence-plan.md before enabling Postgres.`,
  );
}
