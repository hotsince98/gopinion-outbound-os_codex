import { createMockDataAccess } from "@/lib/data/mock/data-access";
import { createPostgresDataAccess } from "@/lib/data/postgres/data-access";
import type { DataAccess } from "@/lib/data/core/contracts";

export const dataBackends = ["mock", "postgres"] as const;
export type DataBackend = (typeof dataBackends)[number];

let cachedDataAccess: DataAccess | undefined;

function parseDataBackend(value: string | undefined): DataBackend {
  return value === "postgres" ? "postgres" : "mock";
}

export function getConfiguredDataBackend(): DataBackend {
  return parseDataBackend(process.env.DATA_BACKEND);
}

export function createDataAccess(
  backend: DataBackend = getConfiguredDataBackend(),
): DataAccess {
  switch (backend) {
    case "postgres":
      return createPostgresDataAccess({
        url: process.env.DATABASE_URL,
        schema: "public",
        provider: "supabase",
      });
    case "mock":
      return createMockDataAccess();
  }
}

export function getDataAccess(): DataAccess {
  cachedDataAccess ??= createDataAccess();

  return cachedDataAccess;
}

export function resetDataAccessCache() {
  cachedDataAccess = undefined;
}
