import type {
  Appointment,
  Campaign,
  Company,
  CompanyEnrichmentSnapshot,
  Contact,
  Enrollment,
  Reply,
} from "@/lib/domain";
import type {
  AppointmentRow,
  CampaignRow,
  CompanyRow,
  ContactRow,
  EnrollmentRow,
  ReplyRow,
} from "@/lib/data/postgres/schema";

function listOrEmpty<T>(value: readonly T[] | null | undefined): T[] {
  return value ? [...value] : [];
}

function normalizeCompanyEnrichment(
  enrichment: CompanyEnrichmentSnapshot | null | undefined,
): CompanyEnrichmentSnapshot | undefined {
  if (!enrichment) {
    return undefined;
  }

  return {
    ...enrichment,
    sourceUrls: listOrEmpty(enrichment.sourceUrls),
    pagesChecked: listOrEmpty(enrichment.pagesChecked),
    foundEmails: listOrEmpty(enrichment.foundEmails),
    foundPhones: listOrEmpty(enrichment.foundPhones),
    foundNames: listOrEmpty(enrichment.foundNames),
    noteHints: listOrEmpty(enrichment.noteHints),
    missingFields: listOrEmpty(enrichment.missingFields),
    websiteDiscovery: enrichment.websiteDiscovery
      ? {
          ...enrichment.websiteDiscovery,
          confirmationStatus:
            enrichment.websiteDiscovery.confirmationStatus ??
            (enrichment.websiteDiscovery.status === "record_provided"
              ? "record_provided"
              : enrichment.websiteDiscovery.status === "discovered"
                ? "auto_confirmed"
                : enrichment.websiteDiscovery.status === "failed"
                  ? "failed"
                  : "not_found"),
          confirmationReason:
            enrichment.websiteDiscovery.confirmationReason ?? undefined,
          candidateWebsite:
            enrichment.websiteDiscovery.candidateWebsite ??
            enrichment.websiteDiscovery.discoveredWebsite,
          candidateUrls: listOrEmpty(enrichment.websiteDiscovery.candidateUrls),
          matchedSignals: listOrEmpty(enrichment.websiteDiscovery.matchedSignals),
          supportingPageUrls: listOrEmpty(
            enrichment.websiteDiscovery.supportingPageUrls,
          ),
          contactPageUrls: listOrEmpty(
            enrichment.websiteDiscovery.contactPageUrls,
          ),
          staffPageUrls: listOrEmpty(enrichment.websiteDiscovery.staffPageUrls),
          extractedEvidence: listOrEmpty(
            enrichment.websiteDiscovery.extractedEvidence,
          ),
          preferredSupportingPage: enrichment.websiteDiscovery.preferredSupportingPage
            ? {
                ...enrichment.websiteDiscovery.preferredSupportingPage,
              }
            : undefined,
          operatorReview: enrichment.websiteDiscovery.operatorReview
            ? {
                ...enrichment.websiteDiscovery.operatorReview,
              }
            : undefined,
        }
      : undefined,
    segment: enrichment.segment
      ? {
          ...enrichment.segment,
          reasons: listOrEmpty(enrichment.segment.reasons),
        }
      : undefined,
    outreachAngle: enrichment.outreachAngle
      ? {
          ...enrichment.outreachAngle,
          reasons: listOrEmpty(enrichment.outreachAngle.reasons),
        }
      : undefined,
  };
}

export function mapCompanyRowToDomain(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legal_name ?? undefined,
    industryKey: row.industry_key,
    subindustry: row.subindustry ?? undefined,
    icpProfileId: row.icp_profile_id,
    status: row.status,
    priorityTier: row.priority_tier,
    isIndependent: row.is_independent,
    location: row.location,
    presence: row.presence,
    monthlyCarsSoldRange: row.monthly_cars_sold_range ?? undefined,
    likelyOperatorAgeRange: row.likely_operator_age_range ?? undefined,
    softwareToolCountEstimate: row.software_tool_count_estimate ?? undefined,
    buyingStage: row.buying_stage,
    painSignals: listOrEmpty(row.pain_signals),
    disqualifierSignals: listOrEmpty(row.disqualifier_signals),
    notes: listOrEmpty(row.notes),
    recommendedOfferIds: listOrEmpty(row.recommended_offer_ids),
    primaryContactId: row.primary_contact_id ?? undefined,
    activeCampaignIds: listOrEmpty(row.active_campaign_ids),
    appointmentIds: listOrEmpty(row.appointment_ids),
    scoring: row.scoring,
    enrichment: normalizeCompanyEnrichment(row.enrichment),
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapContactRowToDomain(row: ContactRow): Contact {
  return {
    id: row.id,
    companyId: row.company_id,
    fullName: row.full_name ?? undefined,
    title: row.title ?? undefined,
    role: row.role,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    linkedinUrl: row.linkedin_url ?? undefined,
    sourceKind: row.source_kind,
    status: row.status,
    isPrimary: row.is_primary,
    outreachReady: row.outreach_ready,
    confidence: row.confidence,
    quality: row.quality ?? undefined,
    notes: listOrEmpty(row.notes),
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCampaignRowToDomain(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    offerId: row.offer_id,
    primaryIcpProfileId: row.primary_icp_profile_id,
    targetTier: row.target_tier,
    sequenceId: row.sequence_id,
    channel: row.channel,
    objective: row.objective,
    goalMetric: row.goal_metric,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapReplyRowToDomain(row: ReplyRow): Reply {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    companyId: row.company_id,
    contactId: row.contact_id,
    campaignId: row.campaign_id,
    offerId: row.offer_id,
    channel: row.channel,
    classification: row.classification,
    sentiment: row.sentiment ?? undefined,
    snippet: row.snippet,
    bodyText: row.body_text,
    receivedAt: row.received_at,
    requiresHumanReview: row.requires_human_review,
    indicatesBookingIntent: row.indicates_booking_intent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapEnrollmentRowToDomain(row: EnrollmentRow): Enrollment {
  return {
    id: row.id,
    companyId: row.company_id,
    contactId: row.contact_id,
    campaignId: row.campaign_id,
    sequenceId: row.sequence_id,
    offerId: row.offer_id,
    priorityTier: row.priority_tier,
    state: row.state,
    currentStepIndex: row.current_step_index,
    enteredSequenceAt: row.entered_sequence_at,
    nextActionAt: row.next_action_at ?? undefined,
    lastContactedAt: row.last_contacted_at ?? undefined,
    lastReplyId: row.last_reply_id ?? undefined,
    appointmentId: row.appointment_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAppointmentRowToDomain(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    companyId: row.company_id,
    contactId: row.contact_id,
    campaignId: row.campaign_id,
    enrollmentId: row.enrollment_id,
    replyId: row.reply_id,
    status: row.status,
    confirmationStatus: row.confirmation_status,
    bookedAt: row.booked_at,
    scheduledFor: row.scheduled_for,
    timezone: row.timezone,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCompanyDomainToRow(company: Company): CompanyRow {
  return {
    id: company.id,
    name: company.name,
    legal_name: company.legalName ?? null,
    industry_key: company.industryKey,
    subindustry: company.subindustry ?? null,
    icp_profile_id: company.icpProfileId,
    status: company.status,
    priority_tier: company.priorityTier,
    is_independent: company.isIndependent,
    location: company.location,
    presence: company.presence,
    monthly_cars_sold_range: company.monthlyCarsSoldRange ?? null,
    likely_operator_age_range: company.likelyOperatorAgeRange ?? null,
    software_tool_count_estimate: company.softwareToolCountEstimate ?? null,
    buying_stage: company.buyingStage,
    pain_signals: listOrEmpty(company.painSignals),
    disqualifier_signals: listOrEmpty(company.disqualifierSignals),
    notes: listOrEmpty(company.notes),
    recommended_offer_ids: listOrEmpty(company.recommendedOfferIds),
    primary_contact_id: company.primaryContactId ?? null,
    active_campaign_ids: listOrEmpty(company.activeCampaignIds),
    appointment_ids: listOrEmpty(company.appointmentIds),
    scoring: company.scoring,
    enrichment: company.enrichment ?? null,
    source: company.source,
    created_at: company.createdAt,
    updated_at: company.updatedAt,
  };
}

export function mapContactDomainToRow(contact: Contact): ContactRow {
  return {
    id: contact.id,
    company_id: contact.companyId,
    full_name: contact.fullName ?? null,
    title: contact.title ?? null,
    role: contact.role,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    linkedin_url: contact.linkedinUrl ?? null,
    source_kind: contact.sourceKind,
    status: contact.status,
    is_primary: contact.isPrimary,
    outreach_ready: contact.outreachReady,
    confidence: contact.confidence,
    quality: contact.quality ?? null,
    notes: listOrEmpty(contact.notes),
    source: contact.source,
    created_at: contact.createdAt,
    updated_at: contact.updatedAt,
  };
}

export function mapCampaignDomainToRow(campaign: Campaign): CampaignRow {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    offer_id: campaign.offerId,
    primary_icp_profile_id: campaign.primaryIcpProfileId,
    target_tier: campaign.targetTier,
    sequence_id: campaign.sequenceId,
    channel: campaign.channel,
    objective: campaign.objective,
    goal_metric: campaign.goalMetric,
    created_at: campaign.createdAt,
    updated_at: campaign.updatedAt,
  };
}

export function mapEnrollmentDomainToRow(
  enrollment: Enrollment,
): EnrollmentRow {
  return {
    id: enrollment.id,
    company_id: enrollment.companyId,
    contact_id: enrollment.contactId,
    campaign_id: enrollment.campaignId,
    sequence_id: enrollment.sequenceId,
    offer_id: enrollment.offerId,
    priority_tier: enrollment.priorityTier,
    state: enrollment.state,
    current_step_index: enrollment.currentStepIndex,
    entered_sequence_at: enrollment.enteredSequenceAt,
    next_action_at: enrollment.nextActionAt ?? null,
    last_contacted_at: enrollment.lastContactedAt ?? null,
    last_reply_id: enrollment.lastReplyId ?? null,
    appointment_id: enrollment.appointmentId ?? null,
    created_at: enrollment.createdAt,
    updated_at: enrollment.updatedAt,
  };
}

export function mapReplyDomainToRow(reply: Reply): ReplyRow {
  return {
    id: reply.id,
    enrollment_id: reply.enrollmentId,
    company_id: reply.companyId,
    contact_id: reply.contactId,
    campaign_id: reply.campaignId,
    offer_id: reply.offerId,
    channel: reply.channel,
    classification: reply.classification,
    sentiment: reply.sentiment ?? null,
    snippet: reply.snippet,
    body_text: reply.bodyText,
    received_at: reply.receivedAt,
    requires_human_review: reply.requiresHumanReview,
    indicates_booking_intent: reply.indicatesBookingIntent,
    created_at: reply.createdAt,
    updated_at: reply.updatedAt,
  };
}

export function mapAppointmentDomainToRow(
  appointment: Appointment,
): AppointmentRow {
  return {
    id: appointment.id,
    company_id: appointment.companyId,
    contact_id: appointment.contactId,
    campaign_id: appointment.campaignId,
    enrollment_id: appointment.enrollmentId,
    reply_id: appointment.replyId,
    status: appointment.status,
    confirmation_status: appointment.confirmationStatus,
    booked_at: appointment.bookedAt,
    scheduled_for: appointment.scheduledFor,
    timezone: appointment.timezone,
    notes: appointment.notes ?? null,
    created_at: appointment.createdAt,
    updated_at: appointment.updatedAt,
  };
}
