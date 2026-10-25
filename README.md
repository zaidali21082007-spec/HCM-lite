# HCM Lite

HCM Lite is a web-based Human Capital Management system for Admin, HR, and Employee roles. It includes attendance with face and GPS check-in, leave approval, monthly payroll with payslip PDFs, dashboards, and an AI assistant.

## Links

- Repository: https://github.com/zaidali21082007-spec/HCM-lite
- Live app: https://hcm-lite-eight.vercel.app/

## Stack

- Backend: Node.js, Express, Prisma, SQLite (development), JWT, bcryptjs, Zod, pdfkit, geolib
- Frontend: React, Vite, Recharts, @vladmandic/face-api (SSD MobileNet v1 and TinyFaceDetector)
- AI: any hosted LLM with tool calling, configured with an API key

## Run locally

1. Backend: open a terminal in backend/, copy .env.example to .env, fill in JWT_SECRET (and AI_API_KEY if you have one), then run npm install, npx prisma db push --schema=prisma/schema.prisma, and npm run dev (port 5000).
2. Frontend: in a second terminal, open frontend/, run npm install, then npm run dev. Open the port Vite prints (usually 5173).
3. The app starts empty and shows the first-run setup screen.

## First Admin

The setup screen asks for the company name, Admin email, Admin password (at least 8 characters), and office hours. Leave the office latitude, longitude, and radius blank if you don't want the geofence check yet. The Admin then creates HR logins, HR registers employees, and each employee gets a temporary password that must be changed on first sign-in.

## Environment variables (backend/.env)

- DATABASE_URL: for example file:./dev.db
- JWT_SECRET: a long random string
- AI_API_KEY: your hosted LLM key. Without it, the assistant uses built-in answers.
- PORT: optional, default 5000

Never commit .env. Only .env.example belongs in the repository.

## Face and GPS check-in (Employee role)

- Allow camera and location access, then look straight at the camera with your whole face visible.
- Detection works best in front-facing light and drops when the face is partly out of frame.
- The server checks GPS accuracy (100 m or better) and the office radius when Admin has set the office location. The server stamps the time. No photos are sent or stored.
- Indoor GPS on a laptop can be slow. Use Retry if location times out.
- One check-in per employee per day.

## Tests

- Backend: npm test inside backend/
- Frontend: npm run build inside frontend/

## Done

- Three roles with server-side access checks
- First-run setup, company settings, departments, leave types, holidays
- Employee registration with temporary password, CSV dry run and export
- Web check-in and check-out, attendance board, corrections
- Leave apply, cancel, approve or reject with comment
- Payroll draft, Admin finalize (locks the month), payslip PDF
- Dashboards with date and department filters
- AI assistant with tool calling, dashboard summary, smart leave prefill, policy Q&A
- Audit log, notifications, announcements
- Face detection check-in with GPS accuracy and office geofence
- Dark and light theme

## Not done

- Face identity matching (the check confirms one face, not who it is)
- Blink or liveness check
- Mobile app (web only)
- PostgreSQL (SQLite is used)
- Roman Urdu support and PWA mode
- Measured test coverage

## Backend note

The live frontend (https://hcm-lite-eight.vercel.app/) needs the backend API running. During judging, the backend runs locally on port 5000 and is exposed through a temporary tunnel. Run it with: cd backend && npm run dev. Login and data depend on the backend being reachable.

## Live backend

https://respect-barnes-mostly-organ.trycloudflare.com

Health check: https://respect-barnes-mostly-organ.trycloudflare.com/health
