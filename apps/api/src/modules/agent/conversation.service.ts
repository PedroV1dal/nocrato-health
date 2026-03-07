import { Inject, Injectable } from '@nestjs/common'
import type { Knex } from 'knex'
import { KNEX } from '@/database/knex.provider'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string // para tool results
  name?: string // para tool results
  timestamp: string // ISO 8601
}

export interface Conversation {
  id: string
  tenantId: string
  phone: string
  messages: ConversationMessage[]
  lastMessageAt: Date
  createdAt: Date
  updatedAt: Date
}

// Máximo de mensagens mantidas no histórico JSONB
const MAX_HISTORY_MESSAGES = 20

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ConversationService {
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  /**
   * Busca a conversa existente ou cria uma nova para o par (tenantId, phone).
   * Usa INSERT … ON CONFLICT DO UPDATE para garantir atomicidade.
   */
  async getOrCreate(tenantId: string, phone: string): Promise<Conversation> {
    const [row] = await this.knex.raw<{ rows: ConversationRow[] }>(
      `
      INSERT INTO conversations (tenant_id, phone, messages, last_message_at, created_at, updated_at)
      VALUES (:tenantId, :phone, '[]'::jsonb, now(), now(), now())
      ON CONFLICT (tenant_id, phone)
      DO UPDATE SET updated_at = now()
      RETURNING *
      `,
      { tenantId, phone },
    ).then((result) => result.rows)

    return mapRow(row)
  }

  /**
   * Adiciona novas mensagens ao histórico da conversa.
   * Mantém no máximo MAX_HISTORY_MESSAGES mensagens (as mais recentes).
   */
  async appendMessages(conversationId: string, newMessages: ConversationMessage[]): Promise<void> {
    // Buscar mensagens atuais
    const row = await this.knex('conversations')
      .where({ id: conversationId })
      .select('messages')
      .first()

    if (!row) {
      return
    }

    const current: ConversationMessage[] = (row.messages as ConversationMessage[]) ?? []

    // Concatenar novas mensagens ao final e truncar para o limite
    const merged = [...current, ...newMessages]
    const trimmed = merged.slice(-MAX_HISTORY_MESSAGES)

    await this.knex('conversations').where({ id: conversationId }).update({
      messages: JSON.stringify(trimmed),
      last_message_at: this.knex.fn.now(),
      updated_at: this.knex.fn.now(),
    })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ConversationRow {
  id: string
  tenant_id: string
  phone: string
  messages: ConversationMessage[]
  last_message_at: Date | string
  created_at: Date | string
  updated_at: Date | string
}

function mapRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    phone: row.phone,
    messages: row.messages ?? [],
    lastMessageAt: new Date(row.last_message_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}
