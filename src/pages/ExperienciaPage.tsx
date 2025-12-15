import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Actividad, ReservaEstado } from "../types/recepcion";
import {
  cancelMyReserva,
  createReservaForActividad,
  fetchActividadesByFecha,
  fetchDisponibilidadByFecha,
  fetchMyReservasByFecha,
  fetchMyRole,
  type UserRole,
} from "../services/recepcionesService";

type HomeActivityMeta = {
  key: string;
  title: string;
  subtitle: string;
  desc: string;
  heroUrl: string;
  matchKeywords: string[];
};

const META: Record<string, HomeActivityMeta> = {
  senderismo: {
    key: "senderismo",
    title: "Senderismo",
    subtitle: "Rutas guiadas",
    desc: "Elige una fecha y revisa los horarios disponibles para senderismo.",
    heroUrl:
      "https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=2000&q=70",
    matchKeywords: ["senderismo", "trekking", "caminata", "ruta"],
  },
  rafting: {
    key: "rafting",
    title: "Rafting",
    subtitle: "Aventura en río",
    desc: "Selecciona una fecha y revisa las salidas disponibles de rafting.",
    heroUrl:
      "https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=2000&q=70",
    matchKeywords: ["rafting", "ráfting", "rio", "río"],
  },
  canopy: {
    key: "canopy",
    title: "Canopy",
    subtitle: "Tirolesas",
    desc: "Elige una fecha y revisa los horarios disponibles para canopy.",
    heroUrl:
      "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=2000&q=70",
    matchKeywords: ["canopy", "tirolesa", "zipline", "zip line"],
  },
  cabanas: {
    key: "cabanas",
    title: "Estadía en cabañas",
    subtitle: "Descanso total",
    desc: "Selecciona una fecha y revisa disponibilidad de estadías/ingresos.",
    heroUrl:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=2000&q=70",
    matchKeywords: ["cabaña", "cabañas", "estadía", "estadia", "alojamiento"],
  },
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function isStaff(role: UserRole | null) {
  return role === "admin" || role === "operador";
}

function isPastISODate(iso: string, today: string) {
  return iso < today; // YYYY-MM-DD
}

export default function ExperienciaPage() {
  const { key } = useParams<{ key: string }>();
  const meta = key ? META[key] : null;

  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);

  const TODAY = useMemo(() => todayISO(), []);
  const [selectedDate, setSelectedDate] = useState<string>(TODAY);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(new Date()));

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [rawActividades, setRawActividades] = useState<Actividad[]>([]);
  const [dispByActividadId, setDispByActividadId] = useState<Record<string, any>>({});
  const [myByActividadId, setMyByActividadId] = useState<
    Record<string, { id: string; estado: ReservaEstado }>
  >({});

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  if (!meta) {
    return (
      <div className="container py-5" style={{ maxWidth: 900 }}>
        <div className="alert alert-warning">Actividad no encontrada.</div>
        <Link to="/" className="btn btn-primary">
          Volver a Home
        </Link>
      </div>
    );
  }

  // rol
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setRole(null);
      return;
    }
    (async () => {
      const r = (await fetchMyRole(uid).catch(() => null)) ?? "usuario";
      setRole(r);
    })();
  }, [user?.uid]);

  const staff = isStaff(role);

  // usuarios/no logueados no pueden pasado
  const canPickPast = staff;
  const minDate = canPickPast ? undefined : TODAY;

  useEffect(() => {
    if (!canPickPast && isPastISODate(selectedDate, TODAY)) {
      setSelectedDate(TODAY);
      setViewMonth(startOfMonth(new Date()));
      setInfo("Solo puedes revisar desde la fecha actual en adelante.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPickPast]);

  // calendario grilla
  const calendarCells = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const jsDow = first.getDay(); // Dom=0
    const offset = (jsDow + 6) % 7; // Dom->6, Lun->0
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - offset);

    const cells: { date: Date; iso: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const iso = toISODate(d);
      cells.push({ date: d, iso, inMonth: d.getMonth() === viewMonth.getMonth() });
    }
    return cells;
  }, [viewMonth]);

  // cargar actividades + disponibilidad + mis reservas
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      setInfo(null);

      try {
        const [acts, disp] = await Promise.all([
          fetchActividadesByFecha(selectedDate),
          fetchDisponibilidadByFecha(selectedDate),
        ]);

        setRawActividades(acts);
        setDispByActividadId(disp);

        if (user?.uid) {
          const mine = await fetchMyReservasByFecha(user.uid, selectedDate);
          const map: Record<string, any> = {};
          for (const r of mine) {
            // Si tiene estado anulada, no la consideramos “activa” en UI
            map[r.actividadId] = { id: r.id, estado: r.estado };
          }
          setMyByActividadId(map);
        } else {
          setMyByActividadId({});
        }
      } catch (e: any) {
        setErr(`${e?.code ?? ""} ${e?.message ?? "Error cargando datos"}`.trim());
        setRawActividades([]);
        setDispByActividadId({});
        setMyByActividadId({});
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedDate, user?.uid]);

  // filtro por tipo con fallback
  const actividadesRelacionadas = useMemo(() => {
    const keyLower = meta.key.toLowerCase();

    const typed = rawActividades
      .filter((a) => (a.tipo ?? "").toLowerCase() === keyLower)
      .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));

    if (typed.length > 0) return typed;

    const kw = meta.matchKeywords.map((k) => k.toLowerCase());
    return rawActividades
      .filter((a) => kw.some((w) => (a.titulo ?? "").toLowerCase().includes(w)))
      .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
  }, [rawActividades, meta]);

  function setDateSafe(iso: string) {
    setInfo(null);
    if (!canPickPast && isPastISODate(iso, TODAY)) {
      setInfo("No puedes seleccionar fechas pasadas. Elige desde hoy en adelante.");
      return;
    }
    setSelectedDate(iso);
  }

  function remainingFor(a: Actividad) {
    const disp = dispByActividadId[a.id];
    const reserved = Number(disp?.reserved ?? 0);
    return a.cupo - reserved;
  }

  async function onReserve(a: Actividad) {
    setErr(null);
    setInfo(null);

    if (!user) {
      setInfo("Debes iniciar sesión para reservar.");
      return;
    }

    // protección extra
    if (!canPickPast && isPastISODate(selectedDate, TODAY)) {
      setInfo("No puedes reservar en fechas pasadas.");
      return;
    }

    const my = myByActividadId[a.id];
    if (my && my.estado !== "anulada") {
      setInfo("Ya tienes una reserva para esta actividad.");
      return;
    }

    const remaining = remainingFor(a);
    if (remaining <= 0) {
      setInfo("Cupo agotado para esta actividad.");
      return;
    }

    setActionBusyId(a.id);
    try {
      await createReservaForActividad(a);

      // refrescar rápido
      const disp = await fetchDisponibilidadByFecha(selectedDate);
      setDispByActividadId(disp);

      const mine = await fetchMyReservasByFecha(user.uid, selectedDate);
      const map: Record<string, any> = {};
      for (const r of mine) map[r.actividadId] = { id: r.id, estado: r.estado };
      setMyByActividadId(map);

      setInfo("Reserva creada ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Error reservando");
    } finally {
      setActionBusyId(null);
    }
  }

  async function onCancel(actividadId: string) {
    setErr(null);
    setInfo(null);

    if (!user) return;

    const my = myByActividadId[actividadId];
    if (!my || my.estado === "anulada") return;

    setActionBusyId(actividadId);
    try {
      await cancelMyReserva(my.id);

      const disp = await fetchDisponibilidadByFecha(selectedDate);
      setDispByActividadId(disp);

      const mine = await fetchMyReservasByFecha(user.uid, selectedDate);
      const map: Record<string, any> = {};
      for (const r of mine) map[r.actividadId] = { id: r.id, estado: r.estado };
      setMyByActividadId(map);

      setInfo("Reserva anulada ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Error anulando");
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <div className="ang-exp">
      <style>{`
        .ang-exp { background:#0b0f14; color:#e9eef6; min-height:100vh; }
        .ang-nav { position: sticky; top: 0; z-index: 50;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .ang-hero { position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .ang-hero-bg {
          position:absolute; inset:0;
          background-image:
            linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.35) 100%),
            url("${meta.heroUrl}");
          background-size: cover;
          background-position:center;
          filter: contrast(1.05) saturate(0.95);
          transform: scale(1.02);
        }
        .ang-hero-content { position:relative; z-index:2; padding: 46px 0; }
        .ang-title { font-size: clamp(28px, 3.6vw, 46px); font-weight: 900; line-height: 1.05; margin: 0; }
        .ang-sub { color: rgba(233,238,246,0.75); margin-top: 10px; max-width: 820px; }
        .ang-pill { display:inline-flex; gap:8px; align-items:center; padding: 8px 12px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.35); color: rgba(233,238,246,0.86); font-size: 13px;
        }

        .card-dark {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        }

        .cal-head { display:flex; justify-content: space-between; align-items:center; gap: 10px; flex-wrap: wrap; }
        .cal-month { font-weight: 800; text-transform: capitalize; }
        .cal-grid { display:grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
        .cal-dow { text-align:center; font-size: 12px; color: rgba(233,238,246,0.65); padding: 6px 0; }
        .cal-cell {
          border-radius: 12px;
          padding: 10px 0;
          text-align:center;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.25);
          color: rgba(233,238,246,0.88);
          user-select: none;
          transition: transform .12s ease, border-color .12s ease, background .12s ease;
        }
        .cal-cell:hover { transform: translateY(-1px); border-color: rgba(63,185,255,0.35); }
        .cal-cell.muted { opacity: 0.45; }
        .cal-cell.today { border-color: rgba(255,255,255,0.22); }
        .cal-cell.selected { border-color: rgba(63,185,255,0.55); background: rgba(63,185,255,0.10); }
        .cal-cell.disabled { opacity: 0.30; cursor: not-allowed; pointer-events: none; }

        .act-item {
          display:flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.20);
        }
        .act-title { font-weight: 800; margin: 0; }
        .act-meta { color: rgba(233,238,246,0.70); font-size: 13px; margin-top: 3px; }
        .badge-soft {
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.25);
          color: rgba(233,238,246,0.85);
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
        }
      `}</style>

      <div className="ang-nav">
        <div className="container py-3 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <Link className="text-decoration-none text-white fw-bold" to="/">
            Angostura <span style={{ color: "#3fb9ff" }}>Recepciones</span>
          </Link>

          <div className="d-flex gap-2 align-items-center flex-wrap">
            <Link to="/" className="btn btn-sm btn-outline-light">
              Volver a Home
            </Link>

            {staff && (
              <Link to="/recepciones" className="btn btn-sm btn-primary">
                Panel Recepciones
              </Link>
            )}

            {!user ? (
              <Link to="/login" className="btn btn-sm btn-outline-primary">
                Iniciar sesión
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ang-hero">
        <div className="ang-hero-bg" />
        <div className="container ang-hero-content">
          <div className="d-flex flex-wrap gap-2 mb-2">
            <span className="ang-pill">📅 Selección de fecha</span>
            <span className="ang-pill">🕒 Horarios del día</span>
            <span className="ang-pill">🎯 {meta.subtitle}</span>
          </div>

          <h1 className="ang-title">{meta.title}</h1>
          <p className="ang-sub">{meta.desc}</p>

          <div className="d-flex flex-wrap gap-2 mt-2">
            <span className="ang-pill">
              Fecha seleccionada: <code style={{ color: "#bfe9ff" }}>{selectedDate}</code>
            </span>
            {user ? (
              <span className="ang-pill">
                Sesión: <code style={{ color: "#bfe9ff" }}>{user.email ?? user.uid}</code>
              </span>
            ) : (
              <span className="ang-pill">Inicia sesión para reservar</span>
            )}
          </div>

          {!canPickPast && (
            <div className="mt-2" style={{ color: "rgba(233,238,246,0.65)", fontSize: 13 }}>
              Nota: solo puedes revisar desde <code style={{ color: "#bfe9ff" }}>{TODAY}</code> en adelante.
            </div>
          )}
        </div>
      </div>

      <div className="container py-4" style={{ maxWidth: 1100 }}>
        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="card-dark p-3">
              <div className="cal-head">
                <div>
                  <div className="cal-month">{monthLabel(viewMonth)}</div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    Selecciona un día para ver los horarios.
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-outline-light"
                    onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                  >
                    ←
                  </button>
                  <button
                    className="btn btn-sm btn-outline-light"
                    onClick={() => setViewMonth(startOfMonth(new Date()))}
                  >
                    Hoy
                  </button>
                  <button
                    className="btn btn-sm btn-outline-light"
                    onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                  >
                    →
                  </button>
                </div>
              </div>

              <hr style={{ borderColor: "rgba(255,255,255,0.08)" }} />

              <label className="form-label">Fecha</label>
              <input
                type="date"
                className="form-control"
                value={selectedDate}
                min={minDate}
                onChange={(e) => {
                  const iso = e.target.value;
                  setInfo(null);

                  if (!canPickPast && isPastISODate(iso, TODAY)) {
                    setInfo("No puedes seleccionar fechas pasadas.");
                    return;
                  }

                  setSelectedDate(iso);
                  const d = new Date(iso + "T00:00:00");
                  setViewMonth(startOfMonth(d));
                }}
              />

              <div className="mt-3 cal-grid">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="cal-dow">
                    {w}
                  </div>
                ))}

                {calendarCells.map((c) => {
                  const isSelected = c.iso === selectedDate;
                  const isToday = c.iso === TODAY;
                  const disabled = !canPickPast && isPastISODate(c.iso, TODAY);

                  return (
                    <div
                      key={c.iso}
                      className={[
                        "cal-cell",
                        !c.inMonth ? "muted" : "",
                        isToday ? "today" : "",
                        isSelected ? "selected" : "",
                        disabled ? "disabled" : "",
                      ].join(" ")}
                      onClick={() => setDateSafe(c.iso)}
                      title={disabled ? "No disponible (fecha pasada)" : c.iso}
                    >
                      {c.date.getDate()}
                    </div>
                  );
                })}
              </div>

              {info && <div className="alert alert-warning mt-3 mb-0">{info}</div>}
            </div>
          </div>

          <div className="col-12 col-lg-7">
            <div className="card-dark p-3">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <div className="fw-bold" style={{ fontSize: 18 }}>
                    Horarios disponibles
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    {meta.title} · <code style={{ color: "#bfe9ff" }}>{selectedDate}</code>
                  </div>
                </div>

                <button className="btn btn-sm btn-outline-primary" onClick={() => setSelectedDate((d) => d)}>
                  Actualizar
                </button>
              </div>

              <hr style={{ borderColor: "rgba(255,255,255,0.08)" }} />

              {err && <div className="alert alert-danger">{err}</div>}

              {loading ? (
                <div className="alert alert-info mb-0">Cargando…</div>
              ) : actividadesRelacionadas.length === 0 ? (
                <div className="alert alert-info mb-0">
                  No hay actividades de <b>{meta.title}</b> para este día.
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {actividadesRelacionadas.map((a) => {
                    const remaining = remainingFor(a);
                    const my = myByActividadId[a.id];
                    const myActive = my && my.estado !== "anulada";

                    return (
                      <div key={a.id} className="act-item">
                        <div>
                          <p className="act-title mb-0">
                            {a.titulo} <span style={{ color: "#3fb9ff" }}>· {a.hora}</span>
                          </p>
                          <div className="act-meta">
                            Cupo: <b>{a.cupo}</b> · Disponibles:{" "}
                            <b style={{ color: remaining > 0 ? "#bfe9ff" : "#ffb4b4" }}>
                              {Math.max(0, remaining)}
                            </b>
                            {a.descripcion ? (
                              <>
                                {" "}
                                · <span className="text-muted">{a.descripcion}</span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="d-flex gap-2 align-items-center flex-wrap justify-content-end">
                          {myActive ? (
                            <>
                              <span className="badge-soft">✅ Reservada</span>
                              <button
                                className="btn btn-sm btn-outline-warning"
                                disabled={actionBusyId === a.id}
                                onClick={() => void onCancel(a.id)}
                              >
                                {actionBusyId === a.id ? "..." : "Anular"}
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-sm btn-light"
                              disabled={!user || remaining <= 0 || actionBusyId === a.id}
                              onClick={() => void onReserve(a)}
                              title={!user ? "Inicia sesión para reservar" : remaining <= 0 ? "Cupo agotado" : "Reservar"}
                            >
                              {actionBusyId === a.id ? "Reservando…" : "Reservar"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!user && (
                <div className="text-muted small mt-3">
                  Para reservar necesitas iniciar sesión.{" "}
                  <Link to="/login">Ir a login</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
