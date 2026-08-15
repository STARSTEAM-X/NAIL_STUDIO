-- The composite primary key already enforces one like per (template, user).
-- Remove the duplicate unique index created by the initial community migration.
DROP INDEX IF EXISTS "template_likes_template_id_user_id_key";
