export interface PlayoffScenario {
  label: string;
  shortLabel: string;
  color: string;       // tailwind-compatible CSS var or hex
  bgColor: string;     // for badge background
  borderColor: string; // for row left border
}

const SCENARIOS: Record<string, PlayoffScenario> = {
  upperBye: {
    label: "Upper Bracket Bye",
    shortLabel: "UB Bye",
    color: "var(--gold)",
    bgColor: "rgba(212, 160, 23, 0.15)",
    borderColor: "var(--gold)",
  },
  upperBracket: {
    label: "Upper Bracket",
    shortLabel: "Upper",
    color: "var(--green)",
    bgColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "var(--green)",
  },
  lowerBye: {
    label: "Lower Bracket Bye",
    shortLabel: "LB Bye",
    color: "var(--blue)",
    bgColor: "rgba(59, 130, 246, 0.15)",
    borderColor: "var(--blue)",
  },
  lowerBracket: {
    label: "Lower Bracket",
    shortLabel: "Lower",
    color: "var(--blue)",
    bgColor: "rgba(59, 130, 246, 0.10)",
    borderColor: "var(--blue)",
  },
  gauntletQualifier: {
    label: "Gauntlet Qualifier",
    shortLabel: "Gauntlet Q",
    color: "var(--orange)",
    bgColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "var(--orange)",
  },
  gauntletPrelim: {
    label: "Gauntlet Prelim",
    shortLabel: "Gauntlet",
    color: "var(--red)",
    bgColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "var(--red)",
  },
};

/**
 * Get the playoff scenario for a team based on their position
 * within their group standings (1-indexed).
 *
 * Group standings (8 teams per group):
 *   1st  → Upper Bracket Bye
 *   2-3  → Upper Bracket
 *   4th  → Lower Bracket Bye
 *   5th  → Lower Bracket
 *   6th  → Gauntlet Qualifier
 *   7-8  → Gauntlet Preliminaries
 */
export function getPlayoffScenario(position: number): PlayoffScenario | null {
  switch (position) {
    case 1: return SCENARIOS.upperBye;
    case 2:
    case 3: return SCENARIOS.upperBracket;
    case 4: return SCENARIOS.lowerBye;
    case 5: return SCENARIOS.lowerBracket;
    case 6: return SCENARIOS.gauntletQualifier;
    case 7:
    case 8: return SCENARIOS.gauntletPrelim;
    default: return null;
  }
}
