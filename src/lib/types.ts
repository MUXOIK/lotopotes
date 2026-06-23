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

export interface ApiBilan {
  success: boolean
  gainsTotal: number
  tiragesEffectues: number
  distribution: Record<string, ParticipantDistribution>
  cagnotte: number
}

export interface ApiStats {
  success: boolean
  historique: Tirage[]
  distribution: Record<string, ParticipantDistribution>
  cagnotte: number
}

export interface ApiTest {
  ok: boolean
  allGains: number
  cagnotte: string
  GITHUB_TOKEN: string
  cache?: {
    valide: boolean
    expire?: string
    tirage?: number[]
  }
  timestamp?: string
}

export interface Paiement {
  id: string
  montant: number
  montant_par_personne: number
  note: string
  created_at: string
}

export interface Virement {
  id: string
  participant_nom: string
  effectue: boolean
  date_virement: string | null
  paiement_id: string | null
  created_at: string
}

export type Section =
  | 'accueil'
  | 'bilan'
  | 'historique'
  | 'paiements'
  | 'probabilites'
  | 'contrat'
  | 'admin'
