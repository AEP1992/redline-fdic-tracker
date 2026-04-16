import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// MEU Trucks
export const trucks = sqliteTable("trucks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const insertTruckSchema = createInsertSchema(trucks).omit({ id: true });
export type InsertTruck = z.infer<typeof insertTruckSchema>;
export type Truck = typeof trucks.$inferSelect;

// Gear Bags — one entry per person
export const bags = sqliteTable("bags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  department: text("department"),
  phone: text("phone"),
  dayLeaving: text("day_leaving"), // Wed, Thurs, Fri, Sat
  truckId: integer("truck_id").notNull(),
  status: text("status").notNull().default("checked_in"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertBagSchema = createInsertSchema(bags).omit({ id: true });
export type InsertBag = z.infer<typeof insertBagSchema>;
export type Bag = typeof bags.$inferSelect;

// Status log — audit trail
export const statusLog = sqliteTable("status_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bagId: integer("bag_id").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const insertStatusLogSchema = createInsertSchema(statusLog).omit({ id: true });
export type InsertStatusLog = z.infer<typeof insertStatusLogSchema>;
export type StatusLog = typeof statusLog.$inferSelect;

// Pre-loaded attendees for auto-complete
export const attendees = sqliteTable("attendees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  department: text("department"),
});

export const insertAttendeeSchema = createInsertSchema(attendees).omit({ id: true });
export type InsertAttendee = z.infer<typeof insertAttendeeSchema>;
export type Attendee = typeof attendees.$inferSelect;

// Statuses
export const STATUSES = ["checked_in", "cleaning", "complete", "picked_up"] as const;
export type Status = typeof STATUSES[number];

export const STATUS_LABELS: Record<string, string> = {
  checked_in: "Checked In",
  cleaning: "In Cleaning",
  complete: "Complete",
  picked_up: "Picked Up",
};

export const STATUS_ORDER: Record<string, number> = {
  checked_in: 0,
  cleaning: 1,
  complete: 2,
  picked_up: 3,
};

export const DAY_OPTIONS = ["Wed", "Thurs", "Fri", "Sat"] as const;
