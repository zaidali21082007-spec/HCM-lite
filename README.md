# HCM Lite

HCM Lite is a web-based Human Capital Management system for Admin, HR, and Employee roles. It includes attendance with face and GPS check-in, leave approval, monthly payroll with payslip PDFs, dashboards, and an AI assistant.

## Links

- Repository: https://github.com/zaidali21082007-spec/HCM-lite
- Live app: https://hcm-lite-eight.vercel.app/

## Stack

- Backend: Node.js, Express, Prisma, SQLite (development), JWT, bcryptjs, Zod, pdfkit, geolib
- Frontend: React, Vite, Recharts, @vladmandic/face-api (SSD MobileNet v1 and TinyFaceDetector)
- AI: any hosted LLM with tool calling, configured with an API key

## Project structure

- backend/ : API, business rules, Prisma schema, tests
- frontend/ : React app, pages, components, face model files in public/models
- .env.example : environment variable names with empty values

## Run locally

1. Backend
   - Open a terminal in the backend folder.
   - Copy .env.example to .env and fill in JWT_SECRET. Add AI_API_KEY if you have one.
   - Run: npm install
   - Run: npx prisma db push --schema=prisma/schema.prisma
   - Run: npm run dev (the API runs on port 5000)
2. Frontend
   - Open a second terminal in the frontend folder.
   - Run: npm install
   - Run: npm run dev (open the port Vite prints, usually 5173)
3. Open the app in your browser. The app starts empty and shows the first-run setup screen.

## First Admin

On first run, the setup screen asks for the company name, the Admin email, the Admin password (at least 8 characters), and office hours. Leave the office latitude, longitude, and radius blank if you do not want the geofence check yet.

The Admin then creates HR logins. HR registers employees. Each employee receives a temporary password and must change it on first sign-in.

## Environment variables (backend/.env)

- DATABASE_URL: for example file:./dev.db
- JWT_SECRET: a long random string
- AI_API_KEY: your hosted LLM key. Without it, the assistant uses built-in service answers.
- PORT: optional, default 5000

Never commit .env. Only .env.example belongs in the repository.

## Face and GPS check-in (Employee role)

- Open Web Check-In and allow camera and location access.
- Look straight at the camera with your whole face and forehead visible. Detection works best in front-facing light. It drops when the face is partly out of frame or the light is behind you.
- The server checks GPS accuracy (100 m or better) and the office radius when Admin has set the office location. The server stamps the time. No photos are sent or stored.
- Indoor GPS on a laptop can be slow or approximate. Use the Retry button if location times out.
- One check-in per employee per day. A second attempt is rejected.

## Theme

The app supports dark mode (default) and light mode. Use the sun/moon toggle in the navigation bar. The choice is saved in the browser.

## Tests

- Backend: run npm test inside the backend folder.
- Frontend: run npm run build inside the frontend folder.

The backend tests cover attendance status, leave days, payroll math, tax slabs, and validation.

## Done

- Three roles with server-side access checks
- First-run setup, company settings, departments, leave types, holidays
- Employee registration with temporary password, CSV dry run and export
- Web check-in and check-out, attendance board, corrections
- Leave apply, cancel, approve or reject with comment
- Payroll draft, Admin finalize (locks the month), payslip PDF
- Dashboards with date and department filters
- AI assistant with tool calling, dashboard summary, smart leave prefill, policy Q&A, rate limit, and logging
- Audit log, notifications, announcements
- Face detection check-in with GPS accuracy and office geofence
- Dark and light theme

## Not done

- Face identity matching against an enrolled face (the check confirms one face, not who it is)
- Blink or liveness check
- Mobile app (web only)
- PostgreSQL setup (SQLite is used)
- Roman Urdu support and PWA mode
- Measured test coverage
