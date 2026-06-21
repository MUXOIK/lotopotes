import { supabase } from './supabase'
import type {
  Syndicat, SyndicParticipant, SyndicGrille,
  SyndicPaiement, SyndicVirement, OnboardingData
} from './types'

function shortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'LP-'
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function createSyndicat(data: OnboardingData): Promise<Syndicat> {
  let code = shortCode()
  // Ensure uniqueness
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase.from('syndicats').select('id').eq('code', code).maybeSingle()
    if (!existing) break
    code = shortCode()
  }

  const { data: syndicat, error } = await supabase
    .from('syndicats')
    .insert({
      code,
      nom: data.nom,
      tresorier_nom: data.tresorier_nom,
      nb_mois: data.nb_mois,
      date_debut: data.date_debut,
      prix_tirage_1: data.prix_tirage_1,
      prix_tirage_2: data.prix_tirage_2,
      nb_grilles: data.grilles.length,
      admin_password: data.tresorier_nom.toUpperCase().split(' ')[0],
    })
    .select()
    .single()

  if (error || !syndicat) throw new Error(error?.message ?? 'Erreur création syndicat')

  // Insert participants
  if (data.participants.length > 0) {
    await supabase.from('syndic_participants').insert(
      data.participants.map((nom, ordre) => ({ syndicat_id: syndicat.id, nom, ordre }))
    )
  }

  // Insert grilles
  if (data.grilles.length > 0) {
    await supabase.from('syndic_grilles').insert(
      data.grilles.map((g, ordre) => ({
        syndicat_id: syndicat.id,
        numeros: g.numeros,
        numero_chance: g.numero_chance,
        ordre,
      }))
    )
  }

  return syndicat as Syndicat
}

export async function getSyndicatByCode(code: string): Promise<Syndicat | null> {
  const { data } = await supabase
    .from('syndicats')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle()
  return data as Syndicat | null
}

export async function getSyndicatById(id: string): Promise<Syndicat | null> {
  const { data } = await supabase.from('syndicats').select('*').eq('id', id).maybeSingle()
  return data as Syndicat | null
}

export async function getParticipants(syndicatId: string): Promise<SyndicParticipant[]> {
  const { data } = await supabase
    .from('syndic_participants')
    .select('*')
    .eq('syndicat_id', syndicatId)
    .order('ordre')
  return (data ?? []) as SyndicParticipant[]
}

export async function getGrilles(syndicatId: string): Promise<SyndicGrille[]> {
  const { data } = await supabase
    .from('syndic_grilles')
    .select('*')
    .eq('syndicat_id', syndicatId)
    .order('ordre')
  return (data ?? []) as SyndicGrille[]
}

export async function getPaiements(syndicatId: string): Promise<SyndicPaiement[]> {
  const { data } = await supabase
    .from('syndic_paiements')
    .select('*')
    .eq('syndicat_id', syndicatId)
    .order('created_at', { ascending: false })
  return (data ?? []) as SyndicPaiement[]
}

export async function getVirements(syndicatId: string): Promise<SyndicVirement[]> {
  const { data } = await supabase
    .from('syndic_virements')
    .select('*')
    .eq('syndicat_id', syndicatId)
    .order('created_at', { ascending: false })
  return (data ?? []) as SyndicVirement[]
}

export async function createPaiement(
  syndicatId: string,
  montant: number,
  participants: SyndicParticipant[],
  note: string
): Promise<void> {
  const montant_par_personne = participants.length > 0
    ? Math.round((montant / participants.length) * 100) / 100
    : montant

  const { data: paiement, error } = await supabase
    .from('syndic_paiements')
    .insert({ syndicat_id: syndicatId, montant, montant_par_personne, note })
    .select()
    .single()

  if (error || !paiement) throw new Error(error?.message ?? 'Erreur création paiement')

  await supabase.from('syndic_virements').insert(
    participants.map(p => ({
      syndicat_id: syndicatId,
      participant_nom: p.nom,
      effectue: false,
      paiement_id: paiement.id,
    }))
  )
}

export async function toggleVirement(id: string, effectue: boolean): Promise<void> {
  await supabase
    .from('syndic_virements')
    .update({ effectue, date_virement: effectue ? new Date().toISOString().split('T')[0] : null })
    .eq('id', id)
}
