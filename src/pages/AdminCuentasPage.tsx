import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { UserAccount, UserRole } from "../services/recepcionesService";
import { fetchMyRole, fetchUsers, setUserRole } from "../services/recepcionesService";

function roleBadge(role: UserRole) {
  switch (role) {
    case "admin":
      return "badge text-bg-danger";
    case "operador":
      return "badge text-bg-primary";
    case "usuario":
    default:
      return "badge text-bg-secondary";
  }
}

function prettyRole(role: UserRole) {
  switch (role) {
    case "admin":
      return "Admin";
    case "operador":
      return "Operador";
    case "usuario":
    default:
      return "Usuario";
  }
}

export default function AdminCuentasPage() {
  const { user } = useAuth();

  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [rows, setRows] = useState<UserAccount[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ Verifica rol (sin redirigir a Home)
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setMyRole(null);
      setRoleLoading(false);
      return;
    }

    setRoleLoading(true);
    (async () => {
      try {
        const r = await fetchMyRole(uid);
        setMyRole(r);
      } catch (e: any) {
        setErr(`${e?.code ?? ""} ${e?.message ?? "No se pudo leer tu rol"}`.trim());
        setMyRole(null);
      } finally {
        setRoleLoading(false);
      }
    })();
  }, [user?.uid]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchUsers();
      setRows(data);
    } catch (e: any) {
      setErr(`${e?.code ?? ""} ${e?.message ?? "Error cargando usuarios"}`.trim());
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (myRole === "admin") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((u) => {
      const text = [
        u.uid,
        u.email ?? "",
        u.nombre ?? "",
        u.apellido ?? "",
        u.displayName ?? "",
        u.role ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(s);
    });
  }, [rows, q]);

  async function onChangeRole(uid: string, next: UserRole) {
    setErr(null);

    // UI optimista
    setRows((prev) => prev.map((u) => (u.uid === uid ? { ...u, role: next } : u)));

    try {
      await setUserRole(uid, next);
      await load();
    } catch (e: any) {
      setErr(`${e?.code ?? ""} ${e?.message ?? "Error cambiando rol"}`.trim());
      await load();
    }
  }

  if (!user) {
    return (
      <div className="container py-5" style={{ maxWidth: 1100 }}>
        <div className="alert alert-warning mb-3">Debes iniciar sesión.</div>
        <Link to="/login" className="btn btn-primary">
          Ir a Login
        </Link>
      </div>
    );
  }

  if (roleLoading) {
    return (
      <div className="container py-5" style={{ maxWidth: 1100 }}>
        <div className="alert alert-info mb-0">Verificando permisos…</div>
      </div>
    );
  }

  const isAdmin = myRole === "admin";

  return (
    <div className="container py-4" style={{ maxWidth: 1100 }}>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h2 className="mb-0">Administrador de cuentas</h2>
          <small className="text-muted">
            Solo Admin. Cambia roles: <code>usuario</code> / <code>operador</code> / <code>admin</code>.
          </small>

          <div className="small text-muted mt-1">
            UID: <code>{user.uid}</code> · Rol leído:{" "}
            <span className={roleBadge((myRole ?? "usuario") as UserRole)}>
              {prettyRole((myRole ?? "usuario") as UserRole)}
            </span>
          </div>
        </div>

        <div className="d-flex gap-2">
          <Link to="/" className="btn btn-outline-primary btn-sm">
            Volver a Home
          </Link>
          <Link to="/recepciones" className="btn btn-outline-secondary btn-sm">
            Volver a Recepciones
          </Link>
        </div>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

      {!isAdmin ? (
        <div className="alert alert-warning">
          No autorizado: esta sección es solo para <b>Admin</b>. <br />
          Si tu cuenta debería ser admin, revisa que exista el documento{" "}
          <code>/users/{user.uid}</code> con <code>role: "admin"</code> y que tus Firestore Rules
          permitan leer tu propio perfil.
        </div>
      ) : (
        <>
          <div className="card card-body mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-6">
                <label className="form-label">Buscar</label>
                <input
                  className="form-control"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nombre, email, uid o rol…"
                />
              </div>

              <div className="col-12 col-md-3">
                <div className="text-muted small">Tu cuenta</div>
                <div>
                  <span className="badge text-bg-dark">UID</span>{" "}
                  <code>{user.uid.slice(0, 10)}…</code>{" "}
                  <span className={roleBadge(myRole)}>
                    {prettyRole(myRole)}
                  </span>
                </div>
              </div>

              <div className="col-12 col-md-3 d-grid">
                <button className="btn btn-outline-primary" onClick={() => void load()} disabled={loading}>
                  {loading ? "Cargando…" : "Actualizar lista"}
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="alert alert-info">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="alert alert-info">No hay usuarios para ese filtro.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>UID</th>
                    <th>Rol</th>
                    <th className="text-end">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const fullName =
                      u.displayName ||
                      [u.nombre, u.apellido].filter(Boolean).join(" ") ||
                      "—";

                    const isMe = u.uid === user.uid;

                    return (
                      <tr key={u.uid}>
                        <td>
                          <div className="fw-semibold">{fullName}</div>
                          <div className="text-muted small">
                            {(u.nombre || u.apellido) ? (
                              <>
                                <span className="badge text-bg-secondary">perfil</span>{" "}
                                {u.nombre ?? ""} {u.apellido ?? ""}
                              </>
                            ) : (
                              <span className="text-muted">sin perfil</span>
                            )}
                          </div>
                        </td>
                        <td>{u.email ?? "—"}</td>
                        <td>
                          <code>{u.uid}</code>
                        </td>
                        <td>
                          <span className={roleBadge(u.role)}>{prettyRole(u.role)}</span>
                          {isMe && (
                            <span className="badge text-bg-dark ms-2" title="Esta es tu cuenta">
                              tú
                            </span>
                          )}
                        </td>
                        <td className="text-end" style={{ minWidth: 260 }}>
                          <div className="d-flex justify-content-end gap-2 flex-wrap">
                            <select
                              className="form-select form-select-sm"
                              style={{ maxWidth: 170 }}
                              value={u.role}
                              onChange={(e) => void onChangeRole(u.uid, e.target.value as UserRole)}
                              disabled={isMe} // evita auto-cambio accidental
                              title={isMe ? "No cambies tu propio rol desde aquí" : "Cambiar rol"}
                            >
                              <option value="usuario">usuario</option>
                              <option value="operador">operador</option>
                              <option value="admin">admin</option>
                            </select>

                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => navigator.clipboard.writeText(u.uid)}
                            >
                              Copiar UID
                            </button>
                          </div>

                          {isMe && (
                            <div className="text-muted small mt-1">
                              * Tu rol se bloquea aquí para evitar auto-bloqueo.
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-muted small mt-3">
            Nota: para que esto funcione, las <b>Firestore Rules</b> deben permitir que <code>admin</code> lea y actualice <code>/users</code>.
          </div>
        </>
      )}
    </div>
  );
}
