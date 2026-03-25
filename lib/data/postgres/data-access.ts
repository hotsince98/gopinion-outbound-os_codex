import type { DataAccess } from "@/lib/data/core/contracts";
import { createMockDataAccess } from "@/lib/data/mock/data-access";
import {
  createSupabaseServerClient,
  resolveSupabaseServerConfig,
  type PostgresConnectionConfig,
} from "@/lib/data/postgres/client";
import {
  createPostgresAppointmentRepository,
  createPostgresCampaignRepository,
  createPostgresCompanyRepository,
  createPostgresContactRepository,
  createPostgresEnrollmentRepository,
  createPostgresReplyRepository,
} from "@/lib/data/postgres/repositories";

export interface PostgresDataAccessConfig extends PostgresConnectionConfig {}

export function createPostgresDataAccess(
  config: PostgresDataAccessConfig = {},
): DataAccess {
  const supabaseConfig = resolveSupabaseServerConfig(config);
  const client = createSupabaseServerClient(supabaseConfig);
  const mockFallback = createMockDataAccess();

  return {
    companies: createPostgresCompanyRepository(client),
    contacts: createPostgresContactRepository(client),
    offers: mockFallback.offers,
    campaigns: createPostgresCampaignRepository(client),
    sequences: mockFallback.sequences,
    enrollments: createPostgresEnrollmentRepository(client),
    replies: createPostgresReplyRepository(client),
    appointments: createPostgresAppointmentRepository(client),
    experiments: mockFallback.experiments,
    insights: mockFallback.insights,
    memoryEntries: mockFallback.memoryEntries,
  };
}
