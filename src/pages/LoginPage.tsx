import { useEffect, useMemo, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { auth, db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { doc, getDoc } from "firebase/firestore";

type UserRole = "admin" | "operador" | "usuario";

const ATTEMPT_KEY = "angostura_login_attempts_v1";

type AttemptState = {
  count: number; // fallos acumulados recientes
  lockedUntil: number; // timestamp ms
  lastFailAt: number; // timestamp ms
};

function readAttempts(): AttemptState {
  try {
    const raw = localStorage.getItem(ATTEMPT_KEY);
    if (!raw) return { count: 0, lockedUntil: 0, lastFailAt: 0 };
    const obj = JSON.parse(raw);
    return {
      count: Number(obj.count ?? 0),
      lockedUntil: Number(obj.lockedUntil ?? 0),
      lastFailAt: Number(obj.lastFailAt ?? 0),
    };
  } catch {
    return { count: 0, lockedUntil: 0, lastFailAt: 0 };
  }
}

function writeAttempts(s: AttemptState) {
  localStorage.setItem(ATTEMPT_KEY, JSON.stringify(s));
}

function resetAttempts() {
  writeAttempts({ count: 0, lockedUntil: 0, lastFailAt: 0 });
}

function computeLockSeconds(failCount: number) {
  // 1->2s, 2->4s, 3->8s, 4->16s... con tope 60s
  const sec = Math.min(60, Math.pow(2, Math.min(6, failCount)) * 2);
  return sec;
}

async function fetchRole(uid: string): Promise<UserRole> {
  const snap = await getDoc(doc(db, "users", uid));
  const role = snap.exists() ? (snap.data() as any).role : null;
  return (role as UserRole) ?? "usuario";
}

export default function LoginPage() {
  const nav = useNavigate();
  const location = useLocation() as any;
  const { user } = useAuth();

  const from = useMemo(
    () => location.state?.from || "/",
    [location.state]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // rate-limit local
  const [attempts, setAttempts] = useState<AttemptState>(() => readAttempts());
  const [now, setNow] = useState(() => Date.now());

  const locked = now < attempts.lockedUntil;
  const remaining = Math.max(0, Math.ceil((attempts.lockedUntil - now) / 1000));

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  // Si ya está logueado -> redirección por rol
  useEffect(() => {
    (async () => {
      if (!user?.uid) return;

      try {
        const role = await fetchRole(user.uid);
        if (role === "admin" || role === "operador") {
          nav("/recepciones", { replace: true });
        } else {
          nav("/", { replace: true });
        }
      } catch {
        nav("/", { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const a = readAttempts();
    const ts = Date.now();

    // limpieza simple: si el último fallo fue hace mucho, resetea conteo
    if (a.lastFailAt && ts - a.lastFailAt > 10 * 60 * 1000) {
      resetAttempts();
      setAttempts(readAttempts());
    }

    const current = readAttempts();
    if (ts < current.lockedUntil) {
      setAttempts(current);
      setErr(`Demasiados intentos. Intenta nuevamente en ${Math.ceil((current.lockedUntil - ts) / 1000)}s.`);
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

      // login ok -> reset rate limit
      resetAttempts();
      setAttempts(readAttempts());

      // redirección por rol
      const role = await fetchRole(cred.user.uid);
      if (role === "admin" || role === "operador") {
        nav("/recepciones", { replace: true });
      } else {
        // si venías de una ruta, respetamos from si es "/"
        nav(from === "/recepciones" ? "/" : from, { replace: true });
      }
    } catch {
      // ❗ Error genérico para no filtrar si existe el correo
      const prev = readAttempts();
      const nextCount = prev.count + 1;
      const lockSec = computeLockSeconds(nextCount);
      const next: AttemptState = {
        count: nextCount,
        lockedUntil: Date.now() + lockSec * 1000,
        lastFailAt: Date.now(),
      };
      writeAttempts(next);
      setAttempts(next);
      setErr(`Credenciales inválidas. Intenta nuevamente en ${lockSec}s.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 520 }}>
      <h2 className="mb-1">Iniciar sesión</h2>
      <p className="text-muted">Acceso para usuarios y personal.</p>

      <form className="card card-body" onSubmit={onSubmit}>
        <label className="form-label">Correo</label>
        <input
          className="form-control mb-3"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@dominio.com"
          required
        />

        <label className="form-label">Contraseña</label>
        <input
          className="form-control mb-3"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        {locked && (
          <div className="alert alert-warning">
            Demasiados intentos. Espera <b>{remaining}s</b> antes de volver a intentar.
          </div>
        )}

        {err && <div className="alert alert-danger">{err}</div>}

        <button className="btn btn-primary" type="submit" disabled={loading || locked}>
          {loading ? "Entrando…" : locked ? `Bloqueado (${remaining}s)` : "Entrar"}
        </button>

        <hr />

        <div className="d-flex justify-content-between small">
          <Link to="/register">Crear cuenta</Link>
          <Link to="/">Volver a Home</Link>
        </div>
      </form>
    </div>
  );
}
