/**
 * Drill UI components and helpers
 */
import React from "react";
import { CheckCircle, Clock, Calendar, AlertCircle } from "lucide-react";
import { getDrillStatus, DrillStatus, DrillItem } from "./drill";

/**
 * Get status badge component
 */
export function getStatusBadge(item: DrillItem): React.ReactNode {
  const status = getDrillStatus(item);

  switch (status) {
    case "completed":
      return (
        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Completed
        </span>
      );
    case "ongoing":
    case "active":
      return (
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {status === "ongoing" ? "Ongoing" : "Active"}
        </span>
      );
    case "upcoming":
      return (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Upcoming
        </span>
      );
    case "missed":
      return (
        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Missed
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Pending
        </span>
      );
  }
}


