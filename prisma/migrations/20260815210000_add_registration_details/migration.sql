-- Add registration details used by the sign-up form.
ALTER TABLE "users"
  ADD COLUMN "date_of_birth" DATE,
  ADD COLUMN "terms_accepted_at" TIMESTAMPTZ;
