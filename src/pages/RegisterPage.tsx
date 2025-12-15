import { useMemo, useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

type PasswordCheck = {
  ok: boolean;
  errors: string[];
};

function validatePassword(pw: string): PasswordCheck {
  const errors: string[] = [];

  if (pw.length < 8) errors.push("Debe tener mínimo 8 caracteres.");
  if (!/[a-z]/.test(pw)) errors.push("Debe incluir al menos 1 letra minúscula (a-z).");
  if (!/[A-Z]/.test(pw)) errors.push("Debe incluir al menos 1 letra mayúscula (A-Z).");
  if (!/[0-9]/.test(pw)) errors.push("Debe incluir al menos 1 número (0-9).");

  // ✅ Símbolos permitidos (evitamos comillas/backticks, slash/backslash, < >, ;, :, |)
  const allowedSymbols = /[!@#$%^&*()_\-+=\[\]{}.,?~]/;
  if (!allowedSymbols.test(pw)) {
    errors.push(
      'Debe incluir al menos 1 símbolo permitido: ! @ # $ % ^ & * ( ) _ - + = [ ] { } . , ? ~'
    );
  }

  // ❌ Bloqueados por tu requisito
  const blockedSymbols = /[<>"'`\\\/;:|]/;
  if (blockedSymbols.test(pw)) {
    errors.push('No se permiten estos símbolos: < > " \' ` \\ / ; : |');
  }

  if (/\s/.test(pw)) errors.push("No se permiten espacios en la contraseña.");

  return { ok: errors.length === 0, errors };
}

function validateName(label: string, value: string) {
  const v = value.trim();
  if (v.length < 2) return `${label} debe tener al menos 2 caracteres.`;
  if (/[0-9]/.test(v)) return `${label} no debe contener números.`;
  // Letras + espacios + acentos + ñ + ' -
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]+$/.test(v)) {
    return `${label} contiene caracteres no permitidos.`;
  }
  return null;
}

export default function RegisterPage() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pwCheck = useMemo(() => validatePassword(password), [password]);
  const firstNameErr = useMemo(() => validateName("Nombre", firstName), [firstName]);
  const lastNameErr = useMemo(() => validateName("Apellido", lastName), [lastName]);

  const matchErr = useMemo(() => {
    if (!password2) return null;
    if (password2 !== password) return "Las contraseñas no coinciden.";
    return null;
  }, [password, password2]);

  const canSubmit = useMemo(() => {
    return (
      !loading &&
      !firstNameErr &&
      !lastNameErr &&
      email.trim().length > 0 &&
      pwCheck.ok &&
      !matchErr
    );
  }, [loading, firstNameErr, lastNameErr, email, pwCheck.ok, matchErr]);

  if (user) {
    nav("/", { replace: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const fnErr = validateName("Nombre", firstName);
    const lnErr = validateName("Apellido", lastName);
    const pw = validatePassword(password);

    if (fnErr) return setErr(fnErr);
    if (lnErr) return setErr(lnErr);
    if (!pw.ok) return setErr(pw.errors[0]);
    if (password !== password2) return setErr("Las contraseñas no coinciden.");

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      const display = `${firstName.trim()} ${lastName.trim()}`.trim();
      await updateProfile(cred.user, { displayName: display });

      // ✅ cuentas nuevas parten como usuario
      await setDoc(doc(db, "users", cred.user.uid), {
        role: "usuario",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        createdAt: serverTimestamp(),
      });

      nav("/", { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 620 }}>
      <h2 className="mb-1">Crear cuenta</h2>
      <p className="text-muted">Regístrate para reservar actividades.</p>

      <form className="card card-body" onSubmit={onSubmit}>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label">Nombre</label>
            <input
              className={`form-control ${firstNameErr ? "is-invalid" : ""}`}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ej: Aquiles"
              autoComplete="given-name"
              required
            />
            {firstNameErr && <div className="invalid-feedback">{firstNameErr}</div>}
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label">Apellido</label>
            <input
              className={`form-control ${lastNameErr ? "is-invalid" : ""}`}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Ej: Castro"
              autoComplete="family-name"
              required
            />
            {lastNameErr && <div className="invalid-feedback">{lastNameErr}</div>}
          </div>
        </div>

        <hr />

        <label className="form-label">Correo</label>
        <input
          className="form-control mb-3"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@dominio.com"
          autoComplete="email"
          required
        />

        <label className="form-label">Contraseña</label>
        <input
          className={`form-control ${password.length > 0 && !pwCheck.ok ? "is-invalid" : ""}`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />

        <div className="mt-2 small">
          <div className="fw-semibold">Requisitos:</div>
          <ul className="mb-0" style={{ opacity: 0.9 }}>
            <li>Mínimo 8 caracteres</li>
            <li>1 mayúscula, 1 minúscula, 1 número</li>
            <li>
              1 símbolo permitido:{" "}
              <code>! @ # $ % ^ & * ( ) _ - + = [ ] {"{"} {"}"} . , ? ~</code>
            </li>
            <li>
              No se permiten: <code>&lt; &gt; " ' ` \ / ; : |</code> ni espacios
            </li>
          </ul>
        </div>

        {password.length > 0 && !pwCheck.ok && (
          <div className="alert alert-warning mt-3 mb-0">
            <div className="fw-semibold">Falta cumplir:</div>
            <ul className="mb-0">
              {pwCheck.errors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="form-label mt-3">Confirmar contraseña</label>
        <input
          className={`form-control ${matchErr ? "is-invalid" : ""}`}
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />
        {matchErr && <div className="invalid-feedback">{matchErr}</div>}

        {err && <div className="alert alert-danger mt-3 mb-0">{err}</div>}

        <button className="btn btn-primary mt-3" type="submit" disabled={!canSubmit}>
          {loading ? "Creando…" : "Crear cuenta"}
        </button>

        <div className="mt-3 small text-muted">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </div>
      </form>
    </div>
  );
}
