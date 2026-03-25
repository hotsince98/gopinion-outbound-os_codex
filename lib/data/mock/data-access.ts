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
import type {
  AppointmentRepository,
  CampaignRepository,
  CompanyRepository,
  ContactRepository,
  DataAccess,
  EnrollmentRepository,
  ExperimentRepository,
  InsightRepository,
  MemoryEntryRepository,
  OfferRepository,
  ReplyRepository,
  SequenceRepository,
} from "@/lib/data/core/contracts";
import {
  mockAppointments,
  mockCampaigns,
  mockCompanies,
  mockContacts,
  mockEnrollments,
  mockExperiments,
  mockInsights,
  mockMemoryEntries,
  mockOffers,
  mockReplies,
  mockSequences,
} from "@/lib/data/mock/store";

class InMemoryRepository<TEntity extends { id: string }, TId extends string> {
  constructor(private readonly items: TEntity[]) {}

  list(): TEntity[] {
    return [...this.items];
  }

  getById(id: TId): TEntity | undefined {
    return this.items.find((item) => item.id === id);
  }

  protected filter(predicate: (item: TEntity) => boolean): TEntity[] {
    return this.items.filter(predicate);
  }

  protected insert(item: TEntity): TEntity {
    this.items.push(item);

    return item;
  }

  protected replace(item: TEntity): TEntity {
    const index = this.items.findIndex((currentItem) => currentItem.id === item.id);

    if (index === -1) {
      throw new Error(`In-memory repository could not find ${item.id} to update.`);
    }

    this.items[index] = item;

    return item;
  }
}

class InMemoryCompanyRepository
  extends InMemoryRepository<Company, CompanyId>
  implements CompanyRepository
{
  create(company: Company): Company {
    return this.insert(company);
  }

  update(company: Company): Company {
    return this.replace(company);
  }

  listByPriorityTier(tier: PriorityTier): Company[] {
    return this.filter((company) => company.priorityTier === tier);
  }
}

class InMemoryContactRepository
  extends InMemoryRepository<Contact, ContactId>
  implements ContactRepository
{
  create(contact: Contact): Contact {
    return this.insert(contact);
  }

  update(contact: Contact): Contact {
    return this.replace(contact);
  }

  listByCompanyId(companyId: CompanyId): Contact[] {
    return this.filter((contact) => contact.companyId === companyId);
  }
}

class InMemoryOfferRepository
  extends InMemoryRepository<Offer, OfferId>
  implements OfferRepository
{
  listByCategory(category: OfferCategory): Offer[] {
    return this.filter((offer) => offer.category === category);
  }
}

class InMemoryCampaignRepository
  extends InMemoryRepository<Campaign, CampaignId>
  implements CampaignRepository
{
  listByStatus(status: CampaignStatus): Campaign[] {
    return this.filter((campaign) => campaign.status === status);
  }
}

class InMemorySequenceRepository
  extends InMemoryRepository<Sequence, SequenceId>
  implements SequenceRepository
{
  listByStatus(status: SequenceStatus): Sequence[] {
    return this.filter((sequence) => sequence.status === status);
  }
}

class InMemoryEnrollmentRepository
  extends InMemoryRepository<Enrollment, EnrollmentId>
  implements EnrollmentRepository
{
  create(enrollment: Enrollment): Enrollment {
    return this.insert(enrollment);
  }

  update(enrollment: Enrollment): Enrollment {
    return this.replace(enrollment);
  }

  listByCompanyId(companyId: CompanyId): Enrollment[] {
    return this.filter((enrollment) => enrollment.companyId === companyId);
  }

  listByCampaignId(campaignId: CampaignId): Enrollment[] {
    return this.filter((enrollment) => enrollment.campaignId === campaignId);
  }

  listBySequenceId(sequenceId: SequenceId): Enrollment[] {
    return this.filter((enrollment) => enrollment.sequenceId === sequenceId);
  }

  listByState(state: EnrollmentState): Enrollment[] {
    return this.filter((enrollment) => enrollment.state === state);
  }
}

class InMemoryReplyRepository
  extends InMemoryRepository<Reply, ReplyId>
  implements ReplyRepository
{
  listByClassification(classification: ReplyClassification): Reply[] {
    return this.filter((reply) => reply.classification === classification);
  }

  listByEnrollmentId(enrollmentId: EnrollmentId): Reply[] {
    return this.filter((reply) => reply.enrollmentId === enrollmentId);
  }
}

class InMemoryAppointmentRepository
  extends InMemoryRepository<Appointment, AppointmentId>
  implements AppointmentRepository
{
  listByCampaignId(campaignId: CampaignId): Appointment[] {
    return this.filter((appointment) => appointment.campaignId === campaignId);
  }
}

class InMemoryExperimentRepository
  extends InMemoryRepository<Experiment, ExperimentId>
  implements ExperimentRepository {}

class InMemoryInsightRepository
  extends InMemoryRepository<Insight, InsightId>
  implements InsightRepository {}

class InMemoryMemoryEntryRepository
  extends InMemoryRepository<MemoryEntry, MemoryEntryId>
  implements MemoryEntryRepository {}

export function createMockDataAccess(): DataAccess {
  return {
    companies: new InMemoryCompanyRepository(mockCompanies),
    contacts: new InMemoryContactRepository(mockContacts),
    offers: new InMemoryOfferRepository(mockOffers),
    campaigns: new InMemoryCampaignRepository(mockCampaigns),
    sequences: new InMemorySequenceRepository(mockSequences),
    enrollments: new InMemoryEnrollmentRepository(mockEnrollments),
    replies: new InMemoryReplyRepository(mockReplies),
    appointments: new InMemoryAppointmentRepository(mockAppointments),
    experiments: new InMemoryExperimentRepository(mockExperiments),
    insights: new InMemoryInsightRepository(mockInsights),
    memoryEntries: new InMemoryMemoryEntryRepository(mockMemoryEntries),
  };
}

export const mockDataAccess: DataAccess = createMockDataAccess();
