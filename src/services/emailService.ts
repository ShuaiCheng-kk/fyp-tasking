// LAYER: Service
// RULE: Handles email sending only. No DB access. No business logic.

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const emailService = {
  async sendInviteEmail(data: {
    to: string
    role: string
    companyName: string
    inviteLink: string
  }): Promise<void> {
    await resend.emails.send({
      from: 'Tasking <onboarding@resend.dev>',
      to: data.to,
      subject: `You've been invited to join ${data.companyName} on Tasking`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <span style="font-size: 20px; font-weight: 700; color: #F97316;">Tasking</span>
          <h2 style="font-size: 22px; font-weight: 700; color: #1C1C1E; margin: 24px 0 8px 0;">
            You've been invited to join ${data.companyName}
          </h2>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 8px 0;">
            You've been invited to join as <strong>${data.role}</strong>.
            Click the button below to create your account and get started.
          </p>
          <a href="${data.inviteLink}" style="display: inline-block; background: #F97316; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; margin: 24px 0;">
            Accept Invitation
          </a>
          <p style="font-size: 13px; color: #9CA3AF; margin: 0;">
            This invitation expires in 7 days. If you weren't expecting this, you can ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 24px 0;">
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">© 2025 Tasking. All rights reserved.</p>
        </div>
      `,
    })
  },
}
