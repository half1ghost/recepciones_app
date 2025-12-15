import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import type {
  Actividad,
  ActividadTipo,
  Reserva,
  ReservaEstado,
  Disponibilidad,
} from "../types/recepcion";

export type UserRole = "admin" | "operador" | "usuario";

export type UserAccount = {
  uid: string;
  email: string | null;
  displayName: string | null;
  nombre?: string;
  apellido?: string;
  role: UserRole;
};

function tsToDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  return null;
}

function isStaff(role: UserRole) {
  return role === "admin" || role === "operador";
}

function availDocId(actividadId: string, fecha: string) {
  return `${actividadId}_${fecha}`;
}

/** Lee el rol desde /users/{uid}. Si no existe, asume "usuario". */
export async function fetchMyRole(uid: string): Promise<UserRole> {
  const snap = await getDoc(doc(db, "users", uid));
  const role = snap.exists() ? (snap.data() as any).role : null;
  return (role as UserRole) ?? "usuario";
}

/** ✅ Admin: lista usuarios desde /users */
export async function fetchUsers(): Promise<UserAccount[]> {
  const me = auth.currentUser;
  if (!me) throw new Error("No autenticado");

  const myRole = await fetchMyRole(me.uid);
  if (myRole !== "admin") throw new Error("No autorizado (solo admin)");

  const snap = await getDocs(collection(db, "users"));

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      uid: d.id,
      email: (data.email ?? null) as string | null,
      displayName: (data.displayName ?? null) as string | null,
      nombre: (data.firstName ?? data.nombre ?? "") || "",
      apellido: (data.lastName ?? data.apellido ?? "") || "",
      role: ((data.role ?? "usuario") as UserRole) ?? "usuario",
    };
  });
}

/** ✅ Admin: cambia rol en /users/{uid} */
export async function setUserRole(uid: string, role: UserRole) {
  const me = auth.currentUser;
  if (!me) throw new Error("No autenticado");

  const myRole = await fetchMyRole(me.uid);
  if (myRole !== "admin") throw new Error("No autorizado (solo admin)");

  // Evitar auto-bloqueo
  if (uid === me.uid && role !== "admin") {
    throw new Error("No puedes quitarte admin a ti mismo.");
  }

  await updateDoc(doc(db, "users", uid), {
    role,
    updatedAt: serverTimestamp(),
    updatedBy: me.uid,
  });
}

export async function fetchActividadesByFecha(fecha: string): Promise<Actividad[]> {
  const q = query(
    collection(db, "actividades"),
    where("fecha", "==", fecha),
    orderBy("hora", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      titulo: data.titulo,
      descripcion: data.descripcion ?? "",
      fecha: data.fecha,
      hora: data.hora,
      cupo: Number(data.cupo ?? 0),
      tipo: (data.tipo as ActividadTipo | undefined) ?? undefined,
    };
  });
}

export async function fetchReservasByFecha(fecha: string): Promise<Reserva[]> {
  const q = query(
    collection(db, "reservas"),
    where("actividadFecha", "==", fecha),
    orderBy("actividadHora", "asc"),
    orderBy("nombre", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      userId: data.userId,
      actividadId: data.actividadId,
      actividadFecha: data.actividadFecha,
      actividadHora: data.actividadHora,
      actividadTitulo: data.actividadTitulo,
      nombre: data.nombre,
      correo: data.correo,
      estado: data.estado as ReservaEstado,
      checkedInAt: tsToDate(data.checkedInAt),
      checkedInBy: data.checkedInBy ?? null,
    };
  });
}

export async function setReservaEstado(reservaId: string, estado: ReservaEstado) {
  const user = auth.currentUser;
  if (!user) throw new Error("No autenticado");

  const ref = doc(db, "reservas", reservaId);

  if (estado === "recepcionada") {
    await updateDoc(ref, {
      estado,
      checkedInAt: serverTimestamp(),
      checkedInBy: user.uid,
    });
    return;
  }

  if (estado === "no_asistio") {
    await updateDoc(ref, { estado, checkedInAt: null, checkedInBy: null });
    return;
  }

  if (estado === "confirmada" || estado === "pendiente") {
    await updateDoc(ref, { estado, checkedInAt: null, checkedInBy: null });
    return;
  }

  await updateDoc(ref, { estado });
}

type CreateActividadInput = {
  titulo: string;
  descripcion?: string;
  fecha: string;
  hora: string;
  cupo: number;
  tipo: ActividadTipo;
};

export async function createActividad(input: CreateActividadInput) {
  const user = auth.currentUser;
  if (!user) throw new Error("No autenticado");

  const role = await fetchMyRole(user.uid);
  if (!isStaff(role)) throw new Error("No autorizado para crear actividades");

  const payload = {
    titulo: input.titulo.trim(),
    descripcion: (input.descripcion ?? "").trim(),
    fecha: input.fecha,
    hora: input.hora,
    cupo: Number(input.cupo),
    tipo: input.tipo,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  };

  await addDoc(collection(db, "actividades"), payload);
}

export async function updateActividadTipo(actividadId: string, tipo: ActividadTipo) {
  const user = auth.currentUser;
  if (!user) throw new Error("No autenticado");

  const role = await fetchMyRole(user.uid);
  if (!isStaff(role)) throw new Error("No autorizado para modificar actividades");

  const ref = doc(db, "actividades", actividadId);
  await updateDoc(ref, {
    tipo,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
}

/** ✅ Público: trae disponibilidad por fecha (sin PII) */
export async function fetchDisponibilidadByFecha(
  fecha: string
): Promise<Record<string, Disponibilidad>> {
  const q = query(collection(db, "actividadDisponibilidad"), where("fecha", "==", fecha));
  const snap = await getDocs(q);

  const map: Record<string, Disponibilidad> = {};
  for (const d of snap.docs) {
    const data = d.data() as any;
    const actividadId = String(data.actividadId ?? "");
    if (!actividadId) continue;
    map[actividadId] = {
      actividadId,
      fecha: String(data.fecha ?? fecha),
      cupo: Number(data.cupo ?? 0),
      reserved: Number(data.reserved ?? 0),
    };
  }
  return map;
}

/** ✅ Usuario: trae sus reservas del día */
export async function fetchMyReservasByFecha(uid: string, fecha: string) {
  const q = query(
    collection(db, "reservas"),
    where("userId", "==", uid),
    where("actividadFecha", "==", fecha)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      actividadId: data.actividadId as string,
      estado: data.estado as ReservaEstado,
    };
  });
}

/** ✅ Reserva con transacción: valida cupo por disponibilidad + evita duplicado */
export async function createReservaForActividad(actividad: Actividad) {
  const user = auth.currentUser;
  if (!user) throw new Error("Debes iniciar sesión para reservar.");

  const uid = user.uid;
  const nombre = (user.displayName ?? "").trim();
  const correo = (user.email ?? "").trim();

  if (!nombre) throw new Error("Tu perfil no tiene nombre. Actualiza tu perfil.");
  if (!correo) throw new Error("Tu cuenta no tiene correo.");

  const dupQ = query(
    collection(db, "reservas"),
    where("userId", "==", uid),
    where("actividadId", "==", actividad.id),
    where("actividadFecha", "==", actividad.fecha),
    limit(1)
  );

  const dupSnap = await getDocs(dupQ);
  if (!dupSnap.empty) {
    const estado = (dupSnap.docs[0].data() as any).estado as ReservaEstado;
    if (estado !== "anulada") {
      throw new Error("Ya tienes una reserva activa para esta actividad y fecha.");
    }
  }

  const disponibilidadRef = doc(
    db,
    "actividadDisponibilidad",
    availDocId(actividad.id, actividad.fecha)
  );

  const reservasCol = collection(db, "reservas");

  await runTransaction(db, async (tx) => {
    const availSnap = await tx.get(disponibilidadRef);

    if (!availSnap.exists()) {
      if (actividad.cupo <= 0) throw new Error("Cupo inválido para esta actividad.");

      tx.set(disponibilidadRef, {
        actividadId: actividad.id,
        fecha: actividad.fecha,
        cupo: actividad.cupo,
        reserved: 1,
        updatedAt: serverTimestamp(),
      });
    } else {
      const data = availSnap.data() as any;
      const cupo = Number(data.cupo ?? actividad.cupo);
      const reserved = Number(data.reserved ?? 0);

      if (reserved >= cupo) throw new Error("Cupo agotado para esta actividad.");
      tx.update(disponibilidadRef, {
        reserved: reserved + 1,
        updatedAt: serverTimestamp(),
      });
    }

    const reservaRef = doc(reservasCol);
    tx.set(reservaRef, {
      userId: uid,
      actividadId: actividad.id,
      actividadFecha: actividad.fecha,
      actividadHora: actividad.hora,
      actividadTitulo: actividad.titulo,
      nombre,
      correo,
      estado: "pendiente",
      createdAt: serverTimestamp(),
    });
  });
}

/** ✅ Anula tu reserva + decrementa disponibilidad */
export async function cancelMyReserva(reservaId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("No autenticado");

  const reservaRef = doc(db, "reservas", reservaId);

  await runTransaction(db, async (tx) => {
    const reservaSnap = await tx.get(reservaRef);
    if (!reservaSnap.exists()) throw new Error("Reserva no encontrada.");

    const r = reservaSnap.data() as any;

    if (r.userId !== user.uid) throw new Error("No autorizado.");
    if (r.estado === "anulada") return;

    const actividadId = String(r.actividadId);
    const fecha = String(r.actividadFecha);

    const disponibilidadRef = doc(db, "actividadDisponibilidad", availDocId(actividadId, fecha));
    const availSnap = await tx.get(disponibilidadRef);

    tx.update(reservaRef, { estado: "anulada" });

    if (availSnap.exists()) {
      const data = availSnap.data() as any;
      const cupo = Number(data.cupo ?? 0);
      const reserved = Number(data.reserved ?? 0);
      const next = Math.max(0, reserved - 1);

      tx.update(disponibilidadRef, {
        actividadId,
        fecha,
        cupo,
        reserved: next,
        updatedAt: serverTimestamp(),
      });
    }
  });
}
