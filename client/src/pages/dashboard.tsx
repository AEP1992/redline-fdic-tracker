import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, ClipboardCheck, Sparkles, PackageCheck, UserCheck, Package, Wifi, WifiOff } from "lucide-react";
import { useLocation } from "wouter";

type TruckStats = { truckId: number; truckName: string; total: number; checkedIn: number; cleaning: number; complete: number; pickedUp: number };
type Stats = { total: number; checkedIn: number; cleaning: number; complete: number; pickedUp: number; byTruck: TruckStats[] };

export default function Dashboard({ stats, wsConnected }: { stats: Stats | null; wsConnected: boolean }) {
  const [, setLocation] = useLocation();
  const { data: fetched } = useQuery<Stats>({ queryKey: ["/api/stats"], queryFn: async () => { const r = await apiRequest("GET", "/api/stats"); return r.json(); }, refetchInterval: 10000 });
  const s = stats || fetched;

  if (!s) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  const done = s.complete + s.pickedUp;
  const pct = s.total > 0 ? Math.round((done / s.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Command Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live gear tracking across all units</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`gap-1.5 ${wsConnected ? "text-green-600 border-green-300 bg-green-50" : "text-red-600 border-red-300 bg-red-50"}`}>
            {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {wsConnected ? "Live" : "Offline"}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => window.open("/api/export/csv", "_blank")} data-testid="button-export">
            <Download className="h-4 w-4 mr-1.5" />Export
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Total Bags" value={s.total} icon={<Package className="h-5 w-5" />} color="text-gray-700" bg="bg-white" iconBg="bg-gray-100" />
        <KPI label="Checked In" value={s.checkedIn} icon={<ClipboardCheck className="h-5 w-5" />} color="text-amber-700" bg="bg-white" iconBg="bg-amber-50" />
        <KPI label="In Cleaning" value={s.cleaning} icon={<Sparkles className="h-5 w-5" />} color="text-blue-700" bg="bg-white" iconBg="bg-blue-50" />
        <KPI label="Complete" value={s.complete} icon={<PackageCheck className="h-5 w-5" />} color="text-green-700" bg="bg-white" iconBg="bg-green-50" />
        <KPI label="Picked Up" value={s.pickedUp} icon={<UserCheck className="h-5 w-5" />} color="text-gray-500" bg="bg-white" iconBg="bg-gray-100" />
      </div>

      {/* Progress */}
      <Card className="shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Overall Completion</span>
            <span className="text-sm font-bold text-red-600">{pct}%</span>
          </div>
          <Progress value={pct} className="h-3" />
          <p className="text-xs text-gray-500 mt-2">{done} of {s.total} bags cleaned or picked up</p>
        </CardContent>
      </Card>

      {/* Truck Grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">MEU Units</h2>
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
                  <Progress value={tp} className="h-2 mb-3" />
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <Mini label="Checked In" value={t.checkedIn} color="text-amber-600" />
                    <Mini label="Cleaning" value={t.cleaning} color="text-blue-600" />
                    <Mini label="Complete" value={t.complete} color="text-green-600" />
                    <Mini label="Picked Up" value={t.pickedUp} color="text-gray-400" />
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

function KPI({ label, value, icon, color, bg, iconBg }: { label: string; value: number; icon: React.ReactNode; color: string; bg: string; iconBg: string }) {
  return (
    <Card className={`${bg} shadow-sm`}>
      <CardContent className="pt-4 pb-4 flex items-center gap-4">
        <div className={`w-11 h-11 rounded-lg ${iconBg} ${color} flex items-center justify-center flex-shrink-0`}>{icon}</div>
        <div>
          <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
          <div className="text-xs text-gray-500 font-medium">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-400 leading-tight">{label}</div>
    </div>
  );
}
