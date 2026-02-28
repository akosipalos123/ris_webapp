import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api";
import { Link, useNavigate } from "react-router-dom";

function formatMoney(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString(undefined, { style: "currency", currency: "PHP" });
}

function fmtDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
}

/**
 * Billing is NOT implemented in your backend yet.
 * This page tries:
 *  - GET /api/billing/mine
 * If it 404s, it shows a friendly "not implemented" message and a dummy UI.
 */
export default function BillingDashboard() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [bills, setBills] = useState([]);

  const [filters, setFilters] = useState({
    status: "",
    from: "",
    to: "",
  });

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) return nav("/login");

      try {
        setLoading(true);
        setMsg("");

        // Future backend route (not yet implemented):
        const data = await apiGet("/api/billing/mine", token);
        setBills(Array.isArray(data) ? data : []);
      } catch (err) {
        // Graceful: backend may not have this endpoint yet
        setBills([]);
        setMsg(
          err.message?.includes("Request failed")
            ? "Billing endpoint not available yet (backend not implemented)."
            : err.message
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  function onFilterChange(e) {
    const { name, value } = e.target;
    setFilters((p) => ({ ...p, [name]: value }));
  }

  const filtered = useMemo(() => {
    const from = filters.from ? new Date(filters.from) : null;
    const to = filters.to ? new Date(filters.to) : null;

    return bills.filter((b) => {
      if (filters.status && String(b.status || "") !== filters.status) return false;

      const createdAt = b.createdAt ? new Date(b.createdAt) : null;
      if (from && createdAt && createdAt < from) return false;
      if (to && createdAt && createdAt > to) return false;

      return true;
    });
  }, [bills, filters]);

  return (
    <div className="min-vh-100" style={{ background: "#f5f6f8" }}>
      <div className="container py-4 py-md-5">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
          <div>
            <h1 className="h4 mb-0">My Bills</h1>
            <div className="text-muted">Billing dashboard (placeholder until backend is ready)</div>
          </div>

          <div className="d-flex gap-2">
            <Link to="/profile" className="btn btn-outline-secondary">
              Back
            </Link>
          </div>
        </div>

        {msg ? <div className="alert alert-warning">{msg}</div> : null}

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body p-3 p-md-4">
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-4">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  name="status"
                  value={filters.status}
                  onChange={onFilterChange}
                  disabled={loading}
                >
                  <option value="">All</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Voided">Voided</option>
                </select>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label">From</label>
                <input
                  type="date"
                  className="form-control"
                  name="from"
                  value={filters.from}
                  onChange={onFilterChange}
                  disabled={loading}
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label">To</label>
                <input
                  type="date"
                  className="form-control"
                  name="to"
                  value={filters.to}
                  onChange={onFilterChange}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="p-4 text-muted">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-muted">
                No bills found (or billing not implemented yet).
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ minWidth: 160 }}>Bill #</th>
                      <th style={{ minWidth: 160 }}>Date</th>
                      <th style={{ minWidth: 200 }}>Description</th>
                      <th style={{ minWidth: 140 }}>Amount</th>
                      <th style={{ minWidth: 140 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => (
                      <tr key={b._id || b.billNo}>
                        <td className="fw-semibold">{b.billNo || b._id || "-"}</td>
                        <td className="text-muted">{fmtDate(b.createdAt)}</td>
                        <td>{b.description || "-"}</td>
                        <td>{formatMoney(b.amount)}</td>
                        <td>
                          <span className="badge text-bg-secondary">{b.status || "-"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
