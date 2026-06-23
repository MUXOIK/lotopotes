export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const BACKEND_URL = `${SUPABASE_URL}/functions/v1/loto-scraper`

export const GRILLES = [
  [7, 12, 23, 34, 45],
  [6, 15, 28, 39, 48],
  [3, 18, 31, 42, 49],
  [8, 19, 32, 41, 46],
  [5, 22, 29, 35, 44],
]
export const CHANCES = [9, 6, 4, 1, 7]

export const PARTICIPANTS = [
  'ANOUFA Fabienne & Moïse',
  'BELLALOU Martine & Patrick',
  'GRINAL Danielle & Serge',
  'HOCHBERG Nathalie & Bruno',
  'JURIS Virgine & Frédéric',
  'KIMAN Laurence & Didier',
  'LEVIN Gabrielle & Didier',
  'MESGUICH Corinne & Jean Philippe',
  'OIKNINE Muriel & Aaron',
  'PARTOUCHE Sylvie & Serge',
  'SITBON Leslie & OHAYON Gilles',
  'TEMAN Eva & FINKELSTEIN Philippe',
  'WEITZMANN Dalia & Jacques',
]

export const APP_PASSWORD = 'POTES'
export const ADMIN_PASSWORD = 'MILLION'
export const COTISATION_TOTALE = 2340
export const NB_PARTICIPANTS = 13
export const COTISATION_PAR_PERSONNE = 180
