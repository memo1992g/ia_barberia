# EVO Voice Agent

Demo web profesional para **Imperial Barber Studio** con agente de voz **Sofía IA**.

## Estructura

- `frontend`: Next.js + React + Tailwind CSS
- `backend`: Node.js + Express + OpenAI Realtime + Google Calendar

## Requisitos

- Node.js 18 o superior
- Una cuenta de servicio de Google Calendar con acceso al calendario compartido
- `OPENAI_API_KEY` con acceso a Realtime

## Configurar backend

```bash
cd backend
npm install
copy .env.example .env
```

Rellena las variables en `backend/.env`.

### Opciones de Google Calendar

- Opción 1: usar `GOOGLE_PRIVATE_KEY` y `GOOGLE_CLIENT_EMAIL`
- Opción 2: usar `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`

## Configurar frontend

```bash
cd frontend
npm install
copy .env.example .env.local
```

## Ejecutar en desarrollo

Abre dos terminales:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Frontend: `http://localhost:3000`

Backend: `http://localhost:3001`

## Probar la llamada

1. En Google Calendar, crea un evento manual en el mismo calendario compartido, por ejemplo a las `15:00`.
2. Abre la demo y pulsa **Iniciar llamada demo**.
3. Pide una cita en ese mismo horario.
4. Verifica que Sofía responda que el horario está ocupado y ofrezca alternativas.
5. Pide una cita en un horario libre.
6. Confirma la cita cuando Sofía te lo pida.
7. Revisa que el evento aparezca en Google Calendar con el título `Cita - {servicio} - {nombre}`.

## Modo mock

Si quieres probar la UI sin tocar Google Calendar real:

- backend: `USE_MOCKS=true`
- frontend: `NEXT_PUBLIC_DEMO_MODE=true`

En modo mock, `15:00` aparece ocupado por defecto y el resto se comporta como libre.

## Verificar el evento

1. Entra al calendario compartido de la barbería.
2. Busca el evento creado por la demo.
3. Confirma que el título siga este formato:

```text
Cita - {servicio} - {customerName}
```

4. Verifica que la descripción incluya:

```text
Cliente:
Teléfono:
Servicio:
Fecha:
Hora:
Creado por: EVO Voice Agent
```

## Despliegue en Vercel

El frontend ya incluye rutas server-side para funcionar como despliegue único en Vercel.

1. Sube el repositorio a GitHub.
2. Crea un proyecto nuevo en Vercel.
3. Usa `frontend` como `Root Directory`.
4. Deja los comandos por defecto:
   - Build: `npm run build`
   - Start: automático de Next.js
5. Configura estas variables en Vercel:
   - `OPENAI_API_KEY`
   - `GOOGLE_CLIENT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_CALENDAR_ID`
   - `USE_MOCKS=false`
   - `NEXT_PUBLIC_DEMO_MODE=false`
6. Deja `NEXT_PUBLIC_API_URL` vacío para que la app use sus rutas internas de Vercel.
7. Si prefieres mantener el backend Express local o en otro host, entonces sí puedes usar `NEXT_PUBLIC_API_URL` apuntando a ese backend.

Rutas disponibles en Vercel:

- `POST /api/realtime/session`
- `POST /api/calendar/availability`
- `POST /api/calendar/appointment`
