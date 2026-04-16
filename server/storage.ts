import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, like, or, desc, count as drizzleCount, sql } from "drizzle-orm";
import {
  trucks, bags, statusLog, attendees,
  type Truck, type InsertTruck,
  type Bag, type InsertBag,
  type StatusLog, type InsertStatusLog,
  type Attendee, type InsertAttendee,
} from "@shared/schema";

const sqlite = new Database("redline-fdic.db");
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS trucks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS bags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    department TEXT,
    phone TEXT,
    day_leaving TEXT,
    truck_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'checked_in',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS status_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bag_id INTEGER NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    department TEXT
  );
`);

export const db = drizzle(sqlite);

export interface IStorage {
  getTrucks(): Truck[];
  createTruck(data: InsertTruck): Truck;
  getBags(filters?: { truckId?: number; status?: string; search?: string }): Bag[];
  getBag(id: number): Bag | undefined;
  createBag(data: InsertBag): Bag;
  updateBagStatus(id: number, status: string): Bag | undefined;
  getStatusLog(bagId: number): StatusLog[];
  createStatusLog(data: InsertStatusLog): StatusLog;
  searchAttendees(query: string): Attendee[];
  createAttendee(data: InsertAttendee): Attendee;
  getStats(): Stats;
}

type TruckStats = { truckId: number; truckName: string; total: number; checkedIn: number; cleaning: number; complete: number; pickedUp: number };
type Stats = { total: number; checkedIn: number; cleaning: number; complete: number; pickedUp: number; byTruck: TruckStats[] };

export class DatabaseStorage implements IStorage {
  getTrucks(): Truck[] {
    return db.select().from(trucks).all();
  }

  createTruck(data: InsertTruck): Truck {
    return db.insert(trucks).values(data).returning().get();
  }

  getBags(filters?: { truckId?: number; status?: string; search?: string }): Bag[] {
    const allBags = db.select().from(bags).orderBy(desc(bags.updatedAt)).all();
    let result = allBags;
    if (filters?.truckId) result = result.filter(b => b.truckId === filters.truckId);
    if (filters?.status) result = result.filter(b => b.status === filters.status);
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(b =>
        b.lastName.toLowerCase().includes(s) ||
        b.firstName.toLowerCase().includes(s) ||
        (b.department && b.department.toLowerCase().includes(s))
      );
    }
    return result;
  }

  getBag(id: number): Bag | undefined {
    return db.select().from(bags).where(eq(bags.id, id)).get();
  }

  createBag(data: InsertBag): Bag {
    return db.insert(bags).values(data).returning().get();
  }

  updateBagStatus(id: number, status: string): Bag | undefined {
    return db.update(bags).set({ status, updatedAt: new Date().toISOString() }).where(eq(bags.id, id)).returning().get();
  }

  getStatusLog(bagId: number): StatusLog[] {
    return db.select().from(statusLog).where(eq(statusLog.bagId, bagId)).orderBy(desc(statusLog.timestamp)).all();
  }

  createStatusLog(data: InsertStatusLog): StatusLog {
    return db.insert(statusLog).values(data).returning().get();
  }

  searchAttendees(query: string): Attendee[] {
    const s = `%${query}%`;
    return db.select().from(attendees).where(
      or(like(attendees.firstName, s), like(attendees.lastName, s), like(attendees.department, s))!
    ).limit(8).all();
  }

  createAttendee(data: InsertAttendee): Attendee {
    return db.insert(attendees).values(data).returning().get();
  }

  getStats(): Stats {
    const allBags = db.select().from(bags).all();
    const allTrucks = db.select().from(trucks).all();
    return {
      total: allBags.length,
      checkedIn: allBags.filter(b => b.status === "checked_in").length,
      cleaning: allBags.filter(b => b.status === "cleaning").length,
      complete: allBags.filter(b => b.status === "complete").length,
      pickedUp: allBags.filter(b => b.status === "picked_up").length,
      byTruck: allTrucks.map(t => {
        const tb = allBags.filter(b => b.truckId === t.id);
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

export const storage = new DatabaseStorage();

// Seed trucks
const existing = db.select().from(trucks).all();
if (existing.length === 0) {
  for (const name of ["MEU#3", "MEU#5", "MEU#6", "MEU#7", "MEU#8", "MEU#11"]) {
    db.insert(trucks).values({ name }).run();
  }
  console.log("Seeded 6 MEU trucks");
}

// Seed attendees
const ac = db.select({ cnt: drizzleCount() }).from(attendees).get();
if (ac && ac.cnt === 0) {
  try {
    const fs = require("fs");
    const path = require("path");
    const fp = path.resolve("attendees.json");
    if (fs.existsSync(fp)) {
      const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
      for (const a of data) {
        try { db.insert(attendees).values({ firstName: a.firstName, lastName: a.lastName, phone: a.phone || null, department: a.department || null }).run(); } catch {}
      }
      console.log(`Seeded ${data.length} attendees`);
    }
  } catch { console.log("No attendees.json found"); }
}
