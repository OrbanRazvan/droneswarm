# Drone Swarm.io - React Vite + NestJS + PostgreSQL + Prisma

Proiect starter pentru un joc browser casual, inspirat de stilul agar.io/slither.io.

## Structura

```txt
frontend/
  src/components/Dashboard/Dashboard.jsx
  src/components/Dashboard/Dashboard.css
  src/components/GameArena/GameArena.jsx
  src/components/DroneSwarm/DroneSwarm.jsx
  ...
backend/
  src/
  prisma/schema.prisma
```

## 1. Baza de date

Ai spus că baza există deja cu numele `ClientVault`.

Creează în `backend` un fișier `.env` după modelul `.env.example`:

```env
DATABASE_URL="postgresql://postgres:PAROLA_TA@localhost:5432/ClientVault?schema=public"
PORT=3000
```

## 2. Rulează backend-ul

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

Backend-ul pornește pe:

```txt
http://localhost:3000
```

Endpoint-uri demo:

```txt
GET http://localhost:3000/game/state
GET http://localhost:3000/players/leaderboard
POST http://localhost:3000/players/demo
```

## 3. Rulează frontend-ul

```bash
cd frontend
npm install
npm run dev
```

Frontend-ul pornește pe:

```txt
http://localhost:5173
```

## 4. Ce ai acum

- UI fullscreen de browser game
- arenă dark/neon
- drone swarm-uri colorate
- leaderboard
- chat box
- minimap
- ability bar
- structură pe componente
- backend NestJS + Prisma pregătit pentru PostgreSQL

## 5. Următorul pas logic

După ce pornește UI-ul, următorul pas este să adaugi mișcarea reală a jucătorului cu mouse-ul și WebSocket pentru multiplayer.
