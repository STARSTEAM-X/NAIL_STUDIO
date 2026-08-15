-- Slice 6: durable grounding entries and bounded chat audit history.
CREATE TABLE "knowledge_entries" (
  "id" UUID NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "source_type" TEXT,
  "source_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_entries_question_check" CHECK (char_length("question") BETWEEN 1 AND 1000),
  CONSTRAINT "knowledge_entries_answer_check" CHECK (char_length("answer") BETWEEN 1 AND 8000)
);

CREATE TABLE "ai_chat_messages" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_chat_messages_role_check" CHECK ("role" IN ('user', 'assistant', 'system')),
  CONSTRAINT "ai_chat_messages_content_check" CHECK (char_length("content") BETWEEN 1 AND 8000)
);

CREATE INDEX "knowledge_entries_active_idx"
  ON "knowledge_entries"("is_active", "created_at" DESC);
CREATE INDEX "ai_chat_messages_session_idx"
  ON "ai_chat_messages"("session_id", "created_at" ASC);
