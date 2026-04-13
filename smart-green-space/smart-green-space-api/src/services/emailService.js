const nodemailer = require("nodemailer");
const { env } = require("../config/env");
const { logger } = require("../utils/logger");
const { prisma } = require("../config/prisma");

function createTransport() {
  // No SMTP env currently specified; mock in non-production.
  if (env.NODE_ENV !== "production") {
    return null;
  }
  // If you later add SMTP settings, wire them here.
  return null;
}

async function sendMailMock(subject, payload) {
  logger.info("email_mock_send", { subject, payload });
}

async function sendAlertEmail(officers, alert) {
  const subject = `[${alert.severity}] ${alert.title}`;
  const payload = {
    to: officers.map((o) => o.email),
    alertId: alert.id,
    parkId: alert.parkId,
    type: alert.type,
  };

  const transport = createTransport();
  if (!transport) return sendMailMock(subject, payload);
  await transport.sendMail({
    to: payload.to,
    subject,
    text: `${alert.description}`,
  });
}

async function sendWeeklyReport(cityId) {
  // Mock aggregation – extend as needed.
  const [city, parks, openAlerts] = await Promise.all([
    prisma.city.findUnique({ where: { id: cityId }, select: { name: true } }),
    prisma.park.count({ where: { cityId, isActive: true } }),
    prisma.alert.count({ where: { park: { cityId }, status: { in: ["OPEN", "ASSIGNED", "ESCALATED"] } } }),
  ]);

  const subject = `Weekly Smart Green Space report — ${city?.name || cityId}`;
  const payload = { cityId, parks, openAlerts };

  const transport = createTransport();
  if (!transport) return sendMailMock(subject, payload);
  // Production: determine recipients (city officers) and send.
  return transport.sendMail({ subject, text: JSON.stringify(payload, null, 2) });
}

async function sendVerificationEmail(user) {
  const subject = "Verify your Smart Green Space account";
  const payload = { userId: user.id, email: user.email };
  const transport = createTransport();
  if (!transport) return sendMailMock(subject, payload);
  return transport.sendMail({ to: user.email, subject, text: "Verification link goes here." });
}

module.exports = {
  sendAlertEmail,
  sendWeeklyReport,
  sendVerificationEmail,
};

