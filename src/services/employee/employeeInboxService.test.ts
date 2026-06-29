import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/employee/employeeInboxRepository', () => ({
  employeeInboxRepository: {
    getEmployeeContacts: vi.fn(),
    getConversationPartners: vi.fn(),
    getMessagesBetweenUsers: vi.fn(),
    markMessagesAsRead: vi.fn(),
    insertMessage: vi.fn(),
    countUnreadMessages: vi.fn(),
    countUnreadAnnouncements: vi.fn(),
    countPendingInvitations: vi.fn(),
    getInvitesByRecipient: vi.fn(),
    getInboxItemById: vi.fn(),
    updateInboxStatus: vi.fn(),
    findUserById: vi.fn(),
    findUserByAuthIdOrInternalId: vi.fn(),
  },
}))

import { employeeInboxService } from './employeeInboxService'
import { employeeInboxRepository } from '@/repositories/employee/employeeInboxRepository'

describe('employeeInboxService — Communication (UC62)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getContacts', () => {
    it('throws when the user cannot be resolved from the auth id', async () => {
      vi.mocked(employeeInboxRepository.findUserByAuthIdOrInternalId).mockResolvedValue(null)

      await expect(employeeInboxService.getContacts('auth-1')).rejects.toThrow('User not found')
      expect(employeeInboxRepository.getEmployeeContacts).not.toHaveBeenCalled()
    })

    it('resolves the internal user id first, then fetches contacts', async () => {
      vi.mocked(employeeInboxRepository.findUserByAuthIdOrInternalId).mockResolvedValue({ id: 'employee-1' })
      const contacts = [{ id: 'mgr-1', full_name: 'Manager One', role: 'Manager', email_address: 'm1@example.com' }]
      vi.mocked(employeeInboxRepository.getEmployeeContacts).mockResolvedValue(contacts)

      const result = await employeeInboxService.getContacts('auth-1')

      expect(employeeInboxRepository.getEmployeeContacts).toHaveBeenCalledWith('employee-1')
      expect(result).toEqual(contacts)
    })
  })

  describe('getConversations', () => {
    it('groups messages by conversation partner and counts unread messages addressed to the viewer', async () => {
      vi.mocked(employeeInboxRepository.getConversationPartners).mockResolvedValue([
        { id: 'msg-1', from_user_id: 'mgr-1', to_user_id: 'employee-1', content: 'Latest', created_at: '2026-06-01T10:05:00Z', is_read: false, company_id: 'company-1', sender_name: 'Manager One' },
        { id: 'msg-2', from_user_id: 'employee-1', to_user_id: 'mgr-1', content: 'Older', created_at: '2026-06-01T10:00:00Z', is_read: true, company_id: 'company-1', sender_name: null },
      ])
      vi.mocked(employeeInboxRepository.findUserById).mockResolvedValue({ full_name: 'Manager One', role: 'Manager' })

      const result = await employeeInboxService.getConversations('employee-1')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        partnerId: 'mgr-1',
        lastMessage: 'Latest',
        unreadCount: 1,
        partnerName: 'Manager One',
        partnerRole: 'Manager',
        partnerDeleted: false,
        companyName: null,
      })
    })

    it('falls back to the last known sender name when the partner no longer exists', async () => {
      vi.mocked(employeeInboxRepository.getConversationPartners).mockResolvedValue([
        { id: 'msg-1', from_user_id: 'deleted-user', to_user_id: 'employee-1', content: 'Hi', created_at: '2026-06-01T10:00:00Z', is_read: false, company_id: null, sender_name: 'Gone User' },
      ])
      vi.mocked(employeeInboxRepository.findUserById).mockResolvedValue(null)

      const result = await employeeInboxService.getConversations('employee-1')

      expect(result[0]).toMatchObject({ partnerId: 'deleted-user', partnerName: 'Gone User', partnerDeleted: true })
    })
  })

  describe('getMessages', () => {
    it('fetches messages then marks them as read', async () => {
      const messages = [{ id: 'msg-1' }]
      vi.mocked(employeeInboxRepository.getMessagesBetweenUsers).mockResolvedValue(messages)

      const result = await employeeInboxService.getMessages('employee-1', 'mgr-1')

      expect(employeeInboxRepository.getMessagesBetweenUsers).toHaveBeenCalledWith('employee-1', 'mgr-1')
      expect(employeeInboxRepository.markMessagesAsRead).toHaveBeenCalledWith('employee-1', 'mgr-1')
      expect(result).toEqual(messages)
    })
  })

  describe('sendMessage', () => {
    it('rejects empty content', async () => {
      await expect(employeeInboxService.sendMessage('employee-1', 'mgr-1', 'company-1', '   '))
        .rejects.toThrow('Message content cannot be empty')
      expect(employeeInboxRepository.insertMessage).not.toHaveBeenCalled()
    })

    it('looks up the sender name and trims content before inserting', async () => {
      vi.mocked(employeeInboxRepository.findUserById).mockResolvedValue({ full_name: 'Employee One' })
      vi.mocked(employeeInboxRepository.insertMessage).mockResolvedValue({ id: 'msg-1' })

      await employeeInboxService.sendMessage('employee-1', 'mgr-1', 'company-1', '  Hi there  ')

      expect(employeeInboxRepository.insertMessage).toHaveBeenCalledWith('employee-1', 'mgr-1', 'company-1', 'Hi there', 'Employee One')
    })
  })

  describe('getUnreadCount', () => {
    it('combines unread messages, pending invitations, and unread announcements', async () => {
      vi.mocked(employeeInboxRepository.countUnreadMessages).mockResolvedValue(1)
      vi.mocked(employeeInboxRepository.countUnreadAnnouncements).mockResolvedValue(2)
      vi.mocked(employeeInboxRepository.countPendingInvitations).mockResolvedValue(0)

      const result = await employeeInboxService.getUnreadCount('employee-1', 'company-1')

      expect(result).toEqual({ unread_messages: 1, unread_announcements: 2, count: 3 })
    })

    it('skips the announcement count when there is no company', async () => {
      vi.mocked(employeeInboxRepository.countUnreadMessages).mockResolvedValue(1)
      vi.mocked(employeeInboxRepository.countPendingInvitations).mockResolvedValue(0)

      await employeeInboxService.getUnreadCount('employee-1', null)

      expect(employeeInboxRepository.countUnreadAnnouncements).not.toHaveBeenCalled()
    })
  })

  describe('updateInboxStatus', () => {
    it('delegates to the repository', async () => {
      await employeeInboxService.updateInboxStatus('inbox-1', 'accepted')
      expect(employeeInboxRepository.updateInboxStatus).toHaveBeenCalledWith('inbox-1', 'accepted')
    })
  })
})
