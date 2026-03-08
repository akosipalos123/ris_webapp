// frontend/src/pages/AdminReportView.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { apiGet } from "../api";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/* ---------------- Helpers ---------------- */
function safe(v) {
  return String(v || "").trim();
}

function getAuthTokenAny() {
  return localStorage.getItem("adminToken") || localStorage.getItem("token") || "";
}

function getRoleClean(me) {
  return String(me?.role || me?.userType || "").trim().toLowerCase();
}

function isAdminRole(me) {
  const r = getRoleClean(me);
  return me?.isAdmin === true || r === "admin" || r === "superadmin";
}

function ageFromBirthdate(birthdate) {
  if (!birthdate) return "";
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return String(age);
}

function apptDateText(appt) {
  if (appt?.year && appt?.month && appt?.day) {
    return `${String(appt.year)}-${String(appt.month).padStart(2, "0")}-${String(appt.day).padStart(2, "0")}`;
  }
  if (appt?.date) {
    const d = new Date(appt.date);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (appt?.createdAt) {
    const d = new Date(appt.createdAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return "";
}

function wrapText(text, font, fontSize, maxWidth) {
  const t = safe(text);
  if (!t) return [];
  const words = t.replace(/\s+/g, " ").split(" ");
  const lines = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function getAnyBirthdate(p) {
  return p?.birthdate || p?.dob || p?.birthDate || p?.dateOfBirth || p?.birthday || "";
}

function getAnySex(p) {
  return safe(p?.sex || p?.gender || p?.mf || p?.sexAtBirth || "").toUpperCase();
}

function buildFullName(p) {
  if (!p || typeof p !== "object") return "—";
  const base = [safe(p.lastName), safe(p.firstName), safe(p.middleName)].filter(Boolean).join(", ");
  const suf = safe(p.suffix);
  return `${base}${suf ? `, ${suf}` : ""}`.trim() || "—";
}

/* ---------------- Component ---------------- */
export default function AdminReportView() {
  const nav = useNavigate();
  const { appointmentId } = useParams();

  const iframeRef = useRef(null);
  const blobUrlRef = useRef("");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");

  const TEMPLATE_URL = `${import.meta.env.BASE_URL}images/format.pdf`;

  // cleanup blob url on unmount
  useEffect(() => {
    return () => {
      try {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      } catch {
        // ignore
      }
    };
  }, []);

  async function validateAdminSession(authToken) {
    // ✅ Try admin session first (adminToken path)
    try {
      await apiGet("/api/admin/auth/me", authToken);
      return true;
    } catch {
      // ✅ Fallback: normal token but must have admin role
      try {
        const me = await apiGet("/api/auth/me", authToken);
        return isAdminRole(me);
      } catch {
        return false;
      }
    }
  }

  async function buildAndLoadPdf() {
    const authToken = getAuthTokenAny();
    if (!authToken) {
      nav("/login");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const ok = await validateAdminSession(authToken);
      if (!ok) {
        // If token is valid but not admin, AdminRoute usually sends to /profile.
        // This keeps behavior consistent.
        nav("/profile");
        return;
      }

      // fetch candidates (matches AdminDataRecords strategy)
      const [completedRes, approvedRes] = await Promise.all([
        apiGet("/api/admin/appointments?status=Completed", authToken),
        apiGet("/api/admin/appointments?status=Approved", authToken),
      ]);

      const completed = Array.isArray(completedRes) ? completedRes : [];
      const approved = Array.isArray(approvedRes) ? approvedRes : [];
      const merged = [...completed, ...approved];

      const appt = merged.find((a) => String(a?._id) === String(appointmentId));
      if (!appt) throw new Error("Report not found for this appointment (admin).");

      const patient = typeof appt.patientId === "object" ? appt.patientId : null;

      // template fields
      const fullName = buildFullName(patient);
      const accession = safe(appt.accession) || String(appt._id || "").slice(-8).toUpperCase() || "—";

      const sex = getAnySex(patient) || "—";
      const age = ageFromBirthdate(getAnyBirthdate(patient)) || "—";

      const bodyPart = safe(appt.bodyPart) || safe(appt.radiographType) || safe(appt.procedure) || "—";
      const refPhy =
        safe(appt.refPhy) ||
        safe(appt.refPhysician) ||
        safe(appt.referringPhysician) ||
        safe(appt.requestingPhysician) ||
        "—";

      const studyDate = apptDateText(appt) || "—";
      const auditor = safe(appt.auditor) || safe(appt.radTech) || "—";

      const description = safe(appt.findings) || safe(appt.resultNotes) || safe(appt.description) || "";
      const diagnosis = safe(appt.impression) || safe(appt.interpretation) || safe(appt.diagnosis) || "";

      // load template pdf
      const tplRes = await fetch(TEMPLATE_URL);
      if (!tplRes.ok) throw new Error("Cannot load report template PDF (/images/format.pdf).");
      const tplBytes = await tplRes.arrayBuffer();

      const pdfDoc = await PDFDocument.load(tplBytes);
      const page = pdfDoc.getPages()[0];
      const { height } = page.getSize();

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // coordinates
      const POS = {
        name: { x: 110, y: height - 180 },
        accession: { x: 455, y: height - 180 },

        sex: { x: 110, y: height - 198 },
        age: { x: 370, y: height - 198 },

        bodyPart: { x: 110, y: height - 216 },
        refPhy: { x: 380, y: height - 216 },

        date: { x: 110, y: height - 234 },
        auditor: { x: 400, y: height - 234 },

        description: { x: 60, y: height - 305, maxWidth: 480, lineHeight: 14, maxLines: 10 },
        diagnosis: { x: 60, y: height - 415, maxWidth: 480, lineHeight: 14, maxLines: 8 },
      };

      const textColor = rgb(0, 0, 0);
      const fsSmall = 11;
      const fsBody = 11;

      // header fields
      page.drawText(fullName || "—", { x: POS.name.x, y: POS.name.y, size: fsSmall, font, color: textColor });
      page.drawText(accession || "—", { x: POS.accession.x, y: POS.accession.y, size: fsSmall, font, color: textColor });

      page.drawText(sex || "—", { x: POS.sex.x, y: POS.sex.y, size: fsSmall, font, color: textColor });
      page.drawText(age || "—", { x: POS.age.x, y: POS.age.y, size: fsSmall, font, color: textColor });

      page.drawText(bodyPart || "—", { x: POS.bodyPart.x, y: POS.bodyPart.y, size: fsSmall, font, color: textColor });
      page.drawText(refPhy || "—", { x: POS.refPhy.x, y: POS.refPhy.y, size: fsSmall, font, color: textColor });

      page.drawText(studyDate || "—", { x: POS.date.x, y: POS.date.y, size: fsSmall, font, color: textColor });
      page.drawText(auditor || "—", { x: POS.auditor.x, y: POS.auditor.y, size: fsSmall, font, color: textColor });

      // blocks
      if (description) {
        const lines = wrapText(description, font, fsBody, POS.description.maxWidth).slice(0, POS.description.maxLines);
        let y = POS.description.y;
        for (const line of lines) {
          page.drawText(line, { x: POS.description.x, y, size: fsBody, font, color: textColor });
          y -= POS.description.lineHeight;
        }
      }

      if (diagnosis) {
        const lines = wrapText(diagnosis, font, fsBody, POS.diagnosis.maxWidth).slice(0, POS.diagnosis.maxLines);
        let y = POS.diagnosis.y;
        for (const line of lines) {
          page.drawText(line, { x: POS.diagnosis.x, y, size: fsBody, font: bold, color: textColor });
          y -= POS.diagnosis.lineHeight;
        }
      }

      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      try {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      } catch {
        // ignore
      }
      blobUrlRef.current = url;
      setPdfUrl(url);
    } catch (e) {
      setPdfUrl("");
      setMsg(e?.message || "Failed to generate admin report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    buildAndLoadPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  function tryPrint() {
    try {
      if (!iframeRef.current) return;
      iframeRef.current.contentWindow?.focus?.();
      iframeRef.current.contentWindow?.print?.();
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>Full Radiographic Report (Admin)</div>
          <div style={{ color: "#64748b", fontWeight: 700, marginTop: 2 }}>
            Generated from template and filled with appointment + patient details.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/admin/data-records" style={{ textDecoration: "none", fontWeight: 900 }}>
            ← Back
          </Link>

          <button
            type="button"
            onClick={buildAndLoadPdf}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "2px solid #0b3d2e",
              background: "#fff",
              color: "#0b3d2e",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={tryPrint}
            disabled={!pdfUrl}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "2px solid #0b3d2e",
              background: "#0b3d2e",
              color: "#fff",
              fontWeight: 900,
              cursor: !pdfUrl ? "not-allowed" : "pointer",
            }}
          >
            Print
          </button>

          {pdfUrl ? (
            <a
              href={pdfUrl}
              download={`admin_report_${appointmentId}.pdf`}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "2px solid #0b3d2e",
                background: "#fff",
                color: "#0b3d2e",
                fontWeight: 900,
                textDecoration: "none",
              }}
            >
              Download
            </a>
          ) : null}
        </div>
      </div>

      {msg ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #f59e0b",
            background: "#fffbeb",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div style={{ marginTop: 12, border: "2px solid #0b3d2e", borderRadius: 12, overflow: "hidden", height: "82vh" }}>
        {loading ? (
          <div style={{ padding: 14, color: "#64748b", fontWeight: 800 }}>Generating PDF…</div>
        ) : pdfUrl ? (
          <iframe
            ref={iframeRef}
            title="Admin Full Report PDF"
            src={pdfUrl}
            style={{ width: "100%", height: "100%", border: 0 }}
            onLoad={() => setTimeout(() => tryPrint(), 350)}
          />
        ) : (
          <div style={{ padding: 14, color: "#64748b", fontWeight: 800 }}>No PDF generated.</div>
        )}
      </div>
    </div>
  );
}