/**
 * Drill utility functions
 * Centralized logic for drill-related operations
 */

export type DrillStatus = "active" | "ongoing" | "upcoming" | "completed" | "missed" | "pending";

export interface DrillItem {
  assignmentId?: string;
  drill: {
    _id: string;
    date: string;
    duration_days?: number;
    is_active?: boolean;
    type: string;
  };
  dueDate?: string;
  completedAt?: string;
  assignmentStatus?: string;
  status?: string;
}

/**
 * Format date to readable string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get drill status based on dates and completion
 * Note: drill.date is now the completion/due date, not start date
 * Drills become active immediately upon assignment
 */
export function getDrillStatus(drill: any): DrillStatus {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Use assignment dueDate if available, otherwise use drill.date as completion date
  const completionDate = drill.dueDate
    ? new Date(drill.dueDate)
    : new Date(drill.date || drill.drill?.date);
  completionDate.setHours(23, 59, 59, 999);

  // Check if drill is completed
  if (drill.completedAt || drill.assignmentStatus === "completed" || drill.status === "completed") {
    return "completed";
  }

  // Check if drill is missed (completion date has passed and not completed)
  if (
    now > completionDate &&
    !drill.completedAt &&
    drill.assignmentStatus !== "completed" &&
    drill.status !== "completed"
  ) {
    return "missed";
  }

  // If drill has an assignment, it's active/ongoing (drills are active immediately upon assignment)
  // Status is "ongoing" if it's part of an assignment, "active" otherwise
  if (drill.assignmentId || drill.drill) {
    return "ongoing";
  }

  // Default to active (drill is available)
  return "active";
}

/**
 * Get drill type icon
 */
export function getDrillIcon(type: string): string {
  const icons: Record<string, string> = {
    vocabulary: "📚",
    roleplay: "💬",
    matching: "🔗",
    definition: "📖",
    summary: "📝",
    grammar: "✏️",
    sentence_writing: "✍️",
  };
  return icons[type] || "📚";
}

/**
 * Get drill type info (icon, color, border color)
 */
export function getDrillTypeInfo(type: string): {
  icon: string;
  color: string;
  borderColor: string;
} {
  const types: Record<
    string,
    { icon: string; color: string; borderColor: string }
  > = {
    vocabulary: {
      icon: "📚",
      color: "green",
      borderColor: "border-l-green-500",
    },
    roleplay: { icon: "💬", color: "blue", borderColor: "border-l-blue-500" },
    matching: {
      icon: "🔗",
      color: "purple",
      borderColor: "border-l-purple-500",
    },
    definition: {
      icon: "📖",
      color: "orange",
      borderColor: "border-l-orange-500",
    },
    summary: {
      icon: "📝",
      color: "indigo",
      borderColor: "border-l-indigo-500",
    },
    grammar: { icon: "✏️", color: "pink", borderColor: "border-l-pink-500" },
    sentence_writing: {
      icon: "✍️",
      color: "teal",
      borderColor: "border-l-teal-500",
    },
  };
  return (
    types[type] || {
      icon: "📚",
      color: "gray",
      borderColor: "border-l-gray-500",
    }
  );
}


