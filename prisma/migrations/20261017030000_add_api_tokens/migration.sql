-- API token ส่วนตัวสำหรับ AI/เครื่องมือภายนอก (MCP server) — เก็บเฉพาะ SHA-256 ของ token
CREATE TABLE "api_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens"("user_id");

ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
