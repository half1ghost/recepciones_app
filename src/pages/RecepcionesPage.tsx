import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import type { Actividad, Reserva, ReservaEstado, ActividadTipo } from "../types/recepcion";
import {
  fetchActividadesByFecha,
  fetchReservasByFecha,
  setReservaEstado,
  createActividad,
  updateActividadTipo,
} from "../services/recepcionesService";

import { auth, db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function badgeClass(estado: ReservaEstado) {
  switch (estado) {
    case "recepcionada":
      return "badge text-bg-success";
    case "no_asistio":
      return "badge text-bg-warning";
    case "anulada":
      return "badge text-bg-danger";
    case "confirmada":
      return "badge text-bg-primary";
    default:
      return "badge text-bg-secondary";
  }
}

function prettyEstado(estado: ReservaEstado) {
  switch (estado) {
    case "recepcionada":
      return "Recepcionada";
    case "no_asistio":
      return "No asistió";
    case "anulada":
      return "Anulada";
    case "confirmada":
      return "Confirmada";
    default:
      return "Pendiente";
  }
}

function isStaff(role: string | null) {
  return role === "admin" || role === "operador";
}

export default function RecepcionesPage() {
  const { user } = useAuth();

  const [fecha, setFecha] = useState(todayISO());
  const [actividadId, setActividadId] = useState("");
  const [q, setQ] = useState("");

  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // role desde /users/{uid}
  const [role, setRole] = useState<string | null>(null);

  // Crear actividad
  const [newTipo, setNewTipo] = useState<ActividadTipo>("senderismo");
  const [newTitulo, setNewTitulo] = useState("");
  const [newHora, setNewHora] = useState("09:00");
  const [newCupo, setNewCupo] = useState(20);
  const [newDesc, setNewDesc] = useState("");
  const [creatingAct, setCreatingAct] = useState(false);

  // Migración tipo
  const [tipoDrafts, setTipoDrafts] = useState<Record<string, ActividadTipo>>({});
  const [savingTipoId, setSavingTipoId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [acts, res] = await Promise.all([
        fetchActividadesByFecha(fecha),
        fetchReservasByFecha(fecha),
      ]);
      setActividades(acts);
      setReservas(res);

      // inicializa drafts para las que no tengan tipo
      setTipoDrafts((prev) => {
        const next = { ...prev };
        for (const a of acts) {
          if (!a.tipo && !next[a.id]) next[a.id] = "senderismo";
        }
        return next;
      });
    } catch (e: any) {
      setErr(`${e?.code ?? ""} ${e?.message ?? "Error cargando datos"}`.trim());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  // Lee role
  useEffect(() => {
    const uid = user?.uid ?? null;
    if (!uid) {
      setRole(null);
      return;
    }

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        const r = snap.exists() ? (snap.data() as any).role : null;
        setRole(r ?? null);
      } catch {
        setRole(null);
      }
    })();
  }, [user?.uid]);

  const staff = isStaff(role);
  const isAdmin = role === "admin";

  const actividadesSinTipo = useMemo(
    () => actividades.filter((a) => !a.tipo),
    [actividades]
  );

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();

    return reservas.filter((r) => {
      if (actividadId && r.actividadId !== actividadId) return false;
      if (!search) return true;

      return (
        r.nombre.toLowerCase().includes(search) ||
        r.correo.toLowerCase().includes(search) ||
        r.id.toLowerCase().includes(search)
      );
    });
  }, [reservas, actividadId, q]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const recepcionadas = filtered.filter((r) => r.estado === "recepcionada").length;
    const noAsistio = filtered.filter((r) => r.estado === "no_asistio").length;
    return { total, recepcionadas, noAsistio };
  }, [filtered]);

  async function action(reservaId: string, estado: ReservaEstado) {
    // UI optimista
    setReservas((prev) => prev.map((r) => (r.id === reservaId ? { ...r, estado } : r)));

    try {
      await setReservaEstado(reservaId, estado);
      await load();
    } catch (e: any) {
      setErr(`${e?.code ?? ""} ${e?.message ?? "Error aplicando acción"}`.trim());
      await load();
    }
  }

  async function onCreateActividad(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setCreatingAct(true);
    try {
      await createActividad({
        tipo: newTipo,
        titulo: newTitulo,
        descripcion: newDesc,
        fecha,
        hora: newHora,
        cupo: newCupo,
      });

      setNewTipo("senderismo");
      setNewTitulo("");
      setNewDesc("");
      setNewHora("09:00");
      setNewCupo(20);

      await load();
    } catch (e: any) {
      setErr(`${e?.code ?? ""} ${e?.message ?? "Error creando actividad"}`.trim());
    } finally {
      setCreatingAct(false);
    }
  }

  async function onAssignTipo(actividadIdToUpdate: string) {
    setErr(null);
    const tipo = tipoDrafts[actividadIdToUpdate] ?? "senderismo";
    setSavingTipoId(actividadIdToUpdate);

    try {
      await updateActividadTipo(actividadIdToUpdate, tipo);
      await load();
    } catch (e: any) {
      setErr(`${e?.code ?? ""} ${e?.message ?? "Error asignando tipo"}`.trim());
    } finally {
      setSavingTipoId(null);
    }
  }

  return (
    <div className="container py-4">
      {/* HEADER + BOTONES ADMIN RECUPERADOS */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 className="mb-0">Recepciones</h2>
          <small className="text-muted">Check-in y control de asistencia</small>

          <div className="small text-muted mt-1">
            UID: <code>{user?.uid ?? "—"}</code> · role: <code>{role ?? "—"}</code>
          </div>
        </div>

        <div className="d-flex gap-2 align-items-center flex-wrap">
          <span className="badge text-bg-secondary">Total: {stats.total}</span>
          <span className="badge text-bg-success">Recepcionadas: {stats.recepcionadas}</span>
          <span className="badge text-bg-warning">No asistió: {stats.noAsistio}</span>

          {/* ✅ Volver a Home (admin + operador) */}
          {staff && (
            <Link to="/" className="btn btn-sm btn-outline-primary">
              Volver a Home
            </Link>
          )}

          {/* ✅ Administrador de cuentas (solo admin) */}
          {isAdmin && (
            <Link to="/admin-cuentas" className="btn btn-sm btn-outline-secondary">
              Administrar cuentas
            </Link>
          )}

          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => void signOut(auth)}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* ✅ MIGRACIÓN: Actividades sin tipo */}
      {staff && actividadesSinTipo.length > 0 && (
        <div className="card card-body mb-3 border-warning">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <div className="fw-semibold">Migración: actividades sin tipo</div>
              <div className="small text-muted">
                Estas actividades fueron creadas antes del campo <code>tipo</code>. Asigna el tipo para que el filtro funcione perfecto.
              </div>
            </div>
            <span className="badge text-bg-warning">{actividadesSinTipo.length} sin tipo</span>
          </div>

          <hr />

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Título</th>
                  <th style={{ width: 220 }}>Tipo</th>
                  <th className="text-end" style={{ width: 140 }}>
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {actividadesSinTipo.map((a) => (
                  <tr key={a.id}>
                    <td className="text-muted">{a.hora}</td>
                    <td>
                      <div className="fw-semibold">{a.titulo}</div>
                      <div className="small text-muted">
                        id: <code>{a.id.slice(0, 8)}…</code>
                      </div>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={tipoDrafts[a.id] ?? "senderismo"}
                        onChange={(e) =>
                          setTipoDrafts((prev) => ({
                            ...prev,
                            [a.id]: e.target.value as ActividadTipo,
                          }))
                        }
                      >
                        <option value="senderismo">Senderismo</option>
                        <option value="rafting">Rafting</option>
                        <option value="canopy">Canopy</option>
                        <option value="cabanas">Cabañas</option>
                      </select>
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => void onAssignTipo(a.id)}
                        disabled={savingTipoId === a.id}
                      >
                        {savingTipoId === a.id ? "Guardando…" : "Asignar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Crear actividad */}
      {staff && (
        <form className="card card-body mb-3" onSubmit={onCreateActividad}>
          <div className="fw-semibold">Crear actividad</div>
          <div className="small text-muted mb-2">
            Se creará para la fecha seleccionada: <code>{fecha}</code>
          </div>

          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-2">
              <label className="form-label">Tipo</label>
              <select
                className="form-select"
                value={newTipo}
                onChange={(e) => setNewTipo(e.target.value as ActividadTipo)}
              >
                <option value="senderismo">Senderismo</option>
                <option value="rafting">Rafting</option>
                <option value="canopy">Canopy</option>
                <option value="cabanas">Cabañas</option>
              </select>
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label">Título</label>
              <input
                className="form-control"
                value={newTitulo}
                onChange={(e) => setNewTitulo(e.target.value)}
                placeholder="Ej: Visita guiada"
                required
              />
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label">Hora</label>
              <input
                type="time"
                className="form-control"
                value={newHora}
                onChange={(e) => setNewHora(e.target.value)}
                required
              />
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label">Cupo</label>
              <input
                type="number"
                min={1}
                className="form-control"
                value={newCupo}
                onChange={(e) => setNewCupo(Number(e.target.value))}
                required
              />
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label">Descripción (opcional)</label>
              <input
                className="form-control"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Detalles breves"
              />
            </div>

            <div className="col-12 col-md-1 d-grid">
              <button className="btn btn-success" type="submit" disabled={creatingAct}>
                {creatingAct ? "..." : "Crear"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div className="card card-body mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-3">
            <label className="form-label">Fecha</label>
            <input
              type="date"
              className="form-control"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Actividad</label>
            <select
              className="form-select"
              value={actividadId}
              onChange={(e) => setActividadId(e.target.value)}
            >
              <option value="">Todas</option>
              {actividades.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.hora} — {a.titulo}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-3">
            <label className="form-label">Buscar (nombre/correo/ID)</label>
            <input
              className="form-control"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: Juan / juan@mail.com / id"
            />
          </div>

          <div className="col-12 col-md-2 d-grid">
            <button className="btn btn-outline-primary" onClick={() => void load()}>
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

      {loading ? (
        <div className="alert alert-info">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="alert alert-info">No hay reservas para esos filtros.</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>#</th>
                <th>Actividad</th>
                <th>Visitante</th>
                <th>Correo</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="text-muted">{r.id.slice(0, 6)}…</td>
                  <td>
                    <div className="fw-semibold">{r.actividadTitulo}</div>
                    <small className="text-muted">
                      {r.actividadFecha} · {r.actividadHora}
                    </small>
                  </td>
                  <td>{r.nombre}</td>
                  <td>{r.correo}</td>
                  <td>
                    <span className={badgeClass(r.estado)}>{prettyEstado(r.estado)}</span>
                  </td>
                  <td className="text-end">
                    <div className="d-flex justify-content-end gap-2 flex-wrap">
                      {r.estado !== "anulada" && r.estado !== "recepcionada" && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => void action(r.id, "recepcionada")}
                        >
                          Marcar llegada
                        </button>
                      )}

                      {r.estado !== "anulada" && r.estado !== "no_asistio" && (
                        <button
                          className="btn btn-sm btn-outline-warning"
                          onClick={() => void action(r.id, "no_asistio")}
                        >
                          No asistió
                        </button>
                      )}

                      {r.estado !== "anulada" &&
                        (r.estado === "recepcionada" || r.estado === "no_asistio") && (
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => void action(r.id, "confirmada")}
                          >
                            Revertir
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
