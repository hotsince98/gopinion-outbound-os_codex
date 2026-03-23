import type {
  AppointmentId,
  AuditFields,
  CampaignId,
  CompanyId,
  ContactId,
  EnrollmentId,
  EnrollmentState,
  OfferId,
  PriorityTier,
  ReplyId,
  SequenceId,
} from "@/lib/domain/shared";

export interface Enrollment extends AuditFields {
  id: EnrollmentId;
  companyId: CompanyId;
  contactId: ContactId;
  campaignId: CampaignId;
  sequenceId: SequenceId;
  offerId: OfferId;
  priorityTier: PriorityTier;
  state: EnrollmentState;
  currentStepIndex: number;
  enteredSequenceAt: string;
  nextActionAt?: string;
  lastContactedAt?: string;
  lastReplyId?: ReplyId;
  appointmentId?: AppointmentId;
}
