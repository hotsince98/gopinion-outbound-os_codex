import type {
  Appointment,
  Campaign,
  Company,
  CompanyPresence,
  CompanyScoringSnapshot,
  Contact,
  ConfidenceIndicator,
  NumericRange,
  Reply,
  SourceReference,
} from "@/lib/domain";

export interface CompanyRow {
  id: Company["id"];
  name: string;
  legal_name: string | null;
  industry_key: Company["industryKey"];
  subindustry: string | null;
  icp_profile_id: Company["icpProfileId"];
  status: Company["status"];
  priority_tier: Company["priorityTier"];
  is_independent: boolean;
  location: Company["location"];
  presence: CompanyPresence;
  monthly_cars_sold_range: NumericRange | null;
  likely_operator_age_range: NumericRange | null;
  software_tool_count_estimate: number | null;
  buying_stage: Company["buyingStage"];
  pain_signals: string[] | null;
  disqualifier_signals: string[] | null;
  notes: string[] | null;
  recommended_offer_ids: Company["recommendedOfferIds"] | null;
  primary_contact_id: Company["primaryContactId"] | null;
  active_campaign_ids: Company["activeCampaignIds"] | null;
  appointment_ids: Company["appointmentIds"] | null;
  scoring: CompanyScoringSnapshot;
  source: SourceReference;
  created_at: string;
  updated_at: string;
}

export interface ContactRow {
  id: Contact["id"];
  company_id: Contact["companyId"];
  full_name: string | null;
  title: string | null;
  role: Contact["role"];
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source_kind: Contact["sourceKind"];
  status: Contact["status"];
  is_primary: boolean;
  outreach_ready: boolean;
  confidence: ConfidenceIndicator;
  notes: string[] | null;
  source: SourceReference;
  created_at: string;
  updated_at: string;
}

export interface CampaignRow {
  id: Campaign["id"];
  name: string;
  description: string;
  status: Campaign["status"];
  offer_id: Campaign["offerId"];
  primary_icp_profile_id: Campaign["primaryIcpProfileId"];
  target_tier: Campaign["targetTier"];
  sequence_id: Campaign["sequenceId"];
  channel: Campaign["channel"];
  objective: string;
  goal_metric: Campaign["goalMetric"];
  created_at: string;
  updated_at: string;
}

export interface ReplyRow {
  id: Reply["id"];
  enrollment_id: Reply["enrollmentId"];
  company_id: Reply["companyId"];
  contact_id: Reply["contactId"];
  campaign_id: Reply["campaignId"];
  offer_id: Reply["offerId"];
  channel: Reply["channel"];
  classification: Reply["classification"];
  sentiment: Reply["sentiment"] | null;
  snippet: string;
  body_text: string;
  received_at: string;
  requires_human_review: boolean;
  indicates_booking_intent: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentRow {
  id: Appointment["id"];
  company_id: Appointment["companyId"];
  contact_id: Appointment["contactId"];
  campaign_id: Appointment["campaignId"];
  enrollment_id: Appointment["enrollmentId"];
  reply_id: Appointment["replyId"];
  status: Appointment["status"];
  confirmation_status: Appointment["confirmationStatus"];
  booked_at: string;
  scheduled_for: string;
  timezone: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: CompanyRow;
      };
      contacts: {
        Row: ContactRow;
      };
      campaigns: {
        Row: CampaignRow;
      };
      replies: {
        Row: ReplyRow;
      };
      appointments: {
        Row: AppointmentRow;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type PostgresTableName = keyof Database["public"]["Tables"];
export type TableRow<TTable extends PostgresTableName> =
  Database["public"]["Tables"][TTable]["Row"];
