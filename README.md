# Recepciones App (React + TypeScript + Vite + Firebase)

Proyecto completo mínimo para una página de **Recepciones** (check-in) con Firestore.

## 1) Requisitos
- Node.js 18+
- Un proyecto Firebase (Auth + Firestore)

## 2) Configuración
1. Renombra `.env.example` a `.env`
2. Completa las variables `VITE_FIREBASE_*` con tu `firebaseConfig`.

## 3) Instalar y ejecutar
```bash
npm install
npm run dev
```

## 4) Login
La ruta `/login` permite iniciar sesión con email y contraseña (Firebase Auth).

## 5) Datos en Firestore (modelo recomendado)
Colecciones:
- `actividades/{actividadId}`: `titulo`, `fecha` (YYYY-MM-DD), `hora` (HH:mm), `cupo`
- `reservas/{reservaId}` (denormalizada para queries rápidas):
  - `actividadId`, `actividadFecha`, `actividadHora`, `actividadTitulo`
  - `nombre`, `correo`
  - `estado`: `pendiente|confirmada|recepcionada|no_asistio|anulada`
  - `checkedInAt`, `checkedInBy`

Incluí `firestore.rules` y `firestore.indexes.json` como sugerencia.
