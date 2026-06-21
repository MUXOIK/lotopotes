/*
  Change virements unique constraint from (participant_nom) to (participant_nom, paiement_id)
  so each participant can have one virement per paiement.
*/
ALTER TABLE virements DROP CONSTRAINT IF EXISTS virements_participant_nom_unique;

ALTER TABLE virements ADD CONSTRAINT virements_participant_paiement_unique
  UNIQUE (participant_nom, paiement_id);
