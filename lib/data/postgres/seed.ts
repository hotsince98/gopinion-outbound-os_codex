import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mockAppointments,
  mockCampaigns,
  mockCompanies,
  mockContacts,
  mockReplies,
} from "@/lib/data/mock/store";
import {
  createSupabaseServerClient,
  resolveSupabaseServerConfig,
  type PostgresConnectionConfig,
} from "@/lib/data/postgres/client";
import {
  mapAppointmentDomainToRow,
  mapCampaignDomainToRow,
  mapCompanyDomainToRow,
  mapContactDomainToRow,
  mapReplyDomainToRow,
} from "@/lib/data/postgres/mappers";
import type {
  AppointmentRow,
  CampaignRow,
  CompanyRow,
  ContactRow,
  ReplyRow,
} from "@/lib/data/postgres/schema";

export interface CoreSeedCounts {
  companies: number;
  contacts: number;
  campaigns: number;
  replies: number;
  appointments: number;
}

export interface CoreSeedPayload {
  companies: CompanyRow[];
  contacts: ContactRow[];
  campaigns: CampaignRow[];
  replies: ReplyRow[];
  appointments: AppointmentRow[];
}

export function getCoreSeedPayload(): CoreSeedPayload {
  return {
    companies: mockCompanies.map(mapCompanyDomainToRow),
    contacts: mockContacts.map(mapContactDomainToRow),
    campaigns: mockCampaigns.map(mapCampaignDomainToRow),
    replies: mockReplies.map(mapReplyDomainToRow),
    appointments: mockAppointments.map(mapAppointmentDomainToRow),
  };
}

function createSeedCounts(payload: CoreSeedPayload): CoreSeedCounts {
  return {
    companies: payload.companies.length,
    contacts: payload.contacts.length,
    campaigns: payload.campaigns.length,
    replies: payload.replies.length,
    appointments: payload.appointments.length,
  };
}

async function upsertRows<T extends { id: string }>(
  client: SupabaseClient,
  table: string,
  rows: readonly T[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from(table).upsert(rows as never, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(`Supabase seed upsert failed for ${table}: ${error.message}`);
  }
}

export async function seedSupabaseCoreEntities(
  config: PostgresConnectionConfig = {},
): Promise<CoreSeedCounts> {
  const payload = getCoreSeedPayload();
  const client = createSupabaseServerClient(resolveSupabaseServerConfig(config));

  await upsertRows(client, "companies", payload.companies);
  await upsertRows(client, "contacts", payload.contacts);
  await upsertRows(client, "campaigns", payload.campaigns);
  await upsertRows(client, "replies", payload.replies);
  await upsertRows(client, "appointments", payload.appointments);

  return createSeedCounts(payload);
}
