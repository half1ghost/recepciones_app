export type ReservaEstado =
  | "pendiente"
  | "confirmada"
  | "recepcionada"
  | "no_asistio"
  | "anulada";

export type ActividadTipo = "senderismo" | "rafting" | "canopy" | "cabanas";

export type Actividad = {
  id: string;
  titulo: string;
  descripcion?: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  cupo: number;
  tipo?: ActividadTipo;
};

export type Reserva = {
  id: string;

  userId: string;

  actividadId: string;
  actividadFecha: string;
  actividadHora: string;
  actividadTitulo: string;

  nombre: string;
  correo: string;

  estado: ReservaEstado;

  checkedInAt?: Date | null;
  checkedInBy?: string | null;
};

export type Disponibilidad = {
  actividadId: string;
  fecha: string;
  cupo: number;
  reserved: number;
};
