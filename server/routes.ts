import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";

let wss: WebSocketServer;

function broadcast(data: any) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

export async function registerRoutes(httpServer: Server, app: Express) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", ws => {
    ws.send(JSON.stringify({ type: "stats", data: storage.getStats() }));
  });

  app.get("/api/trucks", (_req, res) => res.json(storage.getTrucks()));
  app.get("/api/stats", (_req, res) => res.json(storage.getStats()));

  // Bags
  app.get("/api/bags", (req, res) => {
    const truckId = req.query.truckId ? Number(req.query.truckId) : undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    res.json(storage.getBags({ truckId, status, search }));
  });

  app.get("/api/bags/:id", (req, res) => {
    const bag = storage.getBag(Number(req.params.id));
    if (!bag) return res.status(404).json({ error: "Not found" });
    const logs = storage.getStatusLog(bag.id);
    res.json({ ...bag, statusLog: logs });
  });

  // Check in a bag
  app.post("/api/bags", (req, res) => {
    try {
      const now = new Date().toISOString();
      const bag = storage.createBag({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        department: req.body.department || null,
        phone: req.body.phone || null,
        dayLeaving: req.body.dayLeaving || null,
        truckId: Number(req.body.truckId),
        status: "checked_in",
        notes: req.body.notes || null,
        createdAt: now,
        updatedAt: now,
      });
      storage.createStatusLog({ bagId: bag.id, previousStatus: null, newStatus: "checked_in", timestamp: now });
      broadcast({ type: "stats", data: storage.getStats() });
      broadcast({ type: "bag_created", data: bag });
      res.status(201).json(bag);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Update status
  app.patch("/api/bags/:id/status", (req, res) => {
    const bag = storage.getBag(Number(req.params.id));
    if (!bag) return res.status(404).json({ error: "Not found" });
    const prev = bag.status;
    const updated = storage.updateBagStatus(bag.id, req.body.status);
    storage.createStatusLog({ bagId: bag.id, previousStatus: prev, newStatus: req.body.status, timestamp: new Date().toISOString() });
    broadcast({ type: "stats", data: storage.getStats() });
    broadcast({ type: "bag_updated", data: updated });
    res.json(updated);
  });

  // Bulk status update
  app.patch("/api/bags/bulk-status", (req, res) => {
    const { ids, status } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "ids required" });
    let count = 0;
    for (const id of ids) {
      const bag = storage.getBag(id);
      if (!bag) continue;
      const prev = bag.status;
      storage.updateBagStatus(id, status);
      storage.createStatusLog({ bagId: id, previousStatus: prev, newStatus: status, timestamp: new Date().toISOString() });
      count++;
    }
    broadcast({ type: "stats", data: storage.getStats() });
    res.json({ updated: count });
  });

  // Attendee search
  app.get("/api/attendees/search", (req, res) => {
    const q = req.query.q as string;
    if (!q || q.length < 2) return res.json([]);
    res.json(storage.searchAttendees(q));
  });

  // CSV export
  app.get("/api/export/csv", (_req, res) => {
    const allBags = storage.getBags();
    const truckMap = Object.fromEntries(storage.getTrucks().map(t => [t.id, t.name]));
    const sl: Record<string, string> = { checked_in: "Checked In", cleaning: "In Cleaning", complete: "Complete", picked_up: "Picked Up" };
    const headers = ["Last Name", "First Name", "Department", "Phone", "Day Leaving", "MEU", "Status", "Checked In", "Last Updated"];
    const rows = allBags.map(b => [
      b.lastName, b.firstName, b.department || "", b.phone || "", b.dayLeaving || "",
      truckMap[b.truckId] || "", sl[b.status] || b.status, b.createdAt, b.updatedAt,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=redline-fdic-gear.csv");
    res.send(csv);
  });
}
