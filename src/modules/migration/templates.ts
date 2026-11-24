import ExcelJS from "exceljs";
import type { MigrationSourceKind } from "@/db/schema/migration";

/**
 * Generador de plantillas oficiales descargables (.xlsx y Moodle .xml) para Fase 5.
 * Cada plantilla incluye encabezados exactos, ejemplo guía y hoja de instrucciones.
 */
export async function buildMigrationTemplateBuffer(kind: MigrationSourceKind): Promise<{
  buffer: Buffer;
  fileName: string;
  contentType: string;
}> {
  if (kind === "MOODLE_QUIZ_XML") {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="multichoice">
    <name><text>Ejemplo Matemáticas STHEAMI</text></name>
    <questiontext format="html"><text><![CDATA[<p>¿Cuál es el resultado de 3x + 5 = 20?</p>]]></text></questiontext>
    <defaultgrade>2</defaultgrade>
    <single>true</single>
    <answer fraction="100"><text>x = 5</text></answer>
    <answer fraction="0"><text>x = 3</text></answer>
    <answer fraction="0"><text>x = 7</text></answer>
    <answer fraction="0"><text>x = 15</text></answer>
  </question>
  <question type="truefalse">
    <name><text>Ejemplo Ciencias</text></name>
    <questiontext format="html"><text><![CDATA[<p>La fotosíntesis convierte energía solar en energía química en los cloroplastos.</p>]]></text></questiontext>
    <defaultgrade>1</defaultgrade>
    <answer fraction="100"><text>true</text></answer>
    <answer fraction="0"><text>false</text></answer>
  </question>
</quiz>
`;
    return {
      buffer: Buffer.from(sampleXml, "utf-8"),
      fileName: "ejemplo-moodle-quiz-lunita.xml",
      contentType: "application/xml; charset=utf-8",
    };
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Campus Digital · Liceo Lunita de Chía";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Datos a migrar", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  if (kind === "STUDENTS_FAMILIES") {
    sheet.columns = [
      { header: "tipo_doc", key: "tipo_doc", width: 12 },
      { header: "documento", key: "documento", width: 18 },
      { header: "nombres", key: "nombres", width: 22 },
      { header: "apellidos", key: "apellidos", width: 22 },
      { header: "correo", key: "correo", width: 30 },
      { header: "grupo", key: "grupo", width: 12 },
      { header: "documento_acudiente", key: "documento_acudiente", width: 20 },
      { header: "nombres_acudiente", key: "nombres_acudiente", width: 22 },
      { header: "apellidos_acudiente", key: "apellidos_acudiente", width: 22 },
      { header: "correo_acudiente", key: "correo_acudiente", width: 30 },
      { header: "telefono_acudiente", key: "telefono_acudiente", width: 18 },
      { header: "parentesco", key: "parentesco", width: 14 },
    ];
    sheet.addRow({
      tipo_doc: "TI",
      documento: "1070999001",
      nombres: "Camila Andrea",
      apellidos: "Rojas Beltrán",
      correo: "camila.rojas@campus.lunita.edu.co",
      grupo: "7A",
      documento_acudiente: "52999001",
      nombres_acudiente: "Andrea",
      apellidos_acudiente: "Beltrán",
      correo_acudiente: "andrea.beltran@familia.test",
      telefono_acudiente: "3105551234",
      parentesco: "MADRE",
    });
  } else if (kind === "HISTORICAL_GRADES") {
    sheet.columns = [
      { header: "documento", key: "documento", width: 18 },
      { header: "asignatura", key: "asignatura", width: 28 },
      { header: "periodo", key: "periodo", width: 12 },
      { header: "dimension", key: "dimension", width: 14 },
      { header: "nota", key: "nota", width: 12 },
      { header: "actividad", key: "actividad", width: 28 },
    ];
    sheet.addRow({
      documento: "1070000001",
      asignatura: "Matemáticas",
      periodo: 1,
      dimension: "SABER",
      nota: 4.5,
      actividad: "Definitiva migrada SIGA",
    });
  } else {
    // BILLING_BALANCES
    sheet.columns = [
      { header: "documento", key: "documento", width: 18 },
      { header: "mes", key: "mes", width: 16 },
      { header: "valor_pagado", key: "valor_pagado", width: 18 },
      { header: "canal", key: "canal", width: 18 },
      { header: "referencia", key: "referencia", width: 22 },
      { header: "fecha_pago", key: "fecha_pago", width: 15 },
    ];
    sheet.addRow({
      documento: "1070000002",
      mes: "Noviembre",
      valor_pagado: 420000,
      canal: "NEQUI",
      referencia: "MIG-NOV-2026-001",
      fecha_pago: "2026-11-10",
    });
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF303296" } };
  headerRow.height = 24;

  const guide = wb.addWorksheet("Instrucciones");
  guide.columns = [{ header: "Guía de diligenciamiento · Campus Lunita", key: "info", width: 88 }];
  guide.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  guide.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F1747" } };
  const notes = [
    "1. Conserva los nombres de las columnas en la fila 1 de la pestaña 'Datos a migrar'.",
    "2. Reemplaza o elimina la fila de ejemplo antes de cargar el archivo real del colegio.",
    "3. El sistema ejecuta primero una validación previa (Vista Previa) sin modificar la base de datos.",
    "4. La clave única de cruce de identidad es el número de documento (sin puntos ni espacios).",
    "5. Toda migración queda registrada en la bitácora auditable con fecha, usuario e IP.",
  ];
  for (const n of notes) guide.addRow({ info: n });

  const buf = await wb.xlsx.writeBuffer();
  const names: Record<Exclude<MigrationSourceKind, "MOODLE_QUIZ_XML">, string> = {
    STUDENTS_FAMILIES: "plantilla-migracion-estudiantes-familias.xlsx",
    HISTORICAL_GRADES: "plantilla-migracion-notas-siee.xlsx",
    BILLING_BALANCES: "plantilla-migracion-cartera-feb-nov.xlsx",
  };

  return {
    buffer: Buffer.from(buf),
    fileName: names[kind],
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
