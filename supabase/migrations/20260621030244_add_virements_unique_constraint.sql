/*
# Ajouter contrainte unique sur virements.participant_nom

Nécessaire pour que l'upsert onConflict('participant_nom') fonctionne correctement.
*/

ALTER TABLE virements ADD CONSTRAINT virements_participant_nom_unique UNIQUE (participant_nom);
