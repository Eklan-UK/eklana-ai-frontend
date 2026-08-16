"use client";

import { ScenarioManagementPage } from "@/components/simulation/ScenarioManagementPage";

export default function AdminSimulationScenariosPage() {
  return (
    <div className="p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-2">
          Simulation Room
        </h1>
        <p className="text-sm text-gray-500 dark:text-muted-foreground mb-6">
          Upload a slide deck to create a scenario and assign it to learners
        </p>
        <ScenarioManagementPage variant="admin" />
      </div>
    </div>
  );
}
