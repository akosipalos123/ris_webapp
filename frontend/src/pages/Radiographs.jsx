import { useEffect, useState } from "react";
import { apiGet } from "../api";
import { Link, useNavigate } from "react-router-dom";

export default function Radiographs() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [types, setTypes] = useState([]);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) return nav("/login");

      try {
        setLoading(true);
        setMsg("");
        const data = await apiGet("/api/radiographs", token);
        setTypes(Array.isArray(data?.types) ? data.types : []);
      } catch (err) {
        setMsg(err.message || "Failed to load radiograph types");
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  return (
    <div className="min-vh-100" style={{ background: "#f5f6f8" }}>
      <div className="container py-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0">Types of Radiographs</h1>
            <div className="text-muted">Browse supported radiograph categories</div>
          </div>
          <Link to="/profile" className="btn btn-outline-secondary btn-sm">
            Back
          </Link>
        </div>

        {msg ? <div className="alert alert-warning">{msg}</div> : null}

        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            {loading ? (
              <div className="text-muted">Loading...</div>
            ) : types.length === 0 ? (
              <div className="text-muted">No radiograph types configured.</div>
            ) : (
              <ul className="list-group">
                {types.map((t) => (
                  <li key={t} className="list-group-item d-flex justify-content-between">
                    <span>{t}</span>
                    <span className="badge text-bg-secondary">X-Ray</span>
                  </li>
                ))}
              </ul>
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
