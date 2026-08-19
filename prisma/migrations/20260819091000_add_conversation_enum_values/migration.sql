-- Keep enum additions separate from statements that consume the new values.
ALTER TYPE "content_report_target" ADD VALUE IF NOT EXISTS 'message';
ALTER TYPE "notification_kind" ADD VALUE IF NOT EXISTS 'direct_message';
