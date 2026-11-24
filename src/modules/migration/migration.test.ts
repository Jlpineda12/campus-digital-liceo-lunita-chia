import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeHistoricalLabel,
  parseBillingBalancesRows,
  parseCsvText,
  parseHistoricalGradesRows,
  parseMoodleQuizXml,
  parseStudentsFamiliesRows,
} from "./parsers";

describe("Fase 5 · Motor ETL de Migración (SIGA, Cartera y Moodle XML)", () => {
  it("parsea CSV con separador coma o punto y coma y corrige erratas históricas", () => {
    const csv = "\uFEFFdocumento;nombres;apellidos;grupo\n1070.123.456;Ana;Gómez;7A\n";
    const rows = parseCsvText(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.documento, "1070.123.456");
    assert.equal(normalizeHistoricalLabel("Trasición"), "Transición");
  });

  it("valida y deduplica estudiantes y acudientes por número de documento", () => {
    const res = parseStudentsFamiliesRows([
      {
        tipo_doc: "TI",
        documento: "1.070.999.001",
        nombres: "Camila",
        apellidos: "Rojas",
        grupo: "7a",
        documento_acudiente: "52.999.001",
        nombres_acudiente: "Andrea",
        apellidos_acudiente: "Beltrán",
        parentesco: "MADRE",
      },
      {
        tipo_doc: "TI",
        documento: "1070999001",
        nombres: "Camila",
        apellidos: "Rojas",
        grupo: "7A",
      },
      {
        documento: "12",
        nombres: "Incompleto",
        apellidos: "",
        grupo: "",
      },
    ]);

    assert.equal(res.valid.length, 1);
    assert.equal(res.valid[0]!.documentNumber, "1070999001");
    assert.equal(res.valid[0]!.groupName, "7A");
    assert.equal(res.valid[0]!.guardianDoc, "52999001");
    assert.equal(res.issues.filter((i) => i.severity === "warning").length, 1);
    assert.equal(res.issues.filter((i) => i.severity === "error").length, 1);
  });

  it("valida notas históricas SIEE (1.0 – 5.0 y periodos 1 – 4)", () => {
    const res = parseHistoricalGradesRows([
      { documento: "1070000001", asignatura: "Matemáticas", periodo: "1", dimension: "SABER", nota: "4,56" },
      { documento: "1070000001", asignatura: "Matemáticas", periodo: "5", dimension: "SABER", nota: "4.0" },
      { documento: "1070000001", asignatura: "Matemáticas", periodo: "2", dimension: "HACER", nota: "6.2" },
    ]);

    assert.equal(res.valid.length, 1);
    assert.equal(res.valid[0]!.score, 4.6);
    assert.equal(res.issues.length, 2);
  });

  it("parsea pagos históricos del Mega-Excel escolar (Matrícula y Feb–Nov)", () => {
    const res = parseBillingBalancesRows([
      { documento: "1070000002", mes: "Noviembre", valor_pagado: "$420.000", canal: "NEQUI", referencia: "NQ-1" },
      { documento: "1070000002", mes: "Matricula", valor_pagado: "650000", canal: "PSE", referencia: "PSE-2" },
      { documento: "1070000002", mes: "Diciembre", valor_pagado: "420000" },
    ]);

    assert.equal(res.valid.length, 2);
    assert.equal(res.valid[0]!.billingMonth, 11);
    assert.equal(res.valid[0]!.paidCop, 420000);
    assert.equal(res.valid[1]!.billingMonth, 0);
    assert.equal(res.issues.length, 1);
  });

  it("importa bancos Moodle XML (multichoice y truefalse) y bloquea XXE (DOCTYPE/ENTITY)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="multichoice">
    <questiontext><text><![CDATA[<p>¿Cuánto es 2 + 2?</p>]]></text></questiontext>
    <defaultgrade>2</defaultgrade>
    <single>true</single>
    <answer fraction="100"><text>4</text></answer>
    <answer fraction="0"><text>5</text></answer>
  </question>
  <question type="truefalse">
    <questiontext><text>Chía está en Cundinamarca.</text></questiontext>
    <answer fraction="100"><text>true</text></answer>
    <answer fraction="0"><text>false</text></answer>
  </question>
</quiz>`;

    const ok = parseMoodleQuizXml(xml);
    assert.equal(ok.valid.length, 2);
    assert.equal(ok.valid[0]!.questionType, "SINGLE_CHOICE");
    assert.equal(ok.valid[0]!.prompt, "¿Cuánto es 2 + 2?");
    assert.equal(ok.valid[1]!.questionType, "TRUE_FALSE");
    assert.equal(ok.valid[1]!.options[0]!.label, "Verdadero");

    const xxe = parseMoodleQuizXml(`<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><quiz></quiz>`);
    assert.equal(xxe.valid.length, 0);
    assert.equal(xxe.issues[0]!.severity, "error");
  });
});
