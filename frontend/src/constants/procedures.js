// frontend/src/constants/procedures.js

export const XRAY_BILLING_ITEMS = [
  { code: "CHEST_ADULT", label: "Chest — Adult (above 12 y.o.)", fee: 200.0 },
  { code: "CHEST_PEDIA", label: "Chest — Pedia (0 to 12 y.o.)", fee: 240.0 },
  { code: "EXTREMITIES", label: "Extremities (Upper and Lower)", fee: 260.0 },
  { code: "JOINTS", label: "Joints", fee: 260.0 },
  { code: "SKULL", label: "Skull", fee: 300.0 },
  { code: "VERTEBRAL_COLUMN", label: "Vertebral Column", fee: 380.0 },
  { code: "FOREIGN_BODY_LOCALIZATION", label: "Localization of Foreign Body", fee: 260.0 },
  { code: "PELVIS", label: "Pelvis", fee: 300.0 },
  { code: "SHOULDER_GIRDLE", label: "Shoulder Girdle", fee: 240.0 },
  { code: "THORACIC_CAGE", label: "Thoracic Cage", fee: 200.0 },
  { code: "ABDOMEN", label: "Abdomen", fee: 380.0 },
];

export const XRAY_PROCEDURE_LABELS = XRAY_BILLING_ITEMS.map((x) => x.label);

export function formatPhp(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return "Php 0.00";
  return `Php ${num.toFixed(2)}`;
}

export function findXrayBillingByLabel(label) {
  const v = String(label || "").trim();
  if (!v) return null;
  return XRAY_BILLING_ITEMS.find((x) => x.label === v) || null;
}