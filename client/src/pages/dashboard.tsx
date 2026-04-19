import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ClipboardCheck, Sparkles, PackageCheck, UserCheck, Package, Wifi, WifiOff } from "lucide-react";
import { HelpDialog } from "@/components/help-dialog";
import { useLocation } from "wouter";
import type { Bag } from "@shared/schema";

type TruckStats = { truckId: number; truckName: string; total: number; checkedIn: number; cleaning: number; complete: number; pickedUp: number };
type Stats = { total: number; checkedIn: number; cleaning: number; complete: number; pickedUp: number; byTruck: TruckStats[] };

// SVG Donut Chart
function DonutChart({ stats }: { stats: Stats }) {
  const segments = [
    { label: "Checked In", value: stats.checkedIn, color: "#fca5a5" },
    { label: "In Cleaning", value: stats.cleaning, color: "#ef4444" },
    { label: "Complete", value: stats.complete, color: "#1a1a1a" },
    { label: "Picked Up", value: stats.pickedUp, color: "#d1d5db" },
  ];
  const total = stats.total || 1;
  const r = 80, cx = 100, cy = 100, circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" width="220" height="220">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="24" />
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const currentOffset = offset;
          offset += dash;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="24"
              strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-currentOffset}
              strokeLinecap="butt" transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          );
        })}
        <text x={cx} y={cy - 8} textAnchor="middle" className="text-3xl font-extrabold" fill="#0f172a" fontSize="36" fontWeight="800">{stats.total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600" letterSpacing="0.08em">TOTAL BAGS</text>
      </svg>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-sm">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
            <span className="text-gray-500">{seg.label}</span>
            <span className="font-bold text-gray-900 ml-auto">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal progress bars for MEU completion
function MEUProgressBars({ trucks }: { trucks: TruckStats[] }) {
  const sorted = [...trucks].sort((a, b) => b.total - a.total);
  return (
    <div className="space-y-3">
      {sorted.map(t => {
        const pct = t.total > 0 ? Math.round(((t.complete + t.pickedUp) / t.total) * 100) : 0;
        return (
          <div key={t.truckId} className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700 w-16">{t.truckName}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400" style={{ width: `${pct}%`, transition: "width 0.8s ease" }} />
            </div>
            <span className="text-sm font-bold text-gray-700 w-10 text-right">{pct}%</span>
            <span className="text-xs text-gray-400 w-14 text-right">{t.total} bags</span>
          </div>
        );
      })}
    </div>
  );
}

// Recent activity feed
function ActivityFeed({ bags }: { bags: Bag[] }) {
  const statusColors: Record<string, string> = {
    checked_in: "#fca5a5", cleaning: "#ef4444", complete: "#1a1a1a", picked_up: "#d1d5db",
  };
  const statusLabels: Record<string, string> = {
    checked_in: "Checked In", cleaning: "In Cleaning", complete: "Complete", picked_up: "Picked Up",
  };
  const recent = bags.slice(0, 8);

  return (
    <div className="space-y-2.5">
      {recent.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>
      ) : (
        recent.map(b => (
          <div key={b.id} className="flex items-center gap-3 text-sm">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: statusColors[b.status] || "#9ca3af" }} />
            <span className="flex-1 truncate">
              <span className="font-semibold text-gray-900">{b.last_name}, {b.first_name}</span>
              <span className="text-gray-400"> → {statusLabels[b.status]}</span>
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {new Date(b.updated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export default function Dashboard({ stats, wsConnected }: { stats: Stats | null; wsConnected: boolean }) {
  const [, setLocation] = useLocation();
  const { data: fetched } = useQuery<Stats>({ queryKey: ["/api/stats"], queryFn: async () => { const r = await apiRequest("GET", "/api/stats"); return r.json(); }, refetchInterval: 10000 });
  const s = stats || fetched;

  // Fetch recent bags for activity feed
  const { data: recentBags } = useQuery<Bag[]>({
    queryKey: ["/api/bags", "recent"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/bags"); return r.json(); },
    refetchInterval: 10000,
  });

  if (!s) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  const done = s.complete + s.pickedUp;
  const pct = s.total > 0 ? Math.round((done / s.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/redline-logo.svg" alt="RedLine" className="h-14 w-auto hidden lg:block" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Command Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Live gear tracking across all units</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`gap-1.5 h-10 px-3 text-sm ${wsConnected ? "text-red-600 border-red-300 bg-red-50" : "text-red-600 border-red-300 bg-red-50"}`}>
            {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {wsConnected ? "Live" : "Offline"}
          </Badge>
          <Button variant="outline" size="sm" className="h-10 px-4 text-sm" onClick={() => window.open("/api/export/csv", "_blank")} data-testid="button-export">
            <Download className="h-4 w-4 mr-1.5" />Export
          </Button>
          <HelpDialog pageKey="dashboard" title="Command Dashboard" lines={[
            "This is the live overview of the entire gear cleaning operation.",
            "The top row shows total bags and how many are in each status.",
            "The donut chart shows the status breakdown visually.",
            "The MEU Progress bars show each truck's completion rate.",
            "Recent Activity shows the latest status changes in real-time.",
            "Each MEU card below shows that truck's workload — tap a card to see its full list.",
            "Everything updates in real-time. No need to refresh.",
            "Tap Export to download all data as a spreadsheet."
          ]} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Total Bags" sublabel={`Across ${s.byTruck.length} MEUs`} value={s.total} icon={<Package className="h-5 w-5" />} color="text-gray-700" iconBg="bg-gray-100" />
        <KPI label="Checked In" sublabel={s.total > 0 ? `${Math.round(s.checkedIn/s.total*100)}% of total` : ""} value={s.checkedIn} icon={<ClipboardCheck className="h-5 w-5" />} color="text-red-700" iconBg="bg-red-50" />
        <KPI label="In Cleaning" sublabel={s.total > 0 ? `${Math.round(s.cleaning/s.total*100)}% of total` : ""} value={s.cleaning} icon={<Sparkles className="h-5 w-5" />} color="text-red-600" iconBg="bg-red-100" />
        <KPI label="Complete" sublabel={s.total > 0 ? `${Math.round(s.complete/s.total*100)}% of total` : ""} value={s.complete} icon={<PackageCheck className="h-5 w-5" />} color="text-gray-900" iconBg="bg-gray-200" />
        <KPI label="Picked Up" sublabel={s.total > 0 ? `${Math.round(s.pickedUp/s.total*100)}% of total` : ""} value={s.pickedUp} icon={<UserCheck className="h-5 w-5" />} color="text-gray-400" iconBg="bg-gray-100" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Status Breakdown</h3>
            <p className="text-xs text-gray-400 mb-4">Distribution across all bags</p>
            <DonutChart stats={s} />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">MEU Progress</h3>
            <p className="text-xs text-gray-400 mb-4">Completion rate by unit (complete + picked up)</p>
            <MEUProgressBars trucks={s.byTruck} />
          </CardContent>
        </Card>
      </div>

      {/* Activity + Overall Progress Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Recent Activity</h3>
            <p className="text-xs text-gray-400 mb-4">Last 8 status changes</p>
            <ActivityFeed bags={recentBags || []} />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Overall Progress</h3>
            <p className="text-xs text-gray-400 mb-4">Bags fully processed (complete + picked up)</p>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-5xl font-extrabold text-gray-900">{pct}%</span>
              <span className="text-sm text-gray-400">{done} of {s.total} bags processed</span>
            </div>
            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400" style={{ width: `${pct}%`, transition: "width 0.8s ease" }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-4">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-300" />Checked In <b>{s.checkedIn}</b></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Cleaning <b>{s.cleaning}</b></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-900" />Complete <b>{s.complete}</b></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400" />Picked Up <b>{s.pickedUp}</b></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MEU Fleet Grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">MEU Fleet</h2>
        <p className="text-xs text-gray-400 mb-3">Per-unit breakdown — {s.byTruck.length} active units</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {s.byTruck.map(t => {
            const td = t.complete + t.pickedUp;
            const tp = t.total > 0 ? Math.round((td / t.total) * 100) : 0;
            return (
              <Card key={t.truckId} className="shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-red-200" onClick={() => setLocation(`/trucks/${t.truckId}`)} data-testid={`card-truck-${t.truckId}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-gray-900">{t.truckName}</span>
                    <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">{t.total} {t.total === 1 ? "bag" : "bags"}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400" style={{ width: `${tp}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-500">{tp}%</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <Mini label="Checked" value={t.checkedIn} color="text-amber-600" />
                    <Mini label="Cleaning" value={t.cleaning} color="text-red-600" />
                    <Mini label="Complete" value={t.complete} color="text-gray-900" />
                    <Mini label="Picked Up" value={t.pickedUp} color="text-gray-300" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, sublabel, value, icon, color, iconBg }: { label: string; sublabel: string; value: number; icon: React.ReactNode; color: string; iconBg: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
          <div className={`w-9 h-9 rounded-lg ${iconBg} ${color} flex items-center justify-center`}>{icon}</div>
        </div>
        <div className={`text-3xl font-extrabold tabular-nums ${color}`}>{value}</div>
        {sublabel && <div className="text-xs text-gray-400 mt-1">{sublabel}</div>}
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={`text-base font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-400 leading-tight">{label}</div>
    </div>
  );
}
