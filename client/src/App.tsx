import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "./hooks/use-websocket";
import { LayoutDashboard, ClipboardCheck, Search, Menu, X } from "lucide-react";

import Dashboard from "./pages/dashboard";
import IntakePage from "./pages/intake";
import LookupPage from "./pages/lookup";
import TruckDetailPage from "./pages/truck-detail";
import NotFound from "./pages/not-found";

type Stats = {
  total: number; checkedIn: number; cleaning: number; complete: number; pickedUp: number;
  byTruck: { truckId: number; truckName: string; total: number; checkedIn: number; cleaning: number; complete: number; pickedUp: number }[];
};

function AppContent() {
  const [location] = useLocation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const onWsMessage = useCallback((msg: { type: string; data: any }) => {
    if (msg.type === "stats") setStats(msg.data);
    if (msg.type === "bag_created" || msg.type === "bag_updated") queryClient.invalidateQueries({ queryKey: ["/api/bags"] });
  }, []);

  const { connected } = useWebSocket(onWsMessage);
  useEffect(() => { setSidebarOpen(false); }, [location]);

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/check-in", label: "Check In", icon: ClipboardCheck },
    { path: "/lookup", label: "Lookup", icon: Search },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar — dark like Salesforce nav */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-60 bg-[#1B2A4A] text-white flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-start gap-3">
              <img src="/redline-logo-light.svg" alt="RedLine Gear Cleaning" className="h-12 w-auto" />
              <p className="text-[10px] font-semibold tracking-widest uppercase text-white/40">FDIC Gear Tracker</p>
            </div>
            <button className="lg:hidden text-white/60" onClick={() => setSidebarOpen(false)}><X className="h-5 w-5" /></button>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => {
            const isActive = location === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/8"}`}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className="h-[18px] w-[18px]" />{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 flex items-center gap-2">
          <img src="/redline-logo-light.svg" alt="" className="h-5 w-auto opacity-25" />
          <p className="text-[10px] text-white/25 uppercase tracking-wide">FDIC 2026</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b shadow-sm px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} data-testid="button-menu"><Menu className="h-5 w-5 text-gray-600" /></button>
          <img src="/redline-logo.svg" alt="RedLine" className="h-8 w-auto" />
        </div>
        <div className="p-5 lg:p-8 max-w-6xl">
          <Switch>
            <Route path="/"><Dashboard stats={stats} wsConnected={connected} /></Route>
            <Route path="/check-in"><IntakePage /></Route>
            <Route path="/lookup"><LookupPage /></Route>
            <Route path="/trucks/:id">{params => <TruckDetailPage truckId={Number(params.id)} />}</Route>
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}><AppContent /></Router>
      <Toaster />
    </QueryClientProvider>
  );
}
