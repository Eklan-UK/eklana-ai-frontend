"use client";

import { Header } from "@/components/layout/Header";
import { ScenarioManagementPage } from "@/components/simulation/ScenarioManagementPage";

export default function TutorSimulationScenariosPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />
      <Header title="Simulation Room" />
      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        <p className="text-sm text-gray-500 mb-6">
          Upload a slide deck to create a scenario and assign it to learners
        </p>
        <ScenarioManagementPage variant="tutor" />
      </div>
    </div>
  );
}
