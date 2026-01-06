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
 */
export function getDrillStatus(drill: any): DrillStatus {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Use assignment dueDate if available, otherwise calculate from drill date + duration
  const dueDate = drill.dueDate
    ? new Date(drill.dueDate)
    : (() => {
        const endDate = new Date(drill.date || drill.drill?.date);
        endDate.setDate(endDate.getDate() + (drill.duration_days || drill.drill?.duration_days || 1) - 1);
        return endDate;
      })();
  dueDate.setHours(23, 59, 59, 999);

  const startDate = new Date(drill.date || drill.drill?.date);
  startDate.setHours(0, 0, 0, 0);

  // Check if drill is completed
  if (drill.completedAt || drill.assignmentStatus === "completed" || drill.status === "completed") {
    return "completed";
  }

  // Check if drill is missed (due date has passed and not completed)
  if (
    now > dueDate &&
    !drill.completedAt &&
    drill.assignmentStatus !== "completed" &&
    drill.status !== "completed"
  ) {
    return "missed";
  }

  // Check if drill is active/ongoing (today is within the date range)
  // Removed is_active check - drills are always available
  if (now >= startDate && now <= dueDate) {
    return drill.drill ? "ongoing" : "active";
  }

  // Check if drill is upcoming (start date is in the future)
  if (startDate > now) {
    return "upcoming";
  }

  // Default to ongoing/active if past start date but before due date
  return drill.drill ? "ongoing" : "active";
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


