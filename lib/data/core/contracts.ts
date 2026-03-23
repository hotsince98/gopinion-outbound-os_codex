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
  Enrollment,
  EnrollmentId,
  EnrollmentState,
  Experiment,
  ExperimentId,
  Insight,
  InsightId,
  MemoryEntry,
  MemoryEntryId,
  Offer,
  OfferCategory,
  OfferId,
  PriorityTier,
  Reply,
  ReplyClassification,
  ReplyId,
  Sequence,
  SequenceId,
  SequenceStatus,
} from "@/lib/domain";

export interface Repository<TEntity, TId extends string> {
  list(): TEntity[];
  getById(id: TId): TEntity | undefined;
}

export interface CompanyRepository extends Repository<Company, CompanyId> {
  listByPriorityTier(tier: PriorityTier): Company[];
}

export interface ContactRepository extends Repository<Contact, ContactId> {
  listByCompanyId(companyId: CompanyId): Contact[];
}

export interface OfferRepository extends Repository<Offer, OfferId> {
  listByCategory(category: OfferCategory): Offer[];
}

export interface CampaignRepository extends Repository<Campaign, CampaignId> {
  listByStatus(status: CampaignStatus): Campaign[];
}

export interface SequenceRepository extends Repository<Sequence, SequenceId> {
  listByStatus(status: SequenceStatus): Sequence[];
}

export interface EnrollmentRepository
  extends Repository<Enrollment, EnrollmentId> {
  listBySequenceId(sequenceId: SequenceId): Enrollment[];
  listByState(state: EnrollmentState): Enrollment[];
}

export interface ReplyRepository extends Repository<Reply, ReplyId> {
  listByClassification(classification: ReplyClassification): Reply[];
  listByEnrollmentId(enrollmentId: EnrollmentId): Reply[];
}

export interface AppointmentRepository
  extends Repository<Appointment, AppointmentId> {
  listByCampaignId(campaignId: CampaignId): Appointment[];
}

export interface ExperimentRepository
  extends Repository<Experiment, ExperimentId> {}

export interface InsightRepository extends Repository<Insight, InsightId> {}

export interface MemoryEntryRepository
  extends Repository<MemoryEntry, MemoryEntryId> {}

export interface DataAccess {
  companies: CompanyRepository;
  contacts: ContactRepository;
  offers: OfferRepository;
  campaigns: CampaignRepository;
  sequences: SequenceRepository;
  enrollments: EnrollmentRepository;
  replies: ReplyRepository;
  appointments: AppointmentRepository;
  experiments: ExperimentRepository;
  insights: InsightRepository;
  memoryEntries: MemoryEntryRepository;
}
