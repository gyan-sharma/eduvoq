export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

export type ConsultationMode = "ONLINE" | "CUSTOMER_PLACE" | "EXPERT_PLACE";

export interface ConsultationService {
  id: string;
  slug: string;
  title: string;
  durationMinutes: number;
  pricePaise: number;
  mode: ConsultationMode;
  expertId: string | null;
}

export interface Booking {
  id: string;
  serviceId: string;
  expertId: string;
  customerId: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  meetingUrl: string | null;
  razorpayOrderId: string | null;
  notes: string | null;
}

export interface PublicSlot {
  startsAt: string;
  endsAt: string;
}
