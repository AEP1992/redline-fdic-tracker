import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import type { Bag, Truck, StatusLog } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = { checked_in: "Checked In", cleaning: "In Cleaning", complete: "Complete", picked_up: "Picked Up" };
const STATUSES = ["checked_in", "cleaning", "complete", "picked_up"] as const;
const STATUS_STYLES: Record<string, string> = {
  checked_in: "bg-red-50 text-red-700 border-red-200",
  cleaning: "bg-red-500 text-white border-red-500",
  complete: "bg-gray-900 text-white border-gray-900",
  picked_up: "bg-gray-100 text-gray-400 border-gray-200",
};

export default function TruckDetailPage({ truckId }: { truckId: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: trucks } = useQuery<Truck[]>({ queryKey: ["/api/trucks"], queryFn: async () => { const r = await apiRequest("GET", "/api/trucks"); return r.json(); } });
  const truck = trucks?.find(t => t.id === truckId);

  const { data: allBags } = useQuery<Bag[]>({ queryKey: ["/api/bags", "truck", truckId, "all"], queryFn: async () => { const r = await apiRequest("GET", `/api/bags?truckId=${truckId}`); return r.json(); } });
  const { data: filteredBags, isLoading } = useQuery<Bag[]>({
    queryKey: ["/api/bags", "truck", truckId, statusFilter],
    queryFn: async () => { const p = new URLSearchParams({ truckId: String(truckId) }); if (statusFilter !== "all") p.set("status", statusFilter); const r = await apiRequest("GET", `/api/bags?${p}`); return r.json(); },
  });

  const total = allBags?.length || 0;
  const done = (allBags?.filter(b => b.status === "complete" || b.status === "picked_up").length || 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{truck?.name || `Truck ${truckId}`}</h1>
          <p className="text-sm text-muted-foreground">{total} {total === 1 ? "bag" : "bags"}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Completion</span>
            <span className="text-sm font-bold text-primary">{pct}%</span>
          </div>
          <Progress value={pct} className="h-3" />
          <div className="grid grid-cols-4 gap-2 mt-3 text-center">
            <div><div className="text-lg font-bold text-red-400 tabular-nums">{allBags?.filter(b => b.status === "checked_in").length || 0}</div><div className="text-[10px] text-muted-foreground">Checked In</div></div>
            <div><div className="text-lg font-bold text-red-600 tabular-nums">{allBags?.filter(b => b.status === "cleaning").length || 0}</div><div className="text-[10px] text-muted-foreground">Cleaning</div></div>
            <div><div className="text-lg font-bold text-gray-900 tabular-nums">{allBags?.filter(b => b.status === "complete").length || 0}</div><div className="text-[10px] text-muted-foreground">Complete</div></div>
            <div><div className="text-lg font-bold text-gray-400 tabular-nums">{allBags?.filter(b => b.status === "picked_up").length || 0}</div><div className="text-[10px] text-muted-foreground">Picked Up</div></div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          <TabsTrigger value="checked_in" className="flex-1">Checked In</TabsTrigger>
          <TabsTrigger value="cleaning" className="flex-1">Cleaning</TabsTrigger>
          <TabsTrigger value="complete" className="flex-1">Complete</TabsTrigger>
          <TabsTrigger value="picked_up" className="flex-1">Picked Up</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> :
       !filteredBags || filteredBags.length === 0 ? <div className="text-center py-8 text-muted-foreground">No bags in this category</div> : (
        <div className="space-y-1">
          {filteredBags.map(bag => (
            <TruckBagRow key={bag.id} bag={bag} isExpanded={expandedId === bag.id} onToggle={() => setExpandedId(expandedId === bag.id ? null : bag.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TruckBagRow({ bag, isExpanded, onToggle }: { bag: Bag; isExpanded: boolean; onToggle: () => void }) {
  const { toast } = useToast();
  const { data: detail } = useQuery<Bag & { statusLog: StatusLog[] }>({
    queryKey: ["/api/bags", bag.id], queryFn: async () => { const r = await apiRequest("GET", `/api/bags/${bag.id}`); return r.json(); }, enabled: isExpanded,
  });
  const statusMutation = useMutation({
    mutationFn: async (s: string) => { const r = await apiRequest("PATCH", `/api/bags/${bag.id}/status`, { status: s }); return r.json(); },
    onSuccess: (_, s) => { toast({ title: "Updated", description: `${bag.last_name} → ${STATUS_LABELS[s]}` }); queryClient.invalidateQueries({ queryKey: ["/api/bags"] }); queryClient.invalidateQueries({ queryKey: ["/api/stats"] }); },
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={onToggle}>
        <span className="flex-1 text-sm"><span className="font-bold">{bag.last_name}</span>, {bag.first_name}</span>
        {bag.day_leaving && <span className="text-xs text-muted-foreground">{bag.day_leaving}</span>}
        <Badge variant="outline" className={`text-xs ${STATUS_STYLES[bag.status]}`}>{STATUS_LABELS[bag.status]}</Badge>
      </div>
      {isExpanded && (
        <div className="border-t px-4 py-4 bg-card/50 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map(s => (
              <Button key={s} size="sm" variant={bag.status === s ? "default" : "outline"} onClick={() => statusMutation.mutate(s)} disabled={statusMutation.isPending || bag.status === s} className={`text-xs ${bag.status === s ? "" : STATUS_STYLES[s]}`}>{STATUS_LABELS[s]}</Button>
            ))}
          </div>
          {bag.department && <p className="text-sm text-muted-foreground">{bag.department}</p>}
          {detail?.statusLog && detail.statusLog.length > 0 && (
            <div className="space-y-1">
              {detail.statusLog.map(log => (
                <div key={log.id} className="flex items-center gap-2 text-xs">
                  <Clock className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                  {log.previous_status && <><Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[log.previous_status]}`}>{STATUS_LABELS[log.previous_status]}</Badge><ArrowRight className="h-3 w-3" /></>}
                  <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[log.new_status]}`}>{STATUS_LABELS[log.new_status]}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
