import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, CheckCircle, Loader2 } from "lucide-react";
import type { Truck, Attendee } from "@shared/schema";

export default function IntakePage() {
  const { toast } = useToast();
  const [truckId, setTruckId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [dayLeaving, setDayLeaving] = useState("");
  const [loadNumber, setLoadNumber] = useState("");
  const [tagColor, setTagColor] = useState("");
  const [sessionCount, setSessionCount] = useState(0);
  const [suggestions, setSuggestions] = useState<Attendee[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const sugRef = useRef<HTMLDivElement>(null);

  const { data: trucks } = useQuery<Truck[]>({ queryKey: ["/api/trucks"], queryFn: async () => { const r = await apiRequest("GET", "/api/trucks"); return r.json(); } });

  const searchAttendees = async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const r = await apiRequest("GET", `/api/attendees/search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch { setSuggestions([]); }
  };

  const selectSuggestion = (a: Attendee) => {
    setFirstName(a.first_name);
    setLastName(a.last_name);
    if (a.phone) setPhone(a.phone);
    if (a.department) setDepartment(a.department);
    setShowSuggestions(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (sugRef.current && !sugRef.current.contains(e.target as Node)) setShowSuggestions(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/bags", {
        firstName: firstName.trim(), lastName: lastName.trim(),
        department: department.trim() || null, phone: phone.trim() || null,
        dayLeaving: dayLeaving || null, truckId: Number(truckId),
        loadNumber: loadNumber || null, tagColor: tagColor || null,
      });
      return r.json();
    },
    onSuccess: () => {
      setSessionCount(c => c + 1);
      const statusMsg = (loadNumber && tagColor) ? "Checked in → Cleaning" : "Checked in";
      toast({ title: statusMsg, description: `${firstName} ${lastName} — ${department || "No dept"}` });
      setFirstName(""); setLastName(""); setPhone(""); setDepartment(""); setDayLeaving(""); setLoadNumber(""); setTagColor("");
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bags"] });
      nameRef.current?.focus();
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const canSubmit = truckId && lastName.trim() && firstName.trim() && phone.trim() && department.trim() && dayLeaving;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Check In Gear</h1>
        <Badge variant="outline" className="gap-1.5 text-sm px-3 py-1">
          <ClipboardCheck className="h-3.5 w-3.5" />{sessionCount} checked in
        </Badge>
      </div>

      {/* Select truck */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <Label className="text-sm font-semibold mb-2 block">Assign to MEU</Label>
          <Select value={truckId} onValueChange={setTruckId}>
            <SelectTrigger className="h-12 text-base" data-testid="select-truck">
              <SelectValue placeholder="Choose truck..." />
            </SelectTrigger>
            <SelectContent>
              {trucks?.map(t => <SelectItem key={t.id} value={String(t.id)} data-testid={`select-truck-${t.id}`}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {truckId && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Bag Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Last Name — primary search field */}
            <div className="relative" ref={sugRef}>
              <Label className="text-sm font-medium">Last Name *</Label>
              <Input ref={nameRef} value={lastName}
                onChange={e => { setLastName(e.target.value); searchAttendees(e.target.value); }}
                placeholder="Type last name..."
                className="h-14 text-lg font-semibold mt-1" data-testid="input-last-name"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-popover-border rounded-md shadow-lg max-h-52 overflow-y-auto">
                  {suggestions.map(a => (
                    <button key={a.id} className="w-full text-left px-3 py-3 hover:bg-accent text-sm border-b border-border last:border-0" onClick={() => selectSuggestion(a)} data-testid={`suggestion-${a.id}`}>
                      <span className="font-semibold">{a.last_name}, {a.first_name}</span>
                      {a.department && <span className="text-muted-foreground ml-2 text-xs">— {a.department}</span>}
                      {a.phone && <span className="text-muted-foreground ml-2 text-xs">{a.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* First Name */}
            <div>
              <Label className="text-sm font-medium">First Name *</Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className="h-12 text-base mt-1" data-testid="input-first-name" />
            </div>

            {/* Phone + Department — auto-filled */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Phone *</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className="h-12 text-base mt-1" type="tel" data-testid="input-phone" />
              </div>
              <div>
                <Label className="text-sm font-medium">Department *</Label>
                <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="Department" className="h-12 text-base mt-1" data-testid="input-department" />
              </div>
            </div>

            {/* Day Leaving */}
            <div>
              <Label className="text-sm font-medium">Day Leaving *</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {["Wed", "Thurs", "Fri", "Sat"].map(day => (
                  <Button key={day} type="button" variant={dayLeaving === day ? "default" : "outline"}
                    className={`h-12 text-base font-semibold`}
                    onClick={() => setDayLeaving(dayLeaving === day ? "" : day)}
                    data-testid={`btn-day-${day.toLowerCase()}`}
                  >{day}</Button>
                ))}
              </div>
            </div>

            {/* Load Number + Tag Color (optional — auto-moves to Cleaning if both filled) */}
            <div className="border-t pt-4 mt-2">
              <Label className="text-sm font-semibold text-muted-foreground mb-2 block">Cleaning Info (optional — fills in = auto-moves to Cleaning)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Load #</Label>
                  <Select value={loadNumber} onValueChange={setLoadNumber}>
                    <SelectTrigger className="h-12 text-base mt-1" data-testid="select-load">
                      <SelectValue placeholder="Load..." />
                    </SelectTrigger>
                    <SelectContent>
                      {["1","2","3","4","5","6","7","8","9"].map(n => <SelectItem key={n} value={n}>Load {n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Tag Color</Label>
                  <Select value={tagColor} onValueChange={setTagColor}>
                    <SelectTrigger className="h-12 text-base mt-1" data-testid="select-color">
                      <SelectValue placeholder="Color..." />
                    </SelectTrigger>
                    <SelectContent>
                      {["Red","Orange","Yellow","Green","Blue","Purple","Teal","Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button onClick={() => submitMutation.mutate()} disabled={!canSubmit || submitMutation.isPending}
              className="w-full h-14 text-lg font-semibold" data-testid="button-check-in"
            >
              {submitMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
              Check In
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
