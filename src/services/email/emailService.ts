import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const emailService = {
  async sendConfirmationRequestEmail(data: {
    to: string
    fullName: string
    confirmLink: string
  }): Promise<void> {
    await resend.emails.send({
      from: 'Tasking <noreply@gettasking.com>',
      to: data.to,
      subject: 'Confirm your Tasking account',
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <span style="font-size: 20px; font-weight: 700; color: #F97316;">Tasking</span>
          <h2 style="font-size: 22px; font-weight: 700; color: #1C1C1E; margin: 24px 0 8px 0;">
            Confirm your account
          </h2>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 16px 0;">
            Hi ${data.fullName}, thanks for signing up. Please confirm your email address to activate your account.
          </p>
          <a href="${data.confirmLink}" style="display: inline-block; background: #F97316; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; margin: 24px 0;">
            Confirm my account
          </a>
          <p style="font-size: 13px; color: #9CA3AF; margin: 8px 0 0 0;">
            This link expires in 24 hours. If you didn't create this account, you can ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 24px 0;">
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">© 2025 Tasking. All rights reserved.</p>
        </div>
      `,
    })
  },

  // Sent the moment an employer accepts an application — the worker is not always online, so
  // this shortens the gap until they log in and confirm the offer (first-come-first-served).
  async sendApplicationAcceptedEmail(data: {
    to: string
    fullName: string
    jobTitle: string
    companyName: string
  }): Promise<void> {
    await resend.emails.send({
      from: 'Tasking <noreply@gettasking.com>',
      to: data.to,
      subject: `Your application for ${data.jobTitle} was accepted — confirm to secure the job`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <span style="font-size: 20px; font-weight: 700; color: #F97316;">Tasking</span>
          <h2 style="font-size: 22px; font-weight: 700; color: #1C1C1E; margin: 24px 0 8px 0;">
            Your application was accepted 🎉
          </h2>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 16px 0;">
            Hi ${data.fullName}, ${data.companyName} accepted your application for <strong>${data.jobTitle}</strong>.
            Openings are confirmed on a first-come-first-served basis — log in and confirm the offer to secure your spot.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/guest/applications" style="display: inline-block; background: #F97316; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; margin: 24px 0;">
            Review &amp; Confirm
          </a>
          <p style="font-size: 13px; color: #9CA3AF; margin: 0;">
            The offer expires automatically once the shift starts, so don't wait too long.
          </p>
          <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 24px 0;">
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">© 2025 Tasking. All rights reserved.</p>
        </div>
      `,
    })
  },

  // Sent when an employer rejects an application outright — closes the loop so the worker isn't
  // left waiting indefinitely on a "pending" status.
  async sendApplicationRejectedEmail(data: {
    to: string
    fullName: string
    jobTitle: string
    companyName: string
  }): Promise<void> {
    await resend.emails.send({
      from: 'Tasking <noreply@gettasking.com>',
      to: data.to,
      subject: `Update on your application for ${data.jobTitle}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <span style="font-size: 20px; font-weight: 700; color: #F97316;">Tasking</span>
          <h2 style="font-size: 22px; font-weight: 700; color: #1C1C1E; margin: 24px 0 8px 0;">
            Application update
          </h2>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 16px 0;">
            Hi ${data.fullName}, thank you for applying for <strong>${data.jobTitle}</strong> at ${data.companyName}.
            After review, they've decided not to move forward with your application this time.
          </p>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 16px 0;">
            Don't be discouraged — there are plenty of other openings waiting for you.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/job-board" style="display: inline-block; background: #F97316; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; margin: 8px 0 24px;">
            Browse Other Jobs
          </a>
          <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 24px 0;">
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">© 2025 Tasking. All rights reserved.</p>
        </div>
      `,
    })
  },

  // Sent after BOTH sides have agreed — includes everything the worker needs to show up:
  // when, where, and who to report to (name + phone of the responsible employee).
  async sendOfferConfirmedEmail(data: {
    to: string
    fullName: string
    jobTitle: string
    companyName: string
    shiftDate: string | null
    startTime: string | null
    location: string | null
    supervisorName: string | null
    supervisorPhone: string | null
    supervisorEmail: string | null
  }): Promise<void> {
    const detailRow = (label: string, value: string | null) =>
      value ? `<tr><td style="padding: 4px 12px 4px 0; color: #9CA3AF; font-size: 13px; white-space: nowrap;">${label}</td><td style="padding: 4px 0; color: #1C1C1E; font-size: 14px; font-weight: 600;">${value}</td></tr>` : ''

    await resend.emails.send({
      from: 'Tasking <noreply@gettasking.com>',
      to: data.to,
      subject: `You're confirmed for ${data.jobTitle} at ${data.companyName}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <span style="font-size: 20px; font-weight: 700; color: #F97316;">Tasking</span>
          <h2 style="font-size: 22px; font-weight: 700; color: #1C1C1E; margin: 24px 0 8px 0;">
            You're confirmed — see you at work
          </h2>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 16px 0;">
            Hi ${data.fullName}, your job <strong>${data.jobTitle}</strong> at ${data.companyName} is confirmed.
          </p>
          <table style="border-collapse: collapse; margin: 8px 0 16px 0;">
            ${detailRow('Date', data.shiftDate)}
            ${detailRow('Start time', data.startTime)}
            ${detailRow('Location', data.location)}
            ${detailRow('Report to', data.supervisorName)}
            ${detailRow('Phone', data.supervisorPhone)}
            ${detailRow('Email', data.supervisorEmail)}
          </table>
          <p style="font-size: 13px; color: #9CA3AF; margin: 0;">
            You can always find these details on your Tasking dashboard.
          </p>
          <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 24px 0;">
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">© 2025 Tasking. All rights reserved.</p>
        </div>
      `,
    })
  },

  // Sent by the daily shift-reminder cron the day before a confirmed shift — repeats the same
  // when/where/who-to-report-to details sendOfferConfirmedEmail already sent at confirmation
  // time, so a worker isn't relying on an email from weeks ago if their phone/computer dies.
  async sendShiftReminderEmail(data: {
    to: string
    fullName: string
    jobTitle: string
    companyName: string
    shiftDate: string | null
    startTime: string | null
    location: string | null
    supervisorName: string | null
    supervisorPhone: string | null
    supervisorEmail: string | null
  }): Promise<void> {
    const detailRow = (label: string, value: string | null) =>
      value ? `<tr><td style="padding: 4px 12px 4px 0; color: #9CA3AF; font-size: 13px; white-space: nowrap;">${label}</td><td style="padding: 4px 0; color: #1C1C1E; font-size: 14px; font-weight: 600;">${value}</td></tr>` : ''

    await resend.emails.send({
      from: 'Tasking <noreply@gettasking.com>',
      to: data.to,
      subject: `Reminder: your shift for ${data.jobTitle} is tomorrow`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <span style="font-size: 20px; font-weight: 700; color: #F97316;">Tasking</span>
          <h2 style="font-size: 22px; font-weight: 700; color: #1C1C1E; margin: 24px 0 8px 0;">
            Your shift is coming up
          </h2>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 16px 0;">
            Hi ${data.fullName}, just a reminder that your job <strong>${data.jobTitle}</strong> at ${data.companyName} is tomorrow.
          </p>
          <table style="border-collapse: collapse; margin: 8px 0 16px 0;">
            ${detailRow('Date', data.shiftDate)}
            ${detailRow('Start time', data.startTime)}
            ${detailRow('Location', data.location)}
            ${detailRow('Report to', data.supervisorName)}
            ${detailRow('Phone', data.supervisorPhone)}
            ${detailRow('Email', data.supervisorEmail)}
          </table>
          <p style="font-size: 13px; color: #9CA3AF; margin: 0;">
            You can always find these details on your Tasking dashboard.
          </p>
          <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 24px 0;">
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">© 2025 Tasking. All rights reserved.</p>
        </div>
      `,
    })
  },

  // Employer-side cancellation (single worker removed, or the whole job called off) — the
  // worker had already confirmed, so this must reach them even when they're offline.
  async sendEngagementCancelledEmail(data: {
    to: string
    fullName: string
    jobTitle: string
    companyName: string
    reason: string
  }): Promise<void> {
    await resend.emails.send({
      from: 'Tasking <noreply@gettasking.com>',
      to: data.to,
      subject: `Update: your confirmed job ${data.jobTitle} was cancelled by ${data.companyName}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <span style="font-size: 20px; font-weight: 700; color: #F97316;">Tasking</span>
          <h2 style="font-size: 22px; font-weight: 700; color: #1C1C1E; margin: 24px 0 8px 0;">
            Your confirmed job was cancelled
          </h2>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 12px 0;">
            Hi ${data.fullName}, ${data.companyName} has cancelled your confirmed job <strong>${data.jobTitle}</strong>. You do not need to show up.
          </p>
          <p style="font-size: 14px; color: #374151; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 14px; margin: 0 0 16px 0;">
            Reason from the employer: ${data.reason}
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/guest/applications" style="display: inline-block; background: #F97316; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; margin: 8px 0 24px;">
            Browse Other Jobs
          </a>
          <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 24px 0;">
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">© 2025 Tasking. All rights reserved.</p>
        </div>
      `,
    })
  },

  // Worker-side cancellation — tells the employer their opening is vacant again (and whether
  // the posting could be reopened automatically or needs a new deadline).
  async sendWorkerCancelledEmail(data: {
    to: string
    ownerName: string
    workerName: string
    jobTitle: string
    reason: string | null
    reopened: boolean
  }): Promise<void> {
    await resend.emails.send({
      from: 'Tasking <noreply@gettasking.com>',
      to: data.to,
      subject: `${data.workerName} cancelled their confirmed shift for ${data.jobTitle}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <span style="font-size: 20px; font-weight: 700; color: #F97316;">Tasking</span>
          <h2 style="font-size: 22px; font-weight: 700; color: #1C1C1E; margin: 24px 0 8px 0;">
            A confirmed worker cancelled
          </h2>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 12px 0;">
            Hi ${data.ownerName}, <strong>${data.workerName}</strong> has cancelled their confirmed shift for <strong>${data.jobTitle}</strong>.
          </p>
          ${data.reason ? `<p style="font-size: 14px; color: #374151; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 14px; margin: 0 0 12px 0;">Reason: ${data.reason}</p>` : ''}
          <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">
            ${data.reopened
              ? 'The opening has been freed and the job is back on the public job board.'
              : 'The opening has been freed, but the job\'s application deadline has passed — extend the deadline or post it again to keep hiring.'}
          </p>
          <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 24px 0;">
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">© 2025 Tasking. All rights reserved.</p>
        </div>
      `,
    })
  },

  async sendInviteEmail(data: {
    to: string
    role: string
    companyName: string
    inviteLink: string
    inviterName: string
  }): Promise<void> {
    await resend.emails.send({
      from: 'Tasking <noreply@gettasking.com>',
      to: data.to,
      subject: `${data.inviterName} has invited you to join ${data.companyName} as ${data.role} on Tasking`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <span style="font-size: 20px; font-weight: 700; color: #F97316;">Tasking</span>
          <h2 style="font-size: 22px; font-weight: 700; color: #1C1C1E; margin: 24px 0 8px 0;">
            You've been invited to join ${data.companyName}
          </h2>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 8px 0;">
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

  // UC30: sent to whoever an Owner removes from the company (any role) — their account is deleted
  // as part of that same action, so this is the only notice they get that they can no longer sign in.
  async sendRemovedFromCompanyEmail(data: {
    to: string
    fullName: string
    companyName: string
  }): Promise<void> {
    await resend.emails.send({
      from: 'Tasking <noreply@gettasking.com>',
      to: data.to,
      subject: `You have been removed from ${data.companyName}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <span style="font-size: 20px; font-weight: 700; color: #F97316;">Tasking</span>
          <h2 style="font-size: 22px; font-weight: 700; color: #1C1C1E; margin: 24px 0 8px 0;">
            You've been removed from ${data.companyName}
          </h2>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 16px 0;">
            Hi ${data.fullName}, you have been removed as a member of ${data.companyName} on Tasking.
            Your account has been deactivated and you will no longer be able to sign in.
          </p>
          <p style="font-size: 13px; color: #9CA3AF; margin: 0;">
            If you believe this was a mistake, please contact ${data.companyName} directly.
          </p>
          <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 24px 0;">
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">© 2025 Tasking. All rights reserved.</p>
        </div>
      `,
    })
  },
}
