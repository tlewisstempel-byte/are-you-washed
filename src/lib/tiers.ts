export interface Tier {
  number: 1 | 2 | 3 | 4;
  name: string;
  accentColor: string;
  minScore: number;
  maxScore: number;
}

export const TIERS: Tier[] = [
  { number: 1, name: "Certified Free Range", accentColor: "#1A3EFF", minScore: 75, maxScore: 100 },
  { number: 2, name: "Lightly Rinsed",       accentColor: "#6E6E6E", minScore: 50, maxScore: 74  },
  { number: 3, name: "Fresh Out the Shower", accentColor: "#FF5030", minScore: 25, maxScore: 49  },
  { number: 4, name: "Skin Extra Smooth",    accentColor: "#FF2D55", minScore: 0,  maxScore: 24  },
];

export function getTierForScore(score: number): Tier {
  return TIERS.find((t) => score >= t.minScore && score <= t.maxScore) ?? TIERS[3];
}
