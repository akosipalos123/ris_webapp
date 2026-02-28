import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api";
import { Link, useNavigate } from "react-router-dom";

export default function DiagnosticImages() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [images, setImages] = useState([]);
  const [appointmentId, setAppointmentId] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (appointmentId.trim()) p.set("appointmentId", appointmentId.trim());
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [appointmentId]);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) return nav("/login");

      try {
        setLoading(true);
        setMsg("");
        const data = await apiGet(`/api/diagnostic-images/mine${query}`, token);
        setImages(Array.isArray(data) ? data : []);
      } catch (err) {
        setMsg(err.message || "Failed to load images");
      } finally {
        setLoading(false);
      }
    })();
  }, [nav, query]);

  return (
    <div className="min-vh-100" style={{ background: "#f5f6f8" }}>
      <div className="container py-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0">Diagnostic Images</h1>
            <div className="text-muted">Image gallery stored per appointment</div>
          </div>
          <Link to="/profile" className="btn btn-outline-secondary btn-sm">
            Back
          </Link>
        </div>

        {msg ? <div className="alert alert-warning">{msg}</div> : null}

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body p-3">
            <label className="form-label">Filter by Appointment ID (optional)</label>
            <input
              className="form-control"
              value={appointmentId}
              onChange={(e) => setAppointmentId(e.target.value)}
              placeholder="Paste appointmentId to filter..."
            />
            <div className="form-text">Leave blank to view all your images.</div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            {loading ? (
              <div className="text-muted">Loading...</div>
            ) : images.length === 0 ? (
              <div className="text-muted">No images found yet.</div>
            ) : (
              <div className="row g-3">
                {images.map((img) => (
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
                        <div className="text-muted small mt-1">
                          {img.uploadedAt ? new Date(img.uploadedAt).toLocaleString() : "-"}
                        </div>
                        <div className="mt-2">
                          <Link className="btn btn-sm btn-outline-primary" to={`/report/${img.appointmentId}`}>
                            View Report
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
