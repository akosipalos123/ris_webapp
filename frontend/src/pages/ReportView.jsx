import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api";
import { Link, useNavigate, useParams } from "react-router-dom";

function formatName(p) {
  if (!p) return "-";
  const parts = [p.lastName, p.firstName, p.middleName].filter(Boolean);
  const base = parts.join(", ");
  return p.suffix ? `${base} ${p.suffix}` : base;
}

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style: "currency", currency: "PHP" });
}

export default function ReportView() {
  const nav = useNavigate();
  const { appointmentId } = useParams();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState(null);

  const printableTitle = useMemo(() => {
    const d = data?.appointment?.date ? ` • ${data.appointment.date}` : "";
    return `RIS Report${d}`;
  }, [data]);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) return nav("/login");

      try {
        setLoading(true);
        setMsg("");
        const resp = await apiGet(`/api/report/${appointmentId}`, token);
        setData(resp);
      } catch (err) {
        setMsg(err.message || "Failed to load report");
      } finally {
        setLoading(false);
      }
    })();
  }, [nav, appointmentId]);

  return (
    <div className="min-vh-100" style={{ background: "#f5f6f8" }}>
      <div className="container py-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0">{printableTitle}</h1>
            <div className="text-muted">Appointment report (billing + images + results)</div>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => window.print()}>
              Print
            </button>
            <Link to="/profile" className="btn btn-outline-secondary btn-sm">
              Back
            </Link>
          </div>
        </div>

        {msg ? <div className="alert alert-warning">{msg}</div> : null}

        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            {loading ? (
              <div className="text-muted">Loading...</div>
            ) : !data ? (
              <div className="text-muted">No report found.</div>
            ) : (
              <>
                {/* Patient */}
                <div className="mb-4">
                  <div className="fw-semibold">Patient</div>
                  <div className="text-muted">{formatName(data.patient)}</div>
                  <div className="text-muted small">
                    Email: {data.patient?.email || "-"} • Contact: {data.patient?.contactNumber || "-"}
                  </div>
                </div>

                {/* Appointment */}
                <div className="mb-4">
                  <div className="fw-semibold">Appointment</div>
                  <div className="text-muted">
                    {data.appointment?.procedure || "-"} • {data.appointment?.date || "-"} • Status:{" "}
                    {data.appointment?.status || "-"}
                  </div>
                </div>

                {/* Result */}
                <div className="mb-4">
                  <div className="fw-semibold">Result</div>
                  <div className="border rounded p-3 bg-light">
                    {data.result?.resultNotes ? data.result.resultNotes : "No notes."}
                  </div>
                  {data.result?.resultPdfUrl ? (
                    <div className="mt-2 d-flex flex-wrap gap-2">
                      <a
                        className="btn btn-sm btn-outline-primary"
                        href={data.result.resultPdfUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Result PDF
                      </a>
                    </div>
                  ) : null}
                </div>

                {/* Billing */}
                <div className="mb-4">
                  <div className="fw-semibold">Billing</div>
                  {!data.bill ? (
                    <div className="text-muted">No bill issued yet.</div>
                  ) : (
                    <>
                      <div className="text-muted small mb-2">
                        Status: <span className="fw-semibold">{data.bill.status}</span> • Total:{" "}
                        <span className="fw-semibold">{money(data.bill.totalAmount)}</span>
                      </div>
                      {Array.isArray(data.bill.items) && data.bill.items.length > 0 ? (
                        <ul className="list-group">
                          {data.bill.items.map((it, idx) => (
                            <li key={idx} className="list-group-item d-flex justify-content-between">
                              <span>{it.label}</span>
                              <span className="fw-semibold">{money(it.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted">No bill items.</div>
                      )}
                    </>
                  )}
                </div>

                {/* Images */}
                <div>
                  <div className="fw-semibold">Diagnostic Images</div>
                  {Array.isArray(data.images) && data.images.length > 0 ? (
                    <div className="row g-3 mt-1">
                      {data.images.map((img) => (
                        <div className="col-12 col-md-6 col-lg-4" key={img._id}>
                          <div className="border rounded bg-white p-2 h-100">
                            <img
                              src={img.imageUrl}
                              alt={img.caption || "Diagnostic"}
                              className="img-fluid rounded border"
                              style={{ width: "100%", height: 220, objectFit: "cover" }}
                            />
                            <div className="mt-2">
                              <div className="fw-semibold small">{img.radiographType || "Radiograph"}</div>
                              <div className="text-muted small">{img.caption || "—"}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted">No images uploaded yet.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="text-center text-muted mt-3" style={{ fontSize: 12 }}>
          RISWebApp • Local Dev
        </div>
      </div>
    </div>
  );
}
