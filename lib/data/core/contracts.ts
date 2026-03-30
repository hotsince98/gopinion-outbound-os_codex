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

export type RepositoryResult<T> = T | Promise<T>;

export interface Repository<TEntity, TId extends string> {
  list(): RepositoryResult<TEntity[]>;
  getById(id: TId): RepositoryResult<TEntity | undefined>;
}

export interface CompanyRepository extends Repository<Company, CompanyId> {
  create(company: Company): RepositoryResult<Company>;
  update(company: Company): RepositoryResult<Company>;
  delete(id: CompanyId): RepositoryResult<void>;
  listByPriorityTier(tier: PriorityTier): RepositoryResult<Company[]>;
}

export interface ContactRepository extends Repository<Contact, ContactId> {
  create(contact: Contact): RepositoryResult<Contact>;
  update(contact: Contact): RepositoryResult<Contact>;
  delete(id: ContactId): RepositoryResult<void>;
  listByCompanyId(companyId: CompanyId): RepositoryResult<Contact[]>;
}

export interface OfferRepository extends Repository<Offer, OfferId> {
  listByCategory(category: OfferCategory): RepositoryResult<Offer[]>;
}

export interface CampaignRepository extends Repository<Campaign, CampaignId> {
  listByStatus(status: CampaignStatus): RepositoryResult<Campaign[]>;
}

export interface SequenceRepository extends Repository<Sequence, SequenceId> {
  listByStatus(status: SequenceStatus): RepositoryResult<Sequence[]>;
}

export interface EnrollmentRepository
  extends Repository<Enrollment, EnrollmentId> {
  create(enrollment: Enrollment): RepositoryResult<Enrollment>;
  update(enrollment: Enrollment): RepositoryResult<Enrollment>;
  delete(id: EnrollmentId): RepositoryResult<void>;
  listByCompanyId(companyId: CompanyId): RepositoryResult<Enrollment[]>;
  listByCampaignId(campaignId: CampaignId): RepositoryResult<Enrollment[]>;
  listBySequenceId(sequenceId: SequenceId): RepositoryResult<Enrollment[]>;
  listByState(state: EnrollmentState): RepositoryResult<Enrollment[]>;
}

export interface ReplyRepository extends Repository<Reply, ReplyId> {
  delete(id: ReplyId): RepositoryResult<void>;
  listByClassification(
    classification: ReplyClassification,
  ): RepositoryResult<Reply[]>;
  listByEnrollmentId(enrollmentId: EnrollmentId): RepositoryResult<Reply[]>;
}

export interface AppointmentRepository
  extends Repository<Appointment, AppointmentId> {
  delete(id: AppointmentId): RepositoryResult<void>;
  listByCampaignId(campaignId: CampaignId): RepositoryResult<Appointment[]>;
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
