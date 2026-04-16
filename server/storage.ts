import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export type Truck = { id: number; name: string };
export type Bag = {
  id: number; first_name: string; last_name: string; department: string | null;
  phone: string | null; day_leaving: string | null; truck_id: number;
  status: string; notes: string | null; created_at: string; updated_at: string;
};
export type StatusLogEntry = {
  id: number; bag_id: number; previous_status: string | null;
  new_status: string; timestamp: string;
};
export type Attendee = {
  id: number; first_name: string; last_name: string;
  phone: string | null; department: string | null;
};

// Stats types
type TruckStats = { truckId: number; truckName: string; total: number; checkedIn: number; cleaning: number; complete: number; pickedUp: number };
type Stats = { total: number; checkedIn: number; cleaning: number; complete: number; pickedUp: number; byTruck: TruckStats[] };

export class SupabaseStorage {
  // ── Trucks ──
  async getTrucks(): Promise<Truck[]> {
    const { data } = await supabase.from("trucks").select("*").order("id");
    return data || [];
  }

  // ── Bags ──
  async getBags(filters?: { truckId?: number; status?: string; search?: string }): Promise<Bag[]> {
    let query = supabase.from("bags").select("*").eq("deleted", false).order("updated_at", { ascending: false });
    if (filters?.truckId) query = query.eq("truck_id", filters.truckId);
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.search) {
      const s = `%${filters.search}%`;
      query = query.or(`last_name.ilike.${s},first_name.ilike.${s},department.ilike.${s}`);
    }
    const { data } = await query;
    return data || [];
  }

  async getBag(id: number): Promise<Bag | null> {
    const { data } = await supabase.from("bags").select("*").eq("id", id).single();
    return data;
  }

  async createBag(bag: Omit<Bag, "id">): Promise<Bag> {
    const { data, error } = await supabase.from("bags").insert(bag).select().single();
    if (error) throw error;
    return data;
  }

  async updateBagStatus(id: number, status: string): Promise<Bag | null> {
    const { data } = await supabase.from("bags")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id).select().single();
    return data;
  }

  // ── Status Log ──
  async getStatusLog(bagId: number): Promise<StatusLogEntry[]> {
    const { data } = await supabase.from("status_log").select("*")
      .eq("bag_id", bagId).order("timestamp", { ascending: false });
    return data || [];
  }

  async createStatusLog(entry: Omit<StatusLogEntry, "id">): Promise<StatusLogEntry> {
    const { data, error } = await supabase.from("status_log").insert(entry).select().single();
    if (error) throw error;
    return data;
  }

  // ── Attendees ──
  async searchAttendees(query: string): Promise<Attendee[]> {
    const s = `%${query}%`;
    const { data } = await supabase.from("attendees").select("*")
      .or(`first_name.ilike.${s},last_name.ilike.${s},department.ilike.${s}`)
      .limit(8);
    return data || [];
  }

  // ── Stats ──
  async getStats(): Promise<Stats> {
    const [{ data: allBags }, { data: allTrucks }] = await Promise.all([
      supabase.from("bags").select("*").eq("deleted", false),
      supabase.from("trucks").select("*").order("id"),
    ]);
    const bags = allBags || [];
    const trucks = allTrucks || [];
    return {
      total: bags.length,
      checkedIn: bags.filter(b => b.status === "checked_in").length,
      cleaning: bags.filter(b => b.status === "cleaning").length,
      complete: bags.filter(b => b.status === "complete").length,
      pickedUp: bags.filter(b => b.status === "picked_up").length,
      byTruck: trucks.map(t => {
        const tb = bags.filter(b => b.truck_id === t.id);
        return {
          truckId: t.id, truckName: t.name, total: tb.length,
          checkedIn: tb.filter(b => b.status === "checked_in").length,
          cleaning: tb.filter(b => b.status === "cleaning").length,
          complete: tb.filter(b => b.status === "complete").length,
          pickedUp: tb.filter(b => b.status === "picked_up").length,
        };
      }),
    };
  }
}

export const storage = new SupabaseStorage();
export { supabase };
