import "server-only";

/**
 * Envío de correo institucional.
 * - Con `SMTP_URL` (p. ej. smtps://usuario:clave@smtp.gmail.com:465) usa nodemailer.
 * - Sin SMTP en desarrollo: escribe el mensaje en la consola del servidor.
 * - Sin SMTP en producción: registra el error y no envía (la UI sigue siendo neutra).
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(message: MailMessage): Promise<boolean> {
  const smtpUrl = process.env.SMTP_URL;
  const from = process.env.MAIL_FROM ?? "Campus Lunita <no-responder@liceolunita.edu.co>";

  if (!smtpUrl) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `\n📧 [correo de desarrollo] Para: ${message.to}\n   Asunto: ${message.subject}\n${message.text
          .split("\n")
          .map((line) => `   ${line}`)
          .join("\n")}\n`,
      );
      return true;
    }
    console.error("SMTP_URL no está configurado: no se pudo enviar un correo transaccional.");
    return false;
  }

  try {
    const { createTransport } = await import("nodemailer");
    await createTransport(smtpUrl).sendMail({ from, ...message });
    return true;
  } catch (error) {
    console.error("Error enviando correo transaccional:", error);
    return false;
  }
}
