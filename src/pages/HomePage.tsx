import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

type ActivityKey = "senderismo" | "rafting" | "canopy" | "cabanas";

type Card = {
  key: ActivityKey;
  title: string;
  subtitle: string;
  desc: string;
  tags: string[];
  img: string;
};

const HERO_IMG =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2000&q=70";

const cards: Card[] = [
  {
    key: "senderismo",
    title: "Senderismo",
    subtitle: "Rutas guiadas",
    tags: ["Naturaleza", "Familiar"],
    desc: "Caminatas para todo nivel con miradores, bosque nativo y aire puro.",
    img: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1400&q=70",
  },
  {
    key: "rafting",
    title: "Rafting",
    subtitle: "Aventura en río",
    tags: ["Aventura", "Adrenalina"],
    desc: "Descenso por rápidos con equipo completo y monitores certificados.",
    img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=70",
  },
  {
    key: "canopy",
    title: "Canopy",
    subtitle: "Tirolesas",
    tags: ["Adrenalina", "Panorámico"],
    desc: "Circuito de canopy con plataformas seguras y vistas increíbles.",
    img: "https://images.unsplash.com/photo-1520975693410-001d8f6c7fd3?auto=format&fit=crop&w=1400&q=70",
  },
  {
    key: "cabanas",
    title: "Estadía en cabañas",
    subtitle: "Descanso total",
    tags: ["Relax", "Estadía"],
    desc: "Cabañas equipadas para desconectar y recargar energías en Angostura.",
    img: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=70",
  },
];

type UserRole = "admin" | "operador" | "usuario";

function roleIsStaff(role: UserRole | null) {
  return role === "admin" || role === "operador";
}

function clampName(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export default function HomePage() {
  const { user } = useAuth();
  const sectionRef = useRef<HTMLDivElement | null>(null);

  const [role, setRole] = useState<UserRole | null>(null);
  const [profileName, setProfileName] = useState<{ firstName?: string; lastName?: string }>({});

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!user?.uid) {
        setRole(null);
        setProfileName({});
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!alive) return;

        if (snap.exists()) {
          const data = snap.data() as any;
          setRole((data.role as UserRole) ?? "usuario");
          setProfileName({
            firstName: data.firstName ?? "",
            lastName: data.lastName ?? "",
          });
        } else {
          setRole("usuario");
          setProfileName({});
        }
      } catch {
        setRole("usuario");
        setProfileName({});
      }
    }

    void run();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  const displayName = useMemo(() => {
    const full = clampName(`${profileName.firstName ?? ""} ${profileName.lastName ?? ""}`);
    if (full) return full;
    return user?.displayName?.trim() || "usuario";
  }, [profileName.firstName, profileName.lastName, user?.displayName]);

  const welcome = user ? `Bienvenido, ${displayName}. ` : "Bienvenido a Angostura. ";
  const highlight = "Vive la experiencia";

  const staff = roleIsStaff(role);

  function scrollToActivities() {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070b10", color: "white" }}>
      {/* NAVBAR */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "rgba(10,14,18,0.55)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          className="container d-flex align-items-center justify-content-between"
          style={{ maxWidth: 1300, paddingTop: 10, paddingBottom: 10 }}
        >
          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>
            Angostura <span style={{ color: "#49b7ff", fontWeight: 800 }}>Recepciones</span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-sm btn-outline-light"
              onClick={scrollToActivities}
              style={{ borderRadius: 999, paddingInline: 14 }}
            >
              Actividades
            </button>

            {!user ? (
              <>
                <Link
                  to="/login"
                  className="btn btn-sm btn-outline-light"
                  style={{ borderRadius: 999, paddingInline: 14 }}
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/register"
                  className="btn btn-sm btn-light"
                  style={{ borderRadius: 999, paddingInline: 14 }}
                >
                  Crear cuenta
                </Link>
              </>
            ) : (
              <>
                {staff && (
                  <Link
                    to="/recepciones"
                    className="btn btn-sm btn-outline-info"
                    style={{ borderRadius: 999, paddingInline: 14 }}
                  >
                    Recepciones
                  </Link>
                )}
                {role === "admin" && (
                  <Link
                    to="/admin-cuentas"
                    className="btn btn-sm btn-outline-warning"
                    style={{ borderRadius: 999, paddingInline: 14 }}
                  >
                    Admin cuentas
                  </Link>
                )}

                <button
                  className="btn btn-sm btn-outline-light"
                  onClick={() => void signOut(auth)}
                  style={{ borderRadius: 999, paddingInline: 14 }}
                >
                  Cerrar sesión
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* HERO */}
      <section
        style={{
          position: "relative",
          minHeight: "92vh",
          backgroundImage: `url(${HERO_IMG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.45) 55%, rgba(7,11,16,1) 100%)",
          }}
        />

        {/* ✅ Contenedor HERO: ahora alinea a la izquierda */}
        <div
          className="container"
          style={{
            maxWidth: 1300,
            position: "relative",
            zIndex: 2,
            minHeight: "92vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start", // 👈 antes "center"
            paddingTop: 90,
            paddingBottom: 40,

            // 👇 este padding es el “corrimiento”
            // sube/baja el número si lo quieres más a la izquierda/derecha:
            paddingLeft: 40,
          }}
        >
          <div style={{ maxWidth: 860, marginTop: "2vh" }}>
            <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.85, marginBottom: 10 }}>
              ANGOSTURA
            </div>

            <h1 style={{ fontSize: 64, lineHeight: 1.02, fontWeight: 900, margin: 0 }}>
              {welcome}
              <span style={{ color: "#49b7ff" }}>{highlight}</span>
            </h1>

            <p style={{ marginTop: 14, opacity: 0.92 }}>
              Selecciona una actividad y elige la fecha para ver horarios disponibles.
            </p>

            <div className="d-flex gap-2 flex-wrap" style={{ marginTop: 12 }}>
              {[
                { label: "Naturaleza", icon: "🌿" },
                { label: "Aventura", icon: "⛰️" },
                { label: "Adrenalina", icon: "🪂" },
                { label: "Descanso", icon: "🛖" },
              ].map((t) => (
                <span
                  key={t.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(0,0,0,0.25)",
                    fontSize: 13,
                  }}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </span>
              ))}
            </div>

            {user && (
              <div style={{ marginTop: 14, opacity: 0.75, fontSize: 13 }}>
                Sesión activa como{" "}
                <span style={{ color: "#a6e6ff" }}>{user.email ?? "—"}</span> · rol:{" "}
                <span style={{ color: "#a6e6ff" }}>{role ?? "usuario"}</span>
              </div>
            )}
          </div>
        </div>

        {/* botón bajar */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 26,
            transform: "translateX(-50%)",
            zIndex: 3,
          }}
        >
          <button
            onClick={scrollToActivities}
            aria-label="Bajar a actividades"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(0,0,0,0.25)",
              color: "white",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            v
          </button>
        </div>
      </section>

      {/* DESTACADOS */}
      <section
        ref={sectionRef}
        style={{
          paddingTop: 80,
          paddingBottom: 80,
          background:
            "radial-gradient(900px 500px at 50% 0%, rgba(73,183,255,0.18), rgba(7,11,16,1) 60%)",
        }}
      >
        <div className="container" style={{ maxWidth: 1300 }}>
          <h2 className="text-center mb-5" style={{ color: "#49b7ff", fontWeight: 900, fontSize: 44 }}>
            Destacados
          </h2>

          <div className="row g-4 justify-content-center">
            {cards.map((c) => (
              <div key={c.key} className="col-12 col-md-6 col-lg-3">
                <div
                  style={{
                    borderRadius: 18,
                    overflow: "hidden",
                    background: "rgba(18,22,28,0.75)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    boxShadow: "0 25px 80px rgba(0,0,0,0.55)",
                    height: "100%",
                  }}
                >
                  <div style={{ height: 170, position: "relative" }}>
                    <img
                      src={c.img}
                      alt={c.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0))",
                      }}
                    />
                  </div>

                  <div style={{ padding: 16 }}>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>{c.title}</div>
                    <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 10 }}>{c.subtitle}</div>

                    <div className="d-flex gap-2 flex-wrap mb-2">
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 11,
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "rgba(0,0,0,0.18)",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <div style={{ opacity: 0.9, fontSize: 13, minHeight: 42 }}>{c.desc}</div>

                    <Link
                      to={`/experiencia/${c.key}`}
                      className="btn btn-light w-100 mt-3"
                      style={{ borderRadius: 12, fontWeight: 800 }}
                    >
                      Ver más
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-4 small" style={{ opacity: 0.65 }}>
            Próximamente: el botón "Reservar" se conectará a Firestore (reservas).
          </div>

          <div className="text-center mt-5" style={{ opacity: 0.55, fontSize: 12 }}>
            © 2025 Angostura
          </div>
        </div>
      </section>
    </div>
  );
}
