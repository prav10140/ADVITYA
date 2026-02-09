// src/gameConfig.js

export const GAME_DATABASE = {
  // --- HEART GAMES (Social & Emotional Pressure) ---
  "HEART_1": {
    title: "THE LAST STAND",
    location: "Zone A - Hall",
    description: "Decide: All 4 play with heavy restrictions, OR 2 members are removed so the others play freely. Fight internally.",
    difficulty: "★☆☆☆☆"
  },
  "HEART_2": {
    title: "THE BURDEN CARRIER",
    location: "Zone A - Room 102",
    description: "Choose ONE member to carry all penalties. If they fail 3 times, they are eliminated. Choose your leader wisely.",
    difficulty: "★★☆☆☆"
  },
  "HEART_3": {
    title: "THE SILENT VOTE",
    location: "Zone B - Room 201",
    description: "Vote to eliminate one member. No talking allowed. The person with the most votes is locked out. Ties result in handicaps.",
    difficulty: "★★★☆☆"
  },
  "HEART_4": {
    title: "TRUST THE OTHERS",
    location: "Zone B - Corridor",
    description: "Head-to-head with another team. Both Trust = Shuffle (+3 tokens). Betrayal = Tokens for one, penalty for other. Both Betray = -3 tokens.",
    difficulty: "★★★★☆"
  },
  "HEART_5": {
    title: "TRUST YOUR ONES",
    location: "Zone C - Lobby",
    description: "Select a member. They can choose to play SOLO (Betray) for 2x points or TEAM (Trust) for standard. If Solo loses, team gets -1.",
    difficulty: "★★★★★"
  },
  "HEART_6": {
    title: "TRADE A LIFE",
    location: "The Penthouse",
    description: "A team must give up one member (or their token) to save the rest. The traded member is banned for 2 phases.",
    difficulty: "☠☠☠☠☠"
  },

  // --- SPADE GAMES (Logic & Intelligence) ---
  "SPADE_1": {
    title: "CALCULATED PATH",
    location: "Zone D - Grid Room",
    description: "Guide a blindfolded member through a logic-locked path. Wrong move resets progress. Time limit active.",
    difficulty: "★☆☆☆☆"
  },
  "SPADE_2": {
    title: "THE 3 SWITCHES",
    location: "Zone D - Control Room",
    description: "3 switches, 1 door. Only one member touches switches. Others can ONLY say 'YES' or 'NO'. Wrong switch = Penalty.",
    difficulty: "★★☆☆☆"
  },
  "SPADE_3": {
    title: "BINARY BRIDGE",
    location: "Zone E - Walkway",
    description: "Cross the bridge by solving binary sequences. One wrong step and the floor drops.",
    difficulty: "★★★☆☆"
  },
  "SPADE_4": {
    title: "PATTERN MEMORY",
    location: "Zone E - Lab",
    description: "Memorize the sequence of flashing lights while loud noise plays. Replicate it perfectly.",
    difficulty: "★★★★☆"
  },
  "SPADE_5": {
    title: "WEIGHT BALANCE",
    location: "Zone F - Scales",
    description: "Use your own body weight to balance the scales against a mystery object. Physics applies.",
    difficulty: "★★★★★"
  },
  "SPADE_6": {
    title: "MASTERMIND",
    location: "The Arena",
    description: "Crack the manager's 4-digit code using logic clues before the room fills with smoke.",
    difficulty: "☠☠☠☠☠"
  }
};