import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage, supabase } from "./storage";

let wss: WebSocketServer;

function broadcast(data: any) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

export async function registerRoutes(httpServer: Server, app: Express) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", async (ws) => {
    const stats = await storage.getStats();
    ws.send(JSON.stringify({ type: "stats", data: stats }));
  });

  app.get("/api/trucks", async (_req, res) => {
    res.json(await storage.getTrucks());
  });

  app.get("/api/stats", async (_req, res) => {
    res.json(await storage.getStats());
  });

  // Bags
  app.get("/api/bags", async (req, res) => {
    const truckId = req.query.truckId ? Number(req.query.truckId) : undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    res.json(await storage.getBags({ truckId, status, search }));
  });

  app.get("/api/bags/:id", async (req, res) => {
    const bag = await storage.getBag(Number(req.params.id));
    if (!bag) return res.status(404).json({ error: "Not found" });
    const logs = await storage.getStatusLog(bag.id);
    res.json({ ...bag, statusLog: logs });
  });

  // Check in a bag
  app.post("/api/bags", async (req, res) => {
    try {
      const now = new Date().toISOString();
      const loadNumber = req.body.loadNumber || null;
      const tagColor = req.body.tagColor || null;
      // Auto-set to "cleaning" if load + color are provided
      const autoStatus = (loadNumber && tagColor) ? "cleaning" : "checked_in";
      const bag = await storage.createBag({
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        department: req.body.department || null,
        phone: req.body.phone || null,
        day_leaving: req.body.dayLeaving || null,
        truck_id: Number(req.body.truckId),
        status: autoStatus,
        notes: req.body.notes || null,
        load_number: loadNumber,
        tag_color: tagColor,
        created_at: now,
        updated_at: now,
      });
      await storage.createStatusLog({ bag_id: bag.id, previous_status: null, new_status: autoStatus, timestamp: now });
      const stats = await storage.getStats();
      broadcast({ type: "stats", data: stats });
      broadcast({ type: "bag_created", data: bag });
      res.status(201).json(bag);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Update status
  app.patch("/api/bags/:id/status", async (req, res) => {
    const bag = await storage.getBag(Number(req.params.id));
    if (!bag) return res.status(404).json({ error: "Not found" });
    const prev = bag.status;
    const updated = await storage.updateBagStatus(bag.id, req.body.status);
    await storage.createStatusLog({ bag_id: bag.id, previous_status: prev, new_status: req.body.status, timestamp: new Date().toISOString() });
    const stats = await storage.getStats();
    broadcast({ type: "stats", data: stats });
    broadcast({ type: "bag_updated", data: updated });
    res.json(updated);
  });

  // Bulk status update
  app.patch("/api/bags/bulk-status", async (req, res) => {
    const { ids, status } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "ids required" });
    let count = 0;
    for (const id of ids) {
      const bag = await storage.getBag(id);
      if (!bag) continue;
      const prev = bag.status;
      await storage.updateBagStatus(id, status);
      await storage.createStatusLog({ bag_id: id, previous_status: prev, new_status: status, timestamp: new Date().toISOString() });
      count++;
    }
    const stats = await storage.getStats();
    broadcast({ type: "stats", data: stats });
    res.json({ updated: count });
  });

  // Soft delete a bag
  app.delete("/api/bags/:id", async (req, res) => {
    const bag = await storage.getBag(Number(req.params.id));
    if (!bag) return res.status(404).json({ error: "Not found" });
    const { error } = await supabase.from("bags").update({ deleted: true }).eq("id", bag.id);
    if (error) return res.status(500).json({ error: error.message });
    const stats = await storage.getStats();
    broadcast({ type: "stats", data: stats });
    broadcast({ type: "bag_deleted", data: { id: bag.id } });
    res.json({ deleted: true });
  });

  // Attendee search
  app.get("/api/attendees/search", async (req, res) => {
    const q = req.query.q as string;
    if (!q || q.length < 2) return res.json([]);
    res.json(await storage.searchAttendees(q));
  });

  // CSV export
  app.get("/api/export/csv", async (_req, res) => {
    const allBags = await storage.getBags();
    const trucks = await storage.getTrucks();
    const truckMap = Object.fromEntries(trucks.map(t => [t.id, t.name]));
    const sl: Record<string, string> = { checked_in: "Checked In", cleaning: "In Cleaning", complete: "Complete", picked_up: "Picked Up" };
    const headers = ["Last Name", "First Name", "Department", "Phone", "Day Leaving", "MEU", "Status", "Load #", "Tag Color", "Checked In", "Last Updated"];
    const rows = allBags.map(b => [
      b.last_name, b.first_name, b.department || "", b.phone || "", b.day_leaving || "",
      truckMap[b.truck_id] || "", sl[b.status] || b.status, b.load_number || "", b.tag_color || "", b.created_at, b.updated_at,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=redline-fdic-gear.csv");
    res.send(csv);
  });
}
