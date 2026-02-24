// src/gameConfig.js

export const GAME_DATABASE = {
  // --- HEARTS (SOCIAL / EMOTIONAL) ---
  "HEART_1": {
    title: "The Split Verdict",
    description: "Make a choice. Will you split it correctly?",
    location: "ZONE A",
    outcomes: [
      { label: "Correct Split (+4)", tokens: 4, score: 1 },
      { label: "Wrong Split (-4)", tokens: -4, score: 0 }
    ]
  },
  "HEART_2": {
    title: "Marbles: Odd or Even",
    description: "Guess correctly. Your partner's fate is tied to yours.",
    location: "ZONE A",
    outcomes: [
      { label: "Both Pairs Succeed (+4)", tokens: 4, score: 1 },
      { label: "Any Failure (-5)", tokens: -5, score: 0 }
    ]
  },
  "HEART_3": {
    title: "Trust the Others",
    description: "Classic Prisoner's Dilemma. Do you trust them?",
    location: "ZONE A",
    outcomes: [
      { label: "Both Trust (+3)", tokens: 3, score: 1 },
      { label: "Both Betray (-3)", tokens: -3, score: 0 },
      { label: "You Betrayed (+2)", tokens: 2, score: 1 },
      { label: "You Were Betrayed (-1)", tokens: -1, score: 0 }
    ]
  },
  "HEART_4": {
    title: "Trust Your Ones",
    description: "Play solo or with a team.",
    location: "ZONE B",
    outcomes: [
      { label: "Solo Win (+5)", tokens: 5, score: 1 },
      { label: "Team Win (+8)", tokens: 8, score: 1 }, // Assuming 3x approx
      { label: "Loss (-1)", tokens: -1, score: 0 }
    ]
  },
  "HEART_5": {
    title: "One Must Fall",
    description: "A sacrifice is required.",
    location: "ZONE B",
    outcomes: [
      { label: "Survived (+5)", tokens: 5, score: 1 },
      { label: "Fell (-5)", tokens: -5, score: 0 }
    ]
  },
  "HEART_6": {
    title: "The Crowned Betrayal",
    description: "Predict the exact betrayal.",
    location: "VIP ZONE",
    outcomes: [
      { label: "Correct Prediction (+5)", tokens: 5, score: 1 },
      { label: "Wrong Prediction (-4)", tokens: -4, score: 0 }
    ]
  },

  // --- SPADES (LOGIC / INTELLECT) ---
  "SPADE_1": {
    title: "Memory Grid",
    description: "Memorize the flashing sequence.",
    location: "ZONE C",
    outcomes: [
      { label: "80%+ Correct (+4)", tokens: 4, score: 1 },
      { label: "50-79% Correct (+2)", tokens: 2, score: 1 },
      { label: "Below 50% (-1)", tokens: -1, score: 0 }
    ]
  },
  "SPADE_2": {
    title: "The False Pattern",
    description: "Find the anomaly in the sequence.",
    location: "ZONE C",
    outcomes: [
      { label: "Identify Flaw (+2)", tokens: 2, score: 1 },
      { label: "Wrong Pattern (-2)", tokens: -2, score: 0 },
      { label: "No Answer (-1)", tokens: -1, score: 0 }
    ]
  },
  "SPADE_3": {
    title: "Tower Construction",
    description: "Build the structure before time runs out.",
    location: "ZONE D",
    outcomes: [
      { label: "Success (+5)", tokens: 5, score: 1 },
      { label: "Failure (0)", tokens: 0, score: 0 }
    ]
  },
  "SPADE_4": {
    title: "Blindfold Maze",
    description: "Navigate without your sight.",
    location: "ZONE D",
    outcomes: [
      { label: "Success (+3)", tokens: 3, score: 1 },
      { label: "Failure (-2)", tokens: -2, score: 0 }
    ]
  },
  "SPADE_5": {
    title: "Token Roulette",
    description: "Wager your tokens on a logic puzzle.",
    location: "ZONE E",
    outcomes: [
      { label: "Won Wager (Custom)", isWager: true, win: true, score: 1 },
      { label: "Lost Wager (Custom)", isWager: true, win: false, score: 0 }
    ]
  },
  "SPADE_6": {
    title: "The Rule Switch",
    description: "Adapt to changing paradigms.",
    location: "VIP ZONE",
    outcomes: [
      { label: "Success (+6)", tokens: 6, score: 1 },
      { label: "Violation (-6)", tokens: -6, score: 0 }
    ]
  }
};