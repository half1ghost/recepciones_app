import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

type Require = "staff" | "admin";

type Props = {
  children: React.ReactNode;
  require?: Require;
};

type UserRole = "admin" | "operador" | "usuario";

function isStaff(role: UserRole) {
  return role === "admin" || role === "operador";
}

async function fetchRole(uid: string): Promise<UserRole> {
  const snap = await getDoc(doc(db, "users", uid));
  const r = snap.exists() ? (snap.data() as any).role : null;
  return (r as UserRole) ?? "usuario";
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("timeout")), ms);

    p.then((v) => {
      window.clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      window.clearTimeout(t);
      reject(e);
    });
  });
}

export default function ProtectedRoute({ children, require = "staff" }: Props) {
  const { user, loading, sessionError } = useAuth();
  const location = useLocation();

  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!user?.uid) {
        setRole(null);
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);
      try {
        const r = await withTimeout(fetchRole(user.uid), 6000);
        if (!alive) return;
        setRole(r);
      } catch {
        // fallback seguro
        if (!alive) return;
        setRole("usuario");
      } finally {
        if (!alive) return;
        setRoleLoading(false);
      }
    }

    void run();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  const canEnter = useMemo(() => {
    if (!user) return false;
    if (!role) return false;

    if (require === "admin") return role === "admin";
    if (require === "staff") return isStaff(role);

    return false;
  }, [user, role, require]);

  // 1) esperando sesión
  if (loading) {
    return (
      <div className="container py-5" style={{ maxWidth: 720 }}>
        <div className="alert alert-info mb-0">Cargando sesión…</div>
      </div>
    );
  }

  // 2) error de sesión (sin bloquear)
  if (sessionError && !user) {
    return (
      <div className="container py-5" style={{ maxWidth: 720 }}>
        <div className="alert alert-warning">
          {sessionError}
          <div className="mt-2 d-flex gap-2 flex-wrap">
            <a className="btn btn-sm btn-outline-primary" href="/">
              Ir a Home
            </a>
            <a className="btn btn-sm btn-outline-secondary" href="/login">
              Ir a Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 3) no logueado
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // 4) esperando rol
  if (roleLoading || !role) {
    return (
      <div className="container py-5" style={{ maxWidth: 720 }}>
        <div className="alert alert-info mb-0">Cargando permisos…</div>
      </div>
    );
  }

  // 5) no autorizado → home
  if (!canEnter) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
