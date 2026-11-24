import "server-only";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { formatVerificationCode } from "./verification";

/** Genera un código único con 48 bits de entropía criptográfica (281 billones de combinaciones). */
export function createReportCardCode(year: number, periodNumber: number): string {
  return formatVerificationCode(year, periodNumber, randomBytes(6).toString("hex"));
}

/**
 * Genera el código QR en SVG inline en < 2ms (sin Chromium ni canvas nativo),
 * seguro para picos de 1.000+ usuarios descargando boletines.
 */
export async function renderQrSvg(targetUrl: string): Promise<string> {
  return QRCode.toString(targetUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 128,
    color: {
      dark: "#0f1747",
      light: "#ffffff",
    },
  });
}
