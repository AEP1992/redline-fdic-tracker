// Types matching Supabase tables
export type Truck = { id: number; name: string };

export type Bag = {
  id: number;
  first_name: string;
  last_name: string;
  department: string | null;
  phone: string | null;
  day_leaving: string | null;
  truck_id: number;
  status: string;
  notes: string | null;
  load_number: string | null;
  tag_color: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StatusLog = {
  id: number;
  bag_id: number;
  previous_status: string | null;
  new_status: string;
  timestamp: string;
};

export type Attendee = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  department: string | null;
};

export const STATUSES = ["checked_in", "cleaning", "complete", "picked_up"] as const;
export type Status = typeof STATUSES[number];

export const STATUS_LABELS: Record<string, string> = {
  checked_in: "Checked In",
  cleaning: "In Cleaning",
  complete: "Complete",
  picked_up: "Picked Up",
};

export const DAY_OPTIONS = ["Wed", "Thurs", "Fri", "Sat"] as const;

export const LOAD_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export const TAG_COLORS = ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Teal", "Other"] as const;
