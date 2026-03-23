import type {
  AuditFields,
  CampaignId,
  ChannelKind,
  CompanyId,
  ContactId,
  EnrollmentId,
  OfferId,
  ReplyClassification,
  ReplyId,
  ReplySentiment,
} from "@/lib/domain/shared";

export interface Reply extends AuditFields {
  id: ReplyId;
  enrollmentId: EnrollmentId;
  companyId: CompanyId;
  contactId: ContactId;
  campaignId: CampaignId;
  offerId: OfferId;
  channel: ChannelKind;
  classification: ReplyClassification;
  sentiment?: ReplySentiment;
  snippet: string;
  bodyText: string;
  receivedAt: string;
  requiresHumanReview: boolean;
  indicatesBookingIntent: boolean;
}
