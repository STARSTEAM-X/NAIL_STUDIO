import { describe, expect, it } from 'vitest'
import { conversationMessageSchema } from './conversation.ts'

describe('conversation message contract', () => {
  it('rejects empty content', () => expect(conversationMessageSchema.safeParse({ content: '' }).success).toBe(false))
  it('accepts exactly 2000 characters', () => expect(conversationMessageSchema.safeParse({ content: 'x'.repeat(2000) }).success).toBe(true))
  it('rejects 2001 characters', () => expect(conversationMessageSchema.safeParse({ content: 'x'.repeat(2001) }).success).toBe(false))
})
