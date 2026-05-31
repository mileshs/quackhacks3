export type FinalWinner = "dummy" | "saboteur";

export type FinalStat = {
  label: string;
  value: string;
};

export const dummyFinalStats: FinalStat[] = [
  { label: "Time Survived", value: "2:14" },
  { label: "Poses Made", value: "30" },
  { label: "Powerups Used", value: "3" },
  { label: "Best Accuracy", value: "98%" }
];

export const saboteurFinalStats: FinalStat[] = [
  { label: "Poses Created", value: "30" },
  { label: "Poses Randomized", value: "8" },
  { label: "Powerups Used", value: "2" },
  { label: "Best Sabotage", value: "42% accuracy" }
];

export const finalResultCopy = {
  dummy: {
    eyebrow: "Dummy victory",
    title: "The Dummy Survived",
    description: "The dummy cleared every pose and made it to the end of the soundtrack."
  },
  saboteur: {
    eyebrow: "Saboteur victory",
    title: "The Saboteur Wins",
    description: "The dummy ran out of lives before the final wall."
  }
} satisfies Record<FinalWinner, { eyebrow: string; title: string; description: string }>;
