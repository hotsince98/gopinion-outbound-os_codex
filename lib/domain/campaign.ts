import type {
  AuditFields,
  CampaignId,
  CampaignStatus,
  ChannelKind,
  IcpProfileId,
  OfferId,
  PriorityTier,
  SequenceId,
} from "@/lib/domain/shared";

export interface Campaign extends AuditFields {
  id: CampaignId;
  name: string;
  description: string;
  status: CampaignStatus;
  offerId: OfferId;
  primaryIcpProfileId: IcpProfileId;
  targetTier: PriorityTier;
  sequenceId: SequenceId;
  channel: ChannelKind;
  objective: string;
  goalMetric: "appointments_booked";
}
