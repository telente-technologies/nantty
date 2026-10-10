-- one trial per phone number is replaced by one trial per verified email
DELETE FROM "trial_claims" WHERE "kind" = 'phone';
