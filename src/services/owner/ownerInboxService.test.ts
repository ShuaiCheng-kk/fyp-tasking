import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/ownerInboxRepository', () => ({
  ownerInboxRepository: {
    getConversationPartners: vi.fn(),
    getMessagesBetweenUsers: vi.fn(),
    markMessagesAsRead: vi.fn(),
    deleteConversation: vi.fn(),
    insertMessage: vi.fn(),
    countUnreadMessages: vi.fn(),
    countUnreadAnnouncements: vi.fn(),
    findUserById: vi.fn(),
    findCompanyById: vi.fn(),
  },
}))

vi.mock('@/repositories/manager/managerInboxRepository', () => ({
  managerInboxRepository: {
    getManagerContacts: vi.fn(),
  },
}))

import { ownerInboxService } from './ownerInboxService'
import { ownerInboxRepository } from '@/repositories/owner/ownerInboxRepository'
import { managerInboxRepository } from '@/repositories/manager/managerInboxRepository'

describe('ownerInboxService — Communication (UC61)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getConversations', () => {
    it('groups messages by conversation partner and counts unread messages addressed to the viewer', async () => {
      vi.mocked(ownerInboxRepository.getConversationPartners).mockResolvedValue([
        { id: 'msg-1', from_user_id: 'owner-1', to_user_id: 'mgr-1', content: 'Hi', created_at: '2026-06-01T10:00:00Z', is_read: true, company_id: 'company-1', sender_name: null },
        { id: 'msg-2', from_user_id: 'mgr-1', to_user_id: 'owner-1', content: 'Hello back', created_at: '2026-06-01T10:05:00Z', is_read: false, company_id: 'company-1', sender_name: 'Manager One' },
        { id: 'msg-3', from_user_id: 'mgr-1', to_user_id: 'owner-1', content: 'Second unread', created_at: '2026-06-01T10:06:00Z', is_read: false, company_id: 'company-1', sender_name: 'Manager One' },
      ])
      vi.mocked(ownerInboxRepository.findUserById).mockResolvedValue({ full_name: 'Manager One', role: 'Manager' })
      vi.mocked(ownerInboxRepository.findCompanyById).mockResolvedValue({ name: 'Acme Co' })

      const result = await ownerInboxService.getConversations('owner-1')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        partnerId: 'mgr-1',
        lastMessage: 'Hi',
        unreadCount: 2,
        partnerName: 'Manager One',
        partnerRole: 'Manager',
        partnerDeleted: false,
        companyName: 'Acme Co',
      })
    })

    it('falls back to the last known sender name and marks the partner deleted when the user lookup fails', async () => {
      vi.mocked(ownerInboxRepository.getConversationPartners).mockResolvedValue([
        { id: 'msg-1', from_user_id: 'deleted-user', to_user_id: 'owner-1', content: 'Hi', created_at: '2026-06-01T10:00:00Z', is_read: false, company_id: null, sender_name: 'Gone User' },
      ])
      vi.mocked(ownerInboxRepository.findUserById).mockResolvedValue(null)

      const result = await ownerInboxService.getConversations('owner-1')

      expect(result[0]).toMatchObject({
        partnerId: 'deleted-user',
        partnerName: 'Gone User',
        partnerDeleted: true,
      })
    })

    it('marks the partner deleted when the lookup throws', async () => {
      vi.mocked(ownerInboxRepository.getConversationPartners).mockResolvedValue([
        { id: 'msg-1', from_user_id: 'owner-1', to_user_id: 'flaky-user', content: 'Hi', created_at: '2026-06-01T10:00:00Z', is_read: true, company_id: null, sender_name: null },
      ])
      vi.mocked(ownerInboxRepository.findUserById).mockRejectedValue(new Error('db down'))

      const result = await ownerInboxService.getConversations('owner-1')

      expect(result[0]).toMatchObject({ partnerId: 'flaky-user', partnerDeleted: true, partnerName: 'Deleted User' })
    })
  })

  describe('getMessages', () => {
    it('fetches messages then marks them as read', async () => {
      const messages = [{ id: 'msg-1', content: 'Hi' }]
      vi.mocked(ownerInboxRepository.getMessagesBetweenUsers).mockResolvedValue(messages)

      const result = await ownerInboxService.getMessages('owner-1', 'mgr-1')

      expect(ownerInboxRepository.getMessagesBetweenUsers).toHaveBeenCalledWith('owner-1', 'mgr-1')
      expect(ownerInboxRepository.markMessagesAsRead).toHaveBeenCalledWith('owner-1', 'mgr-1')
      expect(result).toEqual(messages)
    })
  })

  describe('sendMessage', () => {
    it('rejects empty content', async () => {
      await expect(ownerInboxService.sendMessage('owner-1', 'mgr-1', 'company-1', '   '))
        .rejects.toThrow('Message content cannot be empty')
      expect(ownerInboxRepository.insertMessage).not.toHaveBeenCalled()
    })

    it('looks up the sender name and trims content before inserting', async () => {
      vi.mocked(ownerInboxRepository.findUserById).mockResolvedValue({ full_name: 'Owner One' })
      vi.mocked(ownerInboxRepository.insertMessage).mockResolvedValue({ id: 'msg-1' })

      await ownerInboxService.sendMessage('owner-1', 'mgr-1', 'company-1', '  Hello  ')

      expect(ownerInboxRepository.insertMessage).toHaveBeenCalledWith('owner-1', 'mgr-1', 'company-1', 'Hello', 'Owner One')
    })

    it('sends without a sender name when the sender lookup fails', async () => {
      vi.mocked(ownerInboxRepository.findUserById).mockRejectedValue(new Error('boom'))
      vi.mocked(ownerInboxRepository.insertMessage).mockResolvedValue({ id: 'msg-1' })

      await ownerInboxService.sendMessage('owner-1', 'mgr-1', 'company-1', 'Hello')

      expect(ownerInboxRepository.insertMessage).toHaveBeenCalledWith('owner-1', 'mgr-1', 'company-1', 'Hello', undefined)
    })

    it('rejects a Manager messaging someone outside their own-department scope', async () => {
      vi.mocked(ownerInboxRepository.findUserById).mockResolvedValue({ full_name: 'Manager One', role: 'Manager' })
      vi.mocked(managerInboxRepository.getManagerContacts).mockResolvedValue([{ id: 'owner-1', full_name: 'Owner', role: 'Owner', email_address: '', profile_photo_url: null }])

      await expect(ownerInboxService.sendMessage('mgr-1', 'mgr-2-other-dept', 'company-1', 'Hi'))
        .rejects.toThrow('Managers can only message the Owner, Partner, or members of their own department')
      expect(ownerInboxRepository.insertMessage).not.toHaveBeenCalled()
    })

    it('allows a Manager to message someone within their own-department scope', async () => {
      vi.mocked(ownerInboxRepository.findUserById).mockResolvedValue({ full_name: 'Manager One', role: 'Manager' })
      vi.mocked(managerInboxRepository.getManagerContacts).mockResolvedValue([{ id: 'emp-1', full_name: 'Employee', role: 'Employee', email_address: '', profile_photo_url: null }])
      vi.mocked(ownerInboxRepository.insertMessage).mockResolvedValue({ id: 'msg-1' })

      await ownerInboxService.sendMessage('mgr-1', 'emp-1', 'company-1', 'Hi')

      expect(ownerInboxRepository.insertMessage).toHaveBeenCalledWith('mgr-1', 'emp-1', 'company-1', 'Hi', 'Manager One')
    })
  })

  describe('getUnreadCount', () => {
    it('combines unread messages and unread announcements', async () => {
      vi.mocked(ownerInboxRepository.countUnreadMessages).mockResolvedValue(2)
      vi.mocked(ownerInboxRepository.countUnreadAnnouncements).mockResolvedValue(3)

      const result = await ownerInboxService.getUnreadCount('owner-1', 'company-1', '2026-06-01T00:00:00Z')

      expect(ownerInboxRepository.countUnreadAnnouncements).toHaveBeenCalledWith('company-1', '2026-06-01T00:00:00Z')
      expect(result).toEqual({ unread_messages: 2, unread_announcements: 3, count: 5 })
    })

    it('skips the announcement count when there is no company', async () => {
      vi.mocked(ownerInboxRepository.countUnreadMessages).mockResolvedValue(1)

      const result = await ownerInboxService.getUnreadCount('owner-1', null)

      expect(ownerInboxRepository.countUnreadAnnouncements).not.toHaveBeenCalled()
      expect(result).toEqual({ unread_messages: 1, unread_announcements: 0, count: 1 })
    })
  })

  describe('deleteConversation', () => {
    it('delegates to the repository', async () => {
      await ownerInboxService.deleteConversation('owner-1', 'mgr-1')
      expect(ownerInboxRepository.deleteConversation).toHaveBeenCalledWith('owner-1', 'mgr-1')
    })
  })
})
