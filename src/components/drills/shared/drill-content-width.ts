/** Responsive drill page width — mobile uses nearly full width; md+ caps grow with size. */
export const drillContentWidthClasses = {
  sm: "w-full max-w-sm mx-auto",
  md: "w-full max-w-md md:max-w-2xl mx-auto",
  lg: "w-full max-w-lg md:max-w-3xl mx-auto",
  xl: "w-full max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto",
  "2xl": "w-full max-w-md md:max-w-2xl mx-auto",
  "3xl": "w-full max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto",
  "4xl": "w-full max-w-xl md:max-w-4xl mx-auto",
} as const;

export type DrillContentWidth = keyof typeof drillContentWidthClasses;
