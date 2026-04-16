import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, ChevronDown, ChevronUp, Clock, ArrowRight, Loader2, Phone, MapPin, Calendar } from "lucide-react";
import type { Bag, Truck, StatusLog } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = { checked_in: "Checked In", cleaning: "In Cleaning", complete: "Complete", picked_up: "Picked Up" };
const STATUSES = ["checked_in", "cleaning", "complete", "picked_up"] as const;
const STATUS_STYLES: Record<string, string> = {
  checked_in: "bg-amber-50 text-amber-700 border-amber-200",
  cleaning: "bg-blue-50 text-blue-700 border-blue-200",
  complete: "bg-green-50 text-green-700 border-green-200",
  picked_up: "bg-gray-50 text-gray-500 border-gray-200",
};

export default function LookupPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("cleaning");

  const { data: trucks } = useQuery<Truck[]>({ queryKey: ["/api/trucks"], queryFn: async () => { const r = await apiRequest("GET", "/api/trucks"); return r.json(); } });
  const truckMap = Object.fromEntries((trucks || []).map(t => [t.id, t.name]));

  const { data: bagList, isLoading } = useQuery<Bag[]>({
    queryKey: ["/api/bags", search, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (statusFilter !== "all") p.set("status", statusFilter);
      const r = await apiRequest("GET", `/api/bags?${p}`);
      return r.json();
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("PATCH", "/api/bags/bulk-status", { ids: Array.from(selectedIds), status: bulkStatus }); return r.json(); },
    onSuccess: (data) => {
      toast({ title: "Bulk update", description: `${data.updated} bags → ${STATUS_LABELS[bulkStatus]}` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/bags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  const toggleSelect = (id: number) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => { if (!bagList) return; setSelectedIds(selectedIds.size === bagList.length ? new Set() : new Set(bagList.map(b => b.id))); };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Gear Lookup</h1>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by last name, first name, or department..." className="pl-10 h-11" data-testid="input-search" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-11" data-testid="select-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/30">
          <CardContent className="pt-3 pb-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={() => bulkMutation.mutate()} disabled={bulkMutation.isPending}>
              {bulkMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Update All
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {isLoading ? <div className="text-center py-12 text-muted-foreground">Loading...</div> :
       !bagList || bagList.length === 0 ? <div className="text-center py-12 text-muted-foreground">{search ? "No bags found" : "No bags checked in yet"}</div> : (
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Checkbox checked={bagList.length > 0 && selectedIds.size === bagList.length} onCheckedChange={toggleAll} className="mr-1" />
            <span className="flex-1">Name</span>
            <span className="hidden sm:block w-44">Department</span>
            <span className="hidden sm:block w-16 text-center">Leaving</span>
            <span className="w-24 text-center">Status</span>
            <span className="hidden sm:block w-20 text-center">MEU</span>
            <span className="w-6" />
          </div>
          {bagList.map(bag => (
            <BagRow key={bag.id} bag={bag} truckName={truckMap[bag.truck_id] || "?"} isExpanded={expandedId === bag.id} isSelected={selectedIds.has(bag.id)}
              onToggleExpand={() => setExpandedId(expandedId === bag.id ? null : bag.id)} onToggleSelect={() => toggleSelect(bag.id)} truckMap={truckMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BagRow({ bag, truckName, isExpanded, isSelected, onToggleExpand, onToggleSelect, truckMap }: {
  bag: Bag; truckName: string; isExpanded: boolean; isSelected: boolean; onToggleExpand: () => void; onToggleSelect: () => void; truckMap: Record<number, string>;
}) {
  const { toast } = useToast();
  const { data: detail } = useQuery<Bag & { statusLog: StatusLog[] }>({
    queryKey: ["/api/bags", bag.id], queryFn: async () => { const r = await apiRequest("GET", `/api/bags/${bag.id}`); return r.json(); }, enabled: isExpanded,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => { const r = await apiRequest("PATCH", `/api/bags/${bag.id}/status`, { status: newStatus }); return r.json(); },
    onSuccess: (_, newStatus) => {
      toast({ title: "Updated", description: `${bag.last_name} → ${STATUS_LABELS[newStatus]}` });
      queryClient.invalidateQueries({ queryKey: ["/api/bags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bags", bag.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={onToggleExpand}>
        <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect()} onClick={e => e.stopPropagation()} className="mr-1" />
        <span className="flex-1 text-sm"><span className="font-bold">{bag.last_name}</span>, {bag.first_name}</span>
        <span className="hidden sm:block w-44 text-sm text-muted-foreground truncate">{bag.department || "—"}</span>
        <span className="hidden sm:block w-16 text-center text-xs text-muted-foreground">{bag.day_leaving || "—"}</span>
        <Badge variant="outline" className={`w-24 justify-center text-xs ${STATUS_STYLES[bag.status]}`}>{STATUS_LABELS[bag.status]}</Badge>
        <span className="hidden sm:block w-20 text-center text-xs text-muted-foreground">{truckName}</span>
        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {isExpanded && (
        <div className="border-t px-4 py-4 bg-card/50 space-y-4">
          {/* Status buttons */}
          <div>
            <span className="text-xs font-medium text-muted-foreground mb-2 block">Update Status</span>
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map(s => (
                <Button key={s} size="sm" variant={bag.status === s ? "default" : "outline"}
                  onClick={() => statusMutation.mutate(s)} disabled={statusMutation.isPending || bag.status === s}
                  className={`text-xs ${bag.status === s ? "" : STATUS_STYLES[s]}`} data-testid={`btn-status-${s}-${bag.id}`}
                >{STATUS_LABELS[s]}</Button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-wrap gap-4 text-sm">
            {bag.phone && <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{bag.phone}</span>}
            {bag.department && <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{bag.department}</span>}
            {bag.day_leaving && <span className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="h-3.5 w-3.5" />Leaving {bag.day_leaving}</span>}
            <span className="text-muted-foreground">MEU: {truckName}</span>
          </div>

          {/* History */}
          {detail?.statusLog && detail.statusLog.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-2 block">History</span>
              <div className="space-y-1.5">
                {detail.statusLog.map(log => (
                  <div key={log.id} className="flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                    {log.previous_status && <><Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[log.previous_status]}`}>{STATUS_LABELS[log.previous_status]}</Badge><ArrowRight className="h-3 w-3 text-muted-foreground" /></>}
                    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[log.new_status]}`}>{STATUS_LABELS[log.new_status]}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
