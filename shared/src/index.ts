export type Category = 'ART' | 'SCIENCE' | 'SPORTS' | 'ENTERTAINMENT' | 'GEOGRAPHY' | 'HISTORY';

export type WheelSlice = Category | 'CROWN';

export const WHEEL_SPIN_DURATION_MS = 6400;
export const SPIN_RESULT_HOLD_MS = 900;
export const QUESTION_DURATION_MS = 20000;
export const QUESTION_ANSWER_GRACE_MS = 2000;

export interface CategoryInfo {
  id: Category;
  name: string;
  characterName: string;
  characterTitle: string;
  color: string;
  accentColor: string;
  textColor: string;
  iconName: string;
  description: string;
}

export const CATEGORIES: Record<Category, CategoryInfo> = {
  ART: {
    id: 'ART',
    name: 'Art & Literature',
    characterName: 'Arthur',
    characterTitle: 'The Connoisseur',
    color: '#EF4444',
    accentColor: '#DC2626',
    textColor: '#FFFFFF',
    iconName: 'Palette',
    description: 'Masterpieces, famous literature, architecture, and paintings'
  },
  SCIENCE: {
    id: 'SCIENCE',
    name: 'Science & Nature',
    characterName: 'Albert',
    characterTitle: 'The Professor',
    color: '#10B981',
    accentColor: '#059669',
    textColor: '#FFFFFF',
    iconName: 'Atom',
    description: 'Physics, biology, space, technology, and natural wonders'
  },
  SPORTS: {
    id: 'SPORTS',
    name: 'Sports & Games',
    characterName: 'Bonzo',
    characterTitle: 'The Champion',
    color: '#F97316',
    accentColor: '#EA580C',
    textColor: '#FFFFFF',
    iconName: 'Trophy',
    description: 'Athletics, world records, tournaments, and legendary players'
  },
  ENTERTAINMENT: {
    id: 'ENTERTAINMENT',
    name: 'Entertainment',
    characterName: 'Pop',
    characterTitle: 'The Star',
    color: '#EC4899',
    accentColor: '#DB2777',
    textColor: '#FFFFFF',
    iconName: 'Film',
    description: 'Cinema, music hits, television shows, and pop culture'
  },
  GEOGRAPHY: {
    id: 'GEOGRAPHY',
    name: 'Geography & Travel',
    characterName: 'Tina',
    characterTitle: 'The Explorer',
    color: '#3B82F6',
    accentColor: '#2563EB',
    textColor: '#FFFFFF',
    iconName: 'Globe',
    description: 'Capitals, flags, landmarks, continents, and terrains'
  },
  HISTORY: {
    id: 'HISTORY',
    name: 'World History',
    characterName: 'Hector',
    characterTitle: 'The Historian',
    color: '#EAB308',
    accentColor: '#CA8A04',
    textColor: '#FFFFFF',
    iconName: 'Hourglass',
    description: 'Ancient empires, world wars, leaders, and historic milestones'
  }
};

export const WHEEL_SLICES: WheelSlice[] = [
  'GEOGRAPHY',
  'SCIENCE',
  'HISTORY',
  'SPORTS',
  'ART',
  'ENTERTAINMENT',
  'CROWN'
];

export type GameStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';

export type GameMode =
  | 'SPIN'          // Active player needs to spin wheel
  | 'SPINNING'      // Wheel is spinning
  | 'QUESTION'      // Question active, 20s timer running
  | 'CROWN_CHOICE'  // Active player chooses Claim or Steal
  | 'RESULT'        // Brief answer result display before next step
  | 'GAME_OVER';    // Game concluded

export interface PlayerState {
  id: string;
  username: string;
  crowns: Category[];
  crownGauge: number; // 0 to 3 points
  isConnected: boolean;
  score: number; // total correct answers
}

export interface ActiveQuestionSync {
  id: string;
  category: Category;
  question: string;
  imageUrl?: string;
  options: string[]; // 4 shuffled options
  durationMs: number;
  startedAt: number;
  isCrown: boolean;
  crownCategory?: Category;
  isSteal?: boolean;
  targetPlayerId?: string;
  wagerCategory?: Category;
}

export interface QuestionResult {
  wasCorrect: boolean;
  correctIndex: number;
  correctAnswer: string;
  selectedOption?: string;
  question?: ActiveQuestionSync;
  awardedCrown?: Category;
  stolenCrown?: Category;
  lostCrown?: Category;
  nextPlayerId: string;
  turnContinued: boolean;
}

export interface GameStateSync {
  id: string;
  revision: number;
  status: GameStatus;
  players: {
    p1: PlayerState;
    p2: PlayerState | null;
  };
  currentTurnPlayerId: string;
  roundNumber: number;
  maxRounds: number;
  mode: GameMode;
  activeQuestion?: ActiveQuestionSync;
  lastSpin?: {
    id: string;
    targetDegrees: number;
    slice: WheelSlice;
  };
  lastResult?: QuestionResult;
  winnerId?: string;
  winReason?: string;
  updatedAt: number;
}

export interface QuestionData {
  id: string;
  packId: string;
  category: Category;
  question: string;
  imageUrl?: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuestionPackExport {
  id?: string;
  title: string;
  description?: string;
  questions: Array<{
    category: Category;
    question: string;
    imageUrl?: string;
    correctAnswer: string;
    incorrectAnswers: string[];
    difficulty?: 'easy' | 'medium' | 'hard';
  }>;
}

export interface QuestionPackMeta {
  id: string;
  title: string;
  description: string;
  isDefault: boolean;
  questionCount: number;
  createdBy?: string;
  createdAt: number;
}

export interface ExpandPackRequest {
  countPerCategory?: number;
  categories?: Category[];
  forceRefresh?: boolean;
}

export interface ExpandPackResponse {
  packId: string;
  added: number;
  totalInPack: number;
  byCategory: Record<Category, number>;
  providersUsed: string[];
}

export interface FetchQuestionsResponse {
  questions: QuestionData[];
  provider: string;
  cached?: boolean;
}
// Request / Response payloads
export interface AuthCredentials {
  email?: string;
  password?: string;
  username?: string;
  pin?: string;
}

export type LoginRequest = AuthCredentials;

export interface RegisterRequest {
  username: string;
  pin?: string;
  email?: string;
  password?: string;
}

export interface DirectoryPlayer {
  id: string;
  username: string;
  hasPin: boolean;
}

export interface DirectoryResponse {
  players: DirectoryPlayer[];
}

export interface AuthResponse {
  account: AccountSummary;
  token: string;
}

export interface AccountSummary {
  id: string;
  username: string;
}

export type PlayerSummary = AccountSummary;

export interface InvitationSummary {
  id: string;
  sender: AccountSummary;
  recipient: AccountSummary;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: number;
  gameId: string | null;
}

export interface SendInvitationRequest {
  recipientId: string;
  packIds?: string[];
}

export interface RespondInvitationRequest {
  decision: 'accept' | 'decline';
}

export interface MatchSummary {
  gameId: string;
  opponent: AccountSummary;
  status: GameStatus;
  currentTurn: AccountSummary;
  updatedAt: number;
}

export interface GameListResponse {
  matches: MatchSummary[];
}

export interface SpinResponse {
  sliceIndex: number;
  slice: WheelSlice;
  targetDegrees: number;
  state: GameStateSync;
}

export interface AnswerQuestionRequest {
  questionId: string;
  answerIndex: number;
  timeSpentMs: number;
}

export interface CrownChoiceRequest {
  action: 'claim' | 'steal';
  category: Category;
  wagerCategory?: Category;
}

export interface PushSubscriptionRequest {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushConfigResponse {
  available: boolean;
  publicKey: string | null;
}

export interface PushNotificationPayload {
  accountId: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  badgeCount: number;
}


export interface PushTestResponse {
  outcome: 'accepted' | 'retrying' | 'rejected' | 'queued' | 'unsubscribed';
}
/** Visible match tabs renew a 30-second lease every 10 seconds. */
export interface MatchPresenceRequest { connectionId: string; active: boolean }
export interface MatchPresenceResponse {
  gameId: string;
  players: Record<string, 'live' | 'offline'>;
  expiresInMs: number;
}

/** SSE control: normal rotation needs no REST read; expired/conflicting state does. */
export interface GameReconnectEvent { refresh: boolean }
