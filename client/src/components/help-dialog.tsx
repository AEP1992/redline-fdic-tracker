import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

interface HelpDialogProps {
  pageKey: string;
  title: string;
  lines: string[];
}

export function HelpDialog({ pageKey, title, lines }: HelpDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5 h-10 px-4 text-sm" data-testid={`btn-help-${pageKey}`}>
        <HelpCircle className="h-4 w-4" />Help
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">{i + 1}</span>
                <span className="text-gray-700 leading-relaxed">{line}</span>
              </div>
            ))}
          </div>
          <Button onClick={() => setOpen(false)} className="w-full mt-4 h-12 text-base font-semibold" data-testid="btn-close-help">
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
