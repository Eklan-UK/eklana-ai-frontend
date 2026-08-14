"use client";

import { BottomNav } from "@/components/layout/BottomNav";

// Placeholder route so the Practice page's Simulation Room card doesn't 404.
// Full scenario-list UI is a separate task.
export default function SimulationRoomPage() {
  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="max-w-md mx-auto px-4 py-10 md:max-w-2xl md:px-8 text-center space-y-2">
        <h1 className="text-2xl font-bold font-nunito text-foreground">
          Simulation Room
        </h1>
        <p className="text-sm text-muted-foreground font-nunito">
          Coming soon.
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
