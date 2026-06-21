// Types for the generic multi-syndicat LotoPotes app

export interface Syndicat {
  id: string
  code: string
  nom: string
  tresorier_nom: string
  nb_mois: number
  date_debut: string
  prix_tirage_1: number
  prix_tirage_2: number
  nb_grilles: number
  admin_password: string
  created_at: string
}

export interface SyndicParticipant {
  id: string
  syndicat_id: string
  nom: string
  ordre: number
  created_at: string
}

export interface SyndicGrille {
  id: string
  syndicat_id: string
  numeros: number[]
  numero_chance: number
  ordre: number
  created_at: string
}

export interface SyndicPaiement {
  id: string
  syndicat_id: string
  montant: number
  montant_par_personne: number
  note: string
  created_at: string
}

export interface SyndicVirement {
  id: string
  syndicat_id: string
  participant_nom: string
  effectue: boolean
  date_virement: string | null
  paiement_id: string | null
  created_at: string
}

// Derived from FDJ scrape
export interface RapportGains {
  '5+1': number
  '5': number
  '4+1': number
  '4': number
  '3+1': number
  '3': number
  '2+1': number
  '2': number
  '1+1': number
}

export interface RapportGains2 {
  '5': number
  '4': number
  '3': number
  '2': number
}

export interface GainDetail {
  grille: number
  tirage: '1er' | '2nd'
  gain: number
}

export interface Tirage {
  nums: number[]
  chance: number
  nums2: number[]
  date: string
  gains?: number
  rapportGains: RapportGains
  rapportGains2: RapportGains2
  gainTotal?: number
  gainsDetails?: GainDetail[]
}

export interface ParticipantDistribution {
  gains: number
  solde: number
}

export interface ApiLotoComplet {
  success: boolean
  tirage: Tirage | null
  historique: Tirage[]
  distribution: Record<string, ParticipantDistribution>
  cagnotte: number
  error?: string
}

// Onboarding form state
export interface OnboardingData {
  nom: string
  tresorier_nom: string
  nb_mois: number
  date_debut: string
  prix_tirage_1: number
  prix_tirage_2: number
  participants: string[]
  grilles: Array<{ numeros: number[]; numero_chance: number }>
}

export type Page =
  | 'home'
  | 'onboarding'
  | 'dashboard'
  | 'bilan'
  | 'historique'
  | 'paiements'
  | 'probabilites'
  | 'contrat'
  | 'admin'
