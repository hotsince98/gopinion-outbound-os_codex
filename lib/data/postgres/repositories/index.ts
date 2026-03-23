import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Appointment,
  AppointmentId,
  Campaign,
  CampaignId,
  CampaignStatus,
  Company,
  CompanyId,
  Contact,
  ContactId,
  EnrollmentId,
  PriorityTier,
  Reply,
  ReplyClassification,
  ReplyId,
} from "@/lib/domain";
import type {
  AppointmentRepository,
  CampaignRepository,
  CompanyRepository,
  ContactRepository,
  ReplyRepository,
} from "@/lib/data/core/contracts";
import {
  mapAppointmentRowToDomain,
  mapCampaignRowToDomain,
  mapCompanyRowToDomain,
  mapContactRowToDomain,
  mapReplyRowToDomain,
} from "@/lib/data/postgres/mappers";
import type {
  PostgresTableName,
  TableRow,
} from "@/lib/data/postgres/schema";

function assertSupabaseRows<T>(
  data: readonly T[] | null,
  error: { message: string } | null,
  context: string,
) {
  if (error) {
    throw new Error(`Supabase ${context} failed: ${error.message}`);
  }

  return data ? [...data] : [];
}

function assertSupabaseRow<T>(
  data: T | null,
  error: { message: string } | null,
  context: string,
) {
  if (error) {
    throw new Error(`Supabase ${context} failed: ${error.message}`);
  }

  return data;
}

abstract class SupabaseTableRepository<
  TTable extends PostgresTableName,
  TEntity,
  TId extends string,
> {
  constructor(
    protected readonly client: SupabaseClient,
    private readonly table: TTable,
    private readonly mapRow: (row: TableRow<TTable>) => TEntity,
  ) {}

  async list(): Promise<TEntity[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .order("created_at", { ascending: true });

    return assertSupabaseRows(
      data as readonly unknown[] | null,
      error,
      `${this.table}.list`,
    ).map((row) => this.mapRow(row as TableRow<TTable>));
  }

  async getById(id: TId): Promise<TEntity | undefined> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("id", id as never)
      .maybeSingle();

    const row = assertSupabaseRow(
      data as unknown | null,
      error,
      `${this.table}.getById`,
    );

    return row ? this.mapRow(row as TableRow<TTable>) : undefined;
  }

  protected async listWhere<TColumn extends keyof TableRow<TTable> & string>(
    column: TColumn,
    value: TableRow<TTable>[TColumn],
  ): Promise<TEntity[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq(column, value as never)
      .order("created_at", { ascending: true });

    return assertSupabaseRows(
      data as readonly unknown[] | null,
      error,
      `${this.table}.listWhere(${column})`,
    ).map((row) => this.mapRow(row as TableRow<TTable>));
  }
}

class SupabaseCompanyRepository
  extends SupabaseTableRepository<"companies", Company, CompanyId>
  implements CompanyRepository
{
  constructor(client: SupabaseClient) {
    super(client, "companies", mapCompanyRowToDomain);
  }

  listByPriorityTier(tier: PriorityTier): Promise<Company[]> {
    return this.listWhere("priority_tier", tier);
  }
}

class SupabaseContactRepository
  extends SupabaseTableRepository<"contacts", Contact, ContactId>
  implements ContactRepository
{
  constructor(client: SupabaseClient) {
    super(client, "contacts", mapContactRowToDomain);
  }

  listByCompanyId(companyId: CompanyId): Promise<Contact[]> {
    return this.listWhere("company_id", companyId);
  }
}

class SupabaseCampaignRepository
  extends SupabaseTableRepository<"campaigns", Campaign, CampaignId>
  implements CampaignRepository
{
  constructor(client: SupabaseClient) {
    super(client, "campaigns", mapCampaignRowToDomain);
  }

  listByStatus(status: CampaignStatus): Promise<Campaign[]> {
    return this.listWhere("status", status);
  }
}

class SupabaseReplyRepository
  extends SupabaseTableRepository<"replies", Reply, ReplyId>
  implements ReplyRepository
{
  constructor(client: SupabaseClient) {
    super(client, "replies", mapReplyRowToDomain);
  }

  listByClassification(
    classification: ReplyClassification,
  ): Promise<Reply[]> {
    return this.listWhere("classification", classification);
  }

  listByEnrollmentId(enrollmentId: EnrollmentId): Promise<Reply[]> {
    return this.listWhere("enrollment_id", enrollmentId);
  }
}

class SupabaseAppointmentRepository
  extends SupabaseTableRepository<"appointments", Appointment, AppointmentId>
  implements AppointmentRepository
{
  constructor(client: SupabaseClient) {
    super(client, "appointments", mapAppointmentRowToDomain);
  }

  listByCampaignId(campaignId: CampaignId): Promise<Appointment[]> {
    return this.listWhere("campaign_id", campaignId);
  }
}

export function createPostgresCompanyRepository(
  client: SupabaseClient,
): CompanyRepository {
  return new SupabaseCompanyRepository(client);
}

export function createPostgresContactRepository(
  client: SupabaseClient,
): ContactRepository {
  return new SupabaseContactRepository(client);
}

export function createPostgresCampaignRepository(
  client: SupabaseClient,
): CampaignRepository {
  return new SupabaseCampaignRepository(client);
}

export function createPostgresReplyRepository(
  client: SupabaseClient,
): ReplyRepository {
  return new SupabaseReplyRepository(client);
}

export function createPostgresAppointmentRepository(
  client: SupabaseClient,
): AppointmentRepository {
  return new SupabaseAppointmentRepository(client);
}
