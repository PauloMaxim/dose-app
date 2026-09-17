export type StudyType =
  | "RCT"
  | "Meta-análise"
  | "Guideline"
  | "Review"
  | "Coorte";

export type EvidenceLevel = "1A" | "1B" | "2A" | "2B" | "3";

export type Specialty =
  | "Cardiologia"
  | "Endocrinologia"
  | "Nefrologia"
  | "Infectologia"
  | "Pneumologia"
  | "Hepatologia"
  | "Medicina Interna"
  | "Medicina Intensiva"
  | "Geriatria"
  | "Neurologia";

export type Confidence = "alta" | "média" | "baixa";
export type TitlePrefix = "Dr." | "Dra.";

export type ClothesId =
  | "none"
  | "bowtie"
  | "stethoscope"
  | "coat"
  | "scrubs"
  | "hoodie"
  | "vest"
  | "scarf"
  | "gala";

export type HatId =
  | "none"
  | "glasses"
  | "scrubcap"
  | "beanie"
  | "bow"
  | "headmirror"
  | "crown"
  | "halo";

export type ShoesId =
  | "none"
  | "sneakers"
  | "clogs"
  | "loafers"
  | "boots"
  | "socks"
  | "gold"
  | "wings";

export type WardrobeSlot = "clothes" | "hat" | "shoes";

export interface MascotLook {
  clothes: ClothesId
  hat: HatId
  shoes: ShoesId
}

export interface Article {
  id: string
  title: string
  subtitle: string
  studyType: StudyType
  evidenceLevel: EvidenceLevel
  specialty: Specialty
  journal: string
  year: number
  publishedAt: string
  minutes: number
  cover: string
  sourceUrl: string
  sourceLabel: string
  pmid?: string
  confidence: Confidence
  learned: string
  tldr: string
  study: string
  results: string
  limitations: string
  practice: string
  synopsis: string
}

export interface Edition {
  id: string
  daysAgo: number
  number: number
  title: string
  kicker: string
  cover: string
  articleIds: string[]
  learned: string
}

export interface ReadingProgress {
  articleId: string
  scrollPct: number
  completed: boolean
  completedAt?: string
  minutesRead: number
}

export interface DayLog {
  date: string
  minutes: number
  articlesCompleted: string[]
  goalMet: boolean
}

export interface Insight {
  id: string
  articleId: string
  text: string
  createdAt: string
}

export interface Collection {
  id: string
  name: string
}

export interface SavedItem {
  articleId: string
  savedAt: string
  liked: boolean
  collectionIds: string[]
}

export type ThemeMode = "dark" | "light"
export type AppLocale = "pt" | "en"
export type PlanId = "free" | "weekly" | "monthly" | "yearly"

export interface PublicComment {
  id: string
  articleId: string
  author: string
  username?: string
  titlePrefix: TitlePrefix
  specialty: string
  text: string
  rating: number
  createdAt: string
  mine?: boolean
}

export interface Profile {
  name: string
  username: string
  avatar: string | null
  title: TitlePrefix
  specialty: Specialty
  topics: string[]
  dailyGoalMin: number
  weeklyGoalMin: number
  look: MascotLook
  onboardingComplete: boolean
  tutorialComplete: boolean
  reminderHour: number | null
  reminderMinute: number
  theme: ThemeMode
  soundOn: boolean
  locale: AppLocale
  plan: PlanId
  planScreenSeen: boolean
}
