import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Phone, MessageSquare, CheckCircle, Search, MapPin, Calendar, Hash, Palette, Truck, Bell, BellOff } from "lucide-react";
import type { Bag, Truck as TruckType } from "@shared/schema";

export default function ReadyPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: trucks } = useQuery<TruckType[]>({
    queryKey: ["/api/trucks"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/trucks"); return r.json(); },
  });
  const truckMap = Object.fromEntries((trucks || []).map(t => [t.id, t.name]));

  const { data: readyBags, isLoading } = useQuery<Bag[]>({
    queryKey: ["/api/bags", "complete", search],
    queryFn: async () => {
      const p = new URLSearchParams({ status: "complete" });
      if (search) p.set("search", search);
      const r = await apiRequest("GET", `/api/bags?${p}`);
      return r.json();
    },
    refetchInterval: 10000,
  });

  // Sort: not-notified first, then notified
  const sorted = [...(readyBags || [])].sort((a, b) => {
    const aN = (a as any).notified_at;
    const bN = (b as any).notified_at;
    if (!aN && bN) return -1;
    if (aN && !bN) return 1;
    return 0;
  });

  const notNotified = sorted.filter(b => !(b as any).notified_at).length;
  const count = sorted.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ready for Pickup</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gear that's cleaned — contact these people</p>
        </div>
        <div className="flex gap-2">
          {notNotified > 0 && (
            <Badge variant="outline" className="text-sm px-3 py-1.5 bg-amber-50 text-amber-700 border-amber-200 font-bold">
              {notNotified} to text
            </Badge>
          )}
          <Badge variant="outline" className="text-sm px-3 py-1.5 bg-green-50 text-green-700 border-green-200 font-bold">
            {count} ready
          </Badge>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or department..." className="pl-10 h-11" data-testid="input-search-ready" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : count === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{search ? "No matches" : "No gear ready for pickup yet"}</div>
      ) : (
        <div className="space-y-3">
          {sorted.map(bag => (
            <ReadyCard key={bag.id} bag={bag} truckMap={truckMap} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReadyCard({ bag, truckMap }: { bag: Bag; truckMap: Record<number, string> }) {
  const { toast } = useToast();
  const notifiedAt = (bag as any).notified_at;
  const isNotified = !!notifiedAt;

  const notifyMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("PATCH", `/api/bags/${bag.id}/notify`); return r.json(); },
    onSuccess: () => {
      toast({ title: "Marked as notified", description: `${bag.last_name}, ${bag.first_name}` });
      queryClient.invalidateQueries({ queryKey: ["/api/bags"] });
    },
  });

  const pickupMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("PATCH", `/api/bags/${bag.id}/status`, { status: "picked_up" }); return r.json(); },
    onSuccess: () => {
      toast({ title: "Picked up", description: `${bag.last_name} marked as picked up` });
      queryClient.invalidateQueries({ queryKey: ["/api/bags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  return (
    <Card className={`shadow-sm transition-opacity ${isNotified ? "opacity-50" : ""}`}>
      <CardContent className="pt-4 pb-4">
        {/* Name */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {bag.last_name}, {bag.first_name}
              {isNotified && (
                <span className="inline-flex items-center gap-1 ml-2 bg-green-50 border border-green-200 text-green-600 text-xs font-semibold px-2 py-0.5 rounded-full align-middle">
                  <CheckCircle className="h-3 w-3" />Notified
                </span>
              )}
            </h2>
            {bag.department && (
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                <MapPin className="h-3.5 w-3.5" />{bag.department}
              </p>
            )}
          </div>
          <Badge className="bg-green-100 text-green-700 border-green-200">Complete</Badge>
        </div>

        {/* Phone */}
        {bag.phone ? (
          <a href={`sms:${bag.phone.replace(/[^\d+]/g, '')}`}
            className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-3 hover:bg-blue-100 transition-colors"
            data-testid={`sms-${bag.id}`}
          >
            <MessageSquare className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <span className="text-lg font-bold text-blue-700 tracking-wide">{bag.phone}</span>
            <span className="text-xs text-blue-500 ml-auto">Tap to text</span>
          </a>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-3">
            <Phone className="h-5 w-5 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-500 font-medium">No phone number on file</span>
          </div>
        )}

        {/* Details */}
        <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
          {bag.day_leaving && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Leaving {bag.day_leaving}</span>}
          <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />{truckMap[bag.truck_id] || "Unknown MEU"}</span>
          {bag.load_number && <span className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" />Load {bag.load_number}</span>}
          {bag.tag_color && <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" />{bag.tag_color} tag</span>}
        </div>

        {/* Notified timestamp */}
        {isNotified && (
          <p className="text-xs text-green-600 mb-3">
            Notified at {new Date(notifiedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {bag.phone && !isNotified && (
            <Button variant="outline" className="flex-1 h-11 text-sm font-semibold bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
              onClick={() => notifyMutation.mutate()} disabled={notifyMutation.isPending} data-testid={`btn-notify-${bag.id}`}
            >
              <Bell className="h-4 w-4 mr-2" />Mark as Notified
            </Button>
          )}
          {isNotified && (
            <Button variant="outline" className="flex-1 h-11 text-sm font-semibold bg-green-50 border-green-200 text-green-600" disabled>
              <CheckCircle className="h-4 w-4 mr-2" />Notified ✓
            </Button>
          )}
          <Button variant="outline" className="flex-1 h-11 text-sm font-semibold border-gray-300 hover:bg-gray-50"
            onClick={() => pickupMutation.mutate()} disabled={pickupMutation.isPending} data-testid={`btn-pickup-${bag.id}`}
          >
            <CheckCircle className="h-4 w-4 mr-2" />Picked Up
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
