import type {
  AppointmentId,
  AppointmentConfirmationStatus,
  AppointmentStatus,
  AuditFields,
  CampaignId,
  CompanyId,
  ContactId,
  EnrollmentId,
  ReplyId,
} from "@/lib/domain/shared";

export interface Appointment extends AuditFields {
  id: AppointmentId;
  companyId: CompanyId;
  contactId: ContactId;
  campaignId: CampaignId;
  enrollmentId: EnrollmentId;
  replyId: ReplyId;
  status: AppointmentStatus;
  confirmationStatus: AppointmentConfirmationStatus;
  bookedAt: string;
  scheduledFor: string;
  timezone: string;
  notes?: string;
}
