import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

export async function sendGuestAccessEmail(input: {
  to: string;
  storeName: string;
  accessUrl: string;
}) {
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not set");
  }

  const from = process.env.SENDGRID_FROM;
  if (!from) {
    throw new Error("SENDGRID_FROM is not set");
  }

  const subject = `Your message thread with ${input.storeName}`;
  const text = `Thanks for reaching out to ${input.storeName}. Use this link to follow up as a guest: ${input.accessUrl}`;

  await sgMail.send({
    to: input.to,
    from,
    subject,
    text,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.5;">
        <h2 style="margin-bottom:12px;">Message thread for ${input.storeName}</h2>
        <p>Thanks for reaching out. Use the button below to view and reply to your conversation.</p>
        <p style="margin:20px 0;">
          <a href="${input.accessUrl}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">
            View your conversation
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280;">If the button doesn't work, paste this link into your browser:</p>
        <p style="font-size:12px;color:#6b7280;">${input.accessUrl}</p>
      </div>
    `,
  });
}
