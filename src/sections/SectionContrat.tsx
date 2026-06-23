import React from 'react'
import { PARTICIPANTS, NB_PARTICIPANTS, COTISATION_TOTALE, COTISATION_PAR_PERSONNE } from '../lib/constants'
import { Card } from '../components/ui'

export function SectionContrat() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-yellow-400">📜 CONTRAT DE SYNDICAT LOTO</h2>
        <h3 className="text-lg font-bold text-white mt-1">"LES POTES MILLIONNAIRES"</h3>
        <p className="text-gray-300 font-semibold text-sm">1ᵉʳ JUIN 2026 – 31 MAI 2027</p>
      </div>

      {([
        {
          title: 'ARTICLE 1 : OBJET DU SYNDICAT',
          content: (
            <p>Le présent contrat établit les règles du syndicat de jeu Loto français <strong>"LES POTES MILLIONNAIRES"</strong>. L'objectif est de partager les coûts et les gains potentiels de manière équitable entre les participants.</p>
          ),
        },
        {
          title: 'ARTICLE 2 : PARTICIPANTS',
          content: (
            <>
              <p className="mb-3">Les {NB_PARTICIPANTS} participants sont :</p>
              <div className="grid grid-cols-2 gap-1 bg-gray-700/50 rounded-lg p-3">
                {PARTICIPANTS.map((p) => (
                  <div key={p} className="text-sm py-1 border-b border-gray-600 last:border-0">{p}</div>
                ))}
              </div>
              <p className="mt-3 text-sm text-gray-400">Nombre fixe. Toute modification nécessite l'accord unanime des membres.</p>
            </>
          ),
        },
        {
          title: 'ARTICLE 3 : COTISATION ANNUELLE',
          content: (
            <div className="bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Cotisation par participant :</span><strong className="text-yellow-300">{COTISATION_PAR_PERSONNE},00€</strong></div>
              <div className="flex justify-between border-t border-gray-600 pt-2"><span>Montant total (1 an) :</span><strong className="text-yellow-300">{COTISATION_TOTALE.toLocaleString('fr-FR')},00€</strong></div>
            </div>
          ),
        },
        {
          title: 'ARTICLE 4 : ORGANISATION DES TIRAGES',
          content: (
            <div className="text-sm space-y-2">
              <p>🗓️ <strong>Fréquence :</strong> 3 tirages/semaine (lundi, mercredi, samedi) à 20h50 — soit 156 tirages/an.</p>
              <p>🎰 <strong>Grilles jouées :</strong> 5 combinaisons identiques rejouées à chaque tirage, avec les filtres :</p>
              <ul className="ml-5 list-disc space-y-1 text-gray-300">
                <li>Éliminer les numéros sortis sur les 10 dernières années</li>
                <li>Pas 3+ numéros consécutifs</li>
                <li>Équilibre pair/impair obligatoire</li>
              </ul>
            </div>
          ),
        },
        {
          title: 'ARTICLE 5 : COÛTS DE JEU',
          content: (
            <div className="bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>1er tirage : 2,20€ × 5 grilles</span><strong>= 11,00€</strong></div>
              <div className="flex justify-between"><span>2ème tirage : 0,80€ × 5 grilles</span><strong>= 4,00€</strong></div>
              <div className="flex justify-between border-t border-gray-600 pt-2"><span>Coût total / jour de tirage :</span><strong className="text-yellow-300">15,00€</strong></div>
              <div className="flex justify-between"><span>156 jours × 15,00€ :</span><strong className="text-yellow-300">2 340,00€</strong></div>
            </div>
          ),
        },
        {
          title: 'ARTICLE 6 : RÉPARTITION DES GAINS',
          content: (
            <p>Les gains sont partagés en parts égales entre les {NB_PARTICIPANTS} participants. Chaque participant reçoit <strong className="text-yellow-300">1/13 des gains nets</strong>.</p>
          ),
        },
        {
          title: 'ARTICLE 7 : ADMINISTRATEUR TRÉSORIER',
          content: (
            <>
              <p className="mb-2">Désigné : <strong className="text-yellow-300">MESGUICH Jean Philippe</strong></p>
              <ul className="text-sm space-y-1 list-disc ml-4 text-gray-300">
                <li>Jouer les 5 combinaisons à chaque tirage</li>
                <li>Gérer les fonds du syndicat</li>
                <li>Récupérer et distribuer les gains</li>
                <li>Tenir un registre transparent</li>
              </ul>
            </>
          ),
        },
        {
          title: 'ARTICLE 8 : PROPRIÉTÉ INTELLECTUELLE',
          content: (
            <>
              <p className="mb-2">Créatrice de l'application : <strong className="text-yellow-300">OIKNINE Muriel</strong></p>
              <ul className="text-sm space-y-1 list-disc ml-4 text-gray-300">
                <li>OIKNINE Muriel possède les droits exclusifs sur l'application</li>
                <li>Tout usage sans autorisation est interdit</li>
                <li>Les données restent confidentielles au syndicat</li>
              </ul>
            </>
          ),
        },
        {
          title: 'ARTICLE 9 : CONFIDENTIALITÉ',
          content: <p>Tous les participants s'engagent à respecter la confidentialité des combinaisons jouées, résultats et gains.</p>,
        },
        {
          title: 'ARTICLE 10 : RÉSILIATION',
          content: <p>Le syndicat prendra fin le <strong>30 juin 2027</strong>. Un renouvellement peut être engagé par accord unanime.</p>,
        },
        {
          title: 'ARTICLE 11 : SIGNATURES',
          content: (
            <div className="space-y-2">
              {PARTICIPANTS.map((p) => (
                <div key={p} className="bg-gray-700/50 rounded p-3 flex items-center justify-between text-sm">
                  <span>{p}</span>
                  <span className="text-gray-500 text-xs italic">Signature : ______________  Date : ________</span>
                </div>
              ))}
            </div>
          ),
        },
      ] as { title: string; content: React.ReactNode }[]).map(({ title, content }) => (
        <Card key={title}>
          <h4 className="text-yellow-300 font-bold mb-3 pb-2 border-b border-yellow-800">{title}</h4>
          <div className="text-gray-200 leading-relaxed text-sm">{content}</div>
        </Card>
      ))}
    </div>
  )
}
