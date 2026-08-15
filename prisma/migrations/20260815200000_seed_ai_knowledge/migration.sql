INSERT INTO "knowledge_entries" ("id", "question", "answer", "source_type")
VALUES
  ('00000000-0000-0000-0000-000000000001', 'How do I undo an editor change?', 'Use Ctrl+Z or the Undo control. AI changes are applied through the same HistoryStack as manual edits.', 'product_help'),
  ('00000000-0000-0000-0000-000000000002', 'How are appointment times agreed?', 'A customer sends a proposed time. The shop can accept or counter-offer, and both sides can keep a proposal history until one proposal is accepted.', 'product_help'),
  ('00000000-0000-0000-0000-000000000003', 'Can I review a shop before the appointment is complete?', 'No. Reviews are available only after the appointment is marked completed, and each appointment can receive one review.', 'product_help')
ON CONFLICT ("id") DO NOTHING;
