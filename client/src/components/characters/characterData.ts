import type { Category } from '../../../../shared/src/index';

export interface CharacterProfile {
  category: Category;
  name: string;
  title: string;
  tagline: string;
  bio: string;
  color: string;
  accentColor: string;
  glowColor: string;
  bgGradient: string;
  symbol: string;
  quotes: {
    greeting: string;
    thinking: string;
    correct: string;
    incorrect: string;
    claim: string;
    defend: string;
  };
}

export const CHARACTER_PROFILES: Record<Category, CharacterProfile> = {
  MEMES: { category: 'MEMES', name: 'Mimi', title: 'The Meme Queen', tagline: 'Every answer deserves a reaction.', bio: 'A quick-witted reaction bubble who lives for internet lore and a perfectly timed joke.', color: '#8B5CF6', accentColor: '#8B5CF6', glowColor: '#8B5CF6', bgGradient: 'from-slate-800 to-slate-950', symbol: 'M', quotes: { greeting: 'Every answer deserves a reaction.', thinking: 'Think it through!', correct: 'Great answer!', incorrect: 'Try again!', claim: 'Go for the crown!', defend: 'Challenge accepted!' } },
  CUSTOM: { category: 'CUSTOM', name: 'Remix', title: 'The Collaborator', tagline: 'Great questions are better together.', bio: 'A welcoming puzzle piece who brings the community together, one player-created question at a time.', color: '#14B8A6', accentColor: '#14B8A6', glowColor: '#14B8A6', bgGradient: 'from-slate-800 to-slate-950', symbol: 'R', quotes: { greeting: 'Great questions are better together.', thinking: 'Think it through!', correct: 'Great answer!', incorrect: 'Try again!', claim: 'Go for the crown!', defend: 'Challenge accepted!' } },
  MOVIES_TV: { category: 'MOVIES_TV', name: 'Reel', title: 'The Screen Buff', tagline: 'Every great story deserves an encore.', bio: 'A charismatic retro television with a love of plot twists, iconic scenes, and behind-the-scenes trivia.', color: '#6366F1', accentColor: '#6366F1', glowColor: '#6366F1', bgGradient: 'from-slate-800 to-slate-950', symbol: 'R', quotes: { greeting: 'Every great story deserves an encore.', thinking: 'Think it through!', correct: 'Great answer!', incorrect: 'Try again!', claim: 'Go for the crown!', defend: 'Challenge accepted!' } },
  VIDEO_GAMES: { category: 'VIDEO_GAMES', name: 'Pixel', title: 'The Player One', tagline: 'Ready for the next level?', bio: 'An energetic game controller who celebrates every clever play, hidden secret, and hard-earned victory.', color: '#06B6D4', accentColor: '#06B6D4', glowColor: '#06B6D4', bgGradient: 'from-slate-800 to-slate-950', symbol: 'P', quotes: { greeting: 'Ready for the next level?', thinking: 'Think it through!', correct: 'Great answer!', incorrect: 'Try again!', claim: 'Go for the crown!', defend: 'Challenge accepted!' } },
  ART: {
    category: 'ART',
    name: 'Arthur',
    title: 'The Connoisseur',
    tagline: 'Every masterpiece begins with a single bold stroke.',
    bio: 'Curator of world-renowned galleries and master of classical canvases. He never paints inside the lines.',
    color: '#EF4444',
    accentColor: '#DC2626',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    bgGradient: 'from-rose-500/20 via-red-950/40 to-slate-950',
    symbol: '🎨',
    quotes: {
      greeting: "Ah, welcome to my atelier! Let us see if your mind has taste.",
      thinking: "Contemplating the brushwork of history…",
      correct: "Magnifique! A true stroke of genius!",
      incorrect: "Alas, not quite Renaissance caliber. Back to the sketchbook.",
      claim: "Claim my Art Crown? Only if your aesthetic intellect is worthy!",
      defend: "You dare challenge my masterpiece? En garde!"
    }
  },
  SCIENCE: {
    category: 'SCIENCE',
    name: 'Albert',
    title: 'The Professor',
    tagline: 'Energy cannot be created or destroyed, only questioned.',
    bio: 'Quantum pioneer with electrifying theories and an insatiable curiosity for the cosmos and atomic secrets.',
    color: '#10B981',
    accentColor: '#059669',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    bgGradient: 'from-emerald-500/20 via-teal-950/40 to-slate-950',
    symbol: '🔬',
    quotes: {
      greeting: "Goggles on! The laws of physics await your hypothesis.",
      thinking: "Calculating probabilities and atomic resonances…",
      correct: "Eureka! The data confirms your brilliance!",
      incorrect: "Hypothesis disproven. Time to re-calibrate the spectrometer.",
      claim: "My Science Crown runs on pure fusion power. Step up!",
      defend: "My defensive field is mathematically impenetrable!"
    }
  },
  SPORTS: {
    category: 'SPORTS',
    name: 'Bonzo',
    title: 'The Champion',
    tagline: 'Champions train, legends persevere, winners score.',
    bio: 'Multi-sport all-star who plays with unstoppable heart, lightning reflexes, and a golden smile for the podium.',
    color: '#F97316',
    accentColor: '#EA580C',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    bgGradient: 'from-orange-500/20 via-amber-950/40 to-slate-950',
    symbol: '🏆',
    quotes: {
      greeting: "Lace up your sneakers! It's game time on the trivia court!",
      thinking: "Reviewing the playbook at halftime…",
      correct: "GOAAAL! Swish! That's a buzzer-beating strike!",
      incorrect: "Fumble! Out of bounds! Dust yourself off and hustle back.",
      claim: "You want the Champion's Trophy? Bring your A-game!",
      defend: "Nobody takes my crown without going into overtime!"
    }
  },
  ENTERTAINMENT: {
    category: 'ENTERTAINMENT',
    name: 'Pop',
    title: 'The Star',
    tagline: 'Lights, camera, question! The spotlight is waiting.',
    bio: 'Silver-screen icon, pop diva, and festival headliner who knows every billboard hit, oscar winner, and meme.',
    color: '#EC4899',
    accentColor: '#DB2777',
    glowColor: 'rgba(236, 72, 153, 0.4)',
    bgGradient: 'from-pink-500/20 via-fuchsia-950/40 to-slate-950',
    symbol: '🎬',
    quotes: {
      greeting: "Hello, darling! Welcome to the VIP red carpet!",
      thinking: "Checking the credits and soundtrack cues…",
      correct: "Standing ovation! You belong in the Hollywood Walk of Fame!",
      incorrect: "Cut! That's a wrap on that take. Check the script, babe.",
      claim: "Ready to walk off with my Star Crown? Show me star power!",
      defend: "The limelight belongs to me! Hit the music!"
    }
  },
  GEOGRAPHY: {
    category: 'GEOGRAPHY',
    name: 'Tina',
    title: 'The Explorer',
    tagline: 'The world is a book, and those who do not travel read only one page.',
    bio: 'Fearless cartographer who crossed the seven continents, mapped uncharted peaks, and navigated by the stars.',
    color: '#3B82F6',
    accentColor: '#2563EB',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    bgGradient: 'from-blue-500/20 via-indigo-950/40 to-slate-950',
    symbol: '🌍',
    quotes: {
      greeting: "Unfurl the map! Our expedition across the globe begins now.",
      thinking: "Aligning the compass with true north…",
      correct: "Land ho! You navigated those coordinates like a master!",
      incorrect: "Lost in the Bermuda Triangle! Let's check our compass bearings.",
      claim: "My Explorer Crown rests on the highest peak. Can you climb it?",
      defend: "My expedition will defend this territory to the ends of the earth!"
    }
  },
  HISTORY: {
    category: 'HISTORY',
    name: 'Hector',
    title: 'The Historian',
    tagline: 'Those who master history hold the keys to all tomorrow.',
    bio: 'Ancient scholar and archivist of dynasties, imperial triumphs, lost civilizations, and philosophical debates.',
    color: '#EAB308',
    accentColor: '#CA8A04',
    glowColor: 'rgba(234, 179, 8, 0.4)',
    bgGradient: 'from-yellow-500/20 via-amber-950/40 to-slate-950',
    symbol: '⏳',
    quotes: {
      greeting: "Hark! The annals of time open their parchment for you.",
      thinking: "Consulting ancient scrolls and royal decrees…",
      correct: "A triumph worthy of an imperial triumph march!",
      incorrect: "Et tu? Into the archives of historical errors you go.",
      claim: "The Imperial Crown of Ages! Will your name be etched in gold?",
      defend: "An empire built on centuries does not fall so easily!"
    }
  }
};
