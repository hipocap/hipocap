import { Resend } from 'resend';

import { ItemDescription } from '../checkout/utils';
import SubscriptionUpdatedEmail from './subscription-updated-email';
import WelcomeEmail from './welcome-email';
import WorkspaceInviteEmail from './workspace-invite';

const RESEND = new Resend(
  process.env.RESEND_API_KEY ?? '_RESEND_API_KEY_PLACEHOLDER'
);

export async function sendWelcomeEmail(email: string) {
  const from = 'Robert from Hipocap <robert@lmnr.ai>';
  const subject = 'Welcome to Hipocap!';

  const { data, error } = await RESEND.emails.send({
    from,
    to: [email],
    subject,
    react: WelcomeEmail({})
  });

  if (error) console.log(error);
}

export async function sendOnPaymentReceivedEmail(
  email: string,
  itemDescriptions: ItemDescription[],
  date: string,
) {
  const from = 'Hipocap team <founders@lmnr.ai>';
  const subject = itemDescriptions.length === 1 ?
    `Hipocap: Payment for ${itemDescriptions[0].shortDescription ?? itemDescriptions[0].productDescription} is received.` :
    'Hipocap: Payment received.';
  const component = SubscriptionUpdatedEmail({
    itemDescriptions,
    date,
    billedTo: email,
  });

  const { data, error } = await RESEND.emails.send({
    from,
    to: [email],
    subject,
    react: component
  });

  if (error) console.log(error);
}

export async function sendInvitationEmail(email: string, workspaceName: string, inviteLink: string) {
  const from = 'Robert from Hipocap <robert@lmnr.ai>';
  const subject = `You are invited to join ${workspaceName} on Hipocap`;

  const { data, error } = await RESEND.emails.send({
    from,
    to: [email],
    subject,
    react: WorkspaceInviteEmail({ workspaceName, inviteLink })
  });

  if (error) console.log(error);
}
