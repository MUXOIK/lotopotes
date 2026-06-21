import { getParticipants, getGrilles } from '../lib/db'
import { useEffect, useState } from 'react'
import type { Syndicat, SyndicParticipant, SyndicGrille } from '../lib/types'
import { Spinner, Card } from '../components/ui'
import { Boule } from '../components/Boule'

interface Props {
  syndicat: Syndicat
}

export function PageContrat({ syndicat }: Props) {
  const [participants, setParticipants] = useState<SyndicParticipant[]>([])
  const [grilles, setGrilles] = useState<SyndicGrille[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getParticipants(syndicat.id), getGrilles(syndicat.id)])
      .then(([p, g]) => { setParticipants(p); setGrilles(g) })
      .finally(() => setLoading(false))
  }, [syndicat.id])

  if (loading) return <Spinner />

  const dateDebut = new Date(syndicat.date_debut)
  const dateFin = new Date(dateDebut)
  dateFin.setMonth(dateFin.getMonth() + syndicat.nb_mois)

  const tiragesEstimes = Math.round(syndicat.nb_mois * 4.33 * 3)
  const coutParTirage = (syndicat.prix_tirage_1 + syndicat.prix_tirage_2) * syndicat.nb_grilles
  const coutTotal = coutParTirage * tiragesEstimes
  const cotisationParPersonne = participants.length > 0 ? (coutTotal / participants.length).toFixed(2) : '—'

  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-yellow-400">CONTRAT DE SYNDICAT LOTO</h2>
        <h3 className="text-lg font-bold text-white mt-1">"{syndicat.nom.toUpperCase()}"</h3>
        <p className="text-sm text-gray-400 mt-0.5">Code syndicat : <strong className="text-yellow-300">{syndicat.code}</strong></p>
        <p className="text-gray-300 font-semibold text-sm mt-1">
          {fmt(dateDebut)} – {fmt(dateFin)}
        </p>
      </div>

      {[
        {
          title: 'ARTICLE 1 : OBJET DU SYNDICAT',
          content: (
            <p>Le présent contrat établit les règles du syndicat de jeu Loto français <strong>"{syndicat.nom.toUpperCase()}"</strong> (code : <strong className="text-yellow-300">{syndicat.code}</strong>). L'objectif est de partager les coûts et gains potentiels de manière équitable entre les {participants.length} participants.</p>
          ),
        },
        {
          title: 'ARTICLE 2 : PARTICIPANTS',
          content: (
            <>
              <p className="mb-3">Les {participants.length} participants sont :</p>
              <div className="grid grid-cols-2 gap-1 bg-gray-700/50 rounded-lg p-3">
                {participants.map(p => (
                  <div key={p.id} className="text-sm py-1 border-b border-gray-600 last:border-0">{p.nom}</div>
                ))}
              </div>
              <p className="mt-3 text-sm text-gray-400">Nombre fixe pour toute la durée. Toute modification requiert l'accord unanime.</p>
            </>
          ),
        },
        {
          title: 'ARTICLE 3 : COTISATION',
          content: (
            <div className="bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Cotisation estimée / participant :</span><strong className="text-yellow-300">{cotisationParPersonne}€</strong></div>
              <div className="flex justify-between border-t border-gray-600 pt-2"><span>Budget total estimé :</span><strong className="text-yellow-300">{coutTotal.toFixed(2)}€</strong></div>
            </div>
          ),
        },
        {
          title: 'ARTICLE 4 : ORGANISATION DES TIRAGES',
          content: (
            <div className="text-sm space-y-2">
              <p>Fréquence : 3 tirages/semaine (lundi, mercredi, samedi) — soit ~{tiragesEstimes} tirages sur {syndicat.nb_mois} mois.</p>
              <p>Durée : du {fmt(dateDebut)} au {fmt(dateFin)}.</p>
            </div>
          ),
        },
        {
          title: 'ARTICLE 5 : GRILLES JOUÉES',
          content: (
            <div className="space-y-2">
              <p className="text-sm mb-2">Les {grilles.length} grille{grilles.length > 1 ? 's' : ''} suivantes sont rejouées à chaque tirage :</p>
              {grilles.map((g, i) => (
                <div key={g.id} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14">Grille {i + 1}</span>
                  <div className="flex gap-1 flex-wrap">
                    {g.numeros.map(n => <Boule key={n} num={n} variant="primary" size="sm" />)}
                    <Boule num={g.numero_chance} variant="chance" size="sm" />
                  </div>
                </div>
              ))}
            </div>
          ),
        },
        {
          title: 'ARTICLE 6 : COÛTS DE JEU',
          content: (
            <div className="bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>1er tirage : {syndicat.prix_tirage_1.toFixed(2)}€ × {syndicat.nb_grilles} grilles</span><strong>= {(syndicat.prix_tirage_1 * syndicat.nb_grilles).toFixed(2)}€</strong></div>
              <div className="flex justify-between"><span>2ème tirage : {syndicat.prix_tirage_2.toFixed(2)}€ × {syndicat.nb_grilles} grilles</span><strong>= {(syndicat.prix_tirage_2 * syndicat.nb_grilles).toFixed(2)}€</strong></div>
              <div className="flex justify-between border-t border-gray-600 pt-2"><span>Coût total / tirage :</span><strong className="text-yellow-300">{coutParTirage.toFixed(2)}€</strong></div>
              <div className="flex justify-between"><span>{tiragesEstimes} tirages × {coutParTirage.toFixed(2)}€ :</span><strong className="text-yellow-300">{coutTotal.toFixed(2)}€</strong></div>
            </div>
          ),
        },
        {
          title: 'ARTICLE 7 : RÉPARTITION DES GAINS',
          content: (
            <p>Les gains sont partagés en parts égales entre les {participants.length} participants. Chaque participant reçoit <strong className="text-yellow-300">1/{participants.length} des gains nets</strong>.</p>
          ),
        },
        {
          title: 'ARTICLE 8 : ADMINISTRATEUR TRÉSORIER',
          content: (
            <>
              <p className="mb-2">Désigné : <strong className="text-yellow-300">{syndicat.tresorier_nom}</strong></p>
              <ul className="text-sm space-y-1 list-disc ml-4 text-gray-300">
                <li>Jouer les {grilles.length} grille{grilles.length > 1 ? 's' : ''} à chaque tirage (abonnement FDJ)</li>
                <li>Gérer les fonds du syndicat</li>
                <li>Récupérer et distribuer les gains</li>
                <li>Tenir un registre transparent via l'application</li>
              </ul>
            </>
          ),
        },
        {
          title: 'ARTICLE 9 : RÉSILIATION',
          content: <p>Le syndicat prendra fin le <strong>{fmt(dateFin)}</strong>. Un renouvellement peut être engagé par accord unanime des membres.</p>,
        },
        {
          title: 'ARTICLE 10 : SIGNATURES',
          content: (
            <div className="space-y-2">
              {participants.map(p => (
                <div key={p.id} className="bg-gray-700/50 rounded p-3 flex items-center justify-between text-sm">
                  <span>{p.nom}</span>
                  <span className="text-gray-500 text-xs italic">Signature : ______________  Date : ________</span>
                </div>
              ))}
            </div>
          ),
        },
      ].map(({ title, content }) => (
        <Card key={title}>
          <h4 className="text-yellow-300 font-bold mb-3 pb-2 border-b border-yellow-800">{title}</h4>
          <div className="text-gray-200 leading-relaxed text-sm">{content}</div>
        </Card>
      ))}
    </div>
  )
}
