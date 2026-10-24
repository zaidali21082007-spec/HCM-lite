# HCM Lite — Web-Based HR Management System with AI Assistant

**HCM Lite** is a web-based HR Management System with role-based access control (Admin, HR, Employee), face-recognition and GPS geofence attendance check-in, leave management with working-day calculation, progressive tax payroll calculation with PDF payslips, audit logging, and an integrated AI assistant.

---

## 🛠️ Technology Stack

- **Backend**: Node.js + Express
- **Authentication**: JWT authentication, bcryptjs password hashing, role-based middleware
- **Validation**: Zod schema validation on API request payloads
- **Database**: Prisma ORM with SQLite (zero-config local default `dev.db`) or PostgreSQL
- **Frontend**: React 18, Vite, Vanilla CSS design system, Lucide icons, Recharts
- **Face Recognition**: `@vladmandic/face-api` (TinyFaceDetector loaded from `/models`)
- **Geofencing**: `geolib` (`isPointWithinRadius`, `getDistance`) with GPS geolocation
- **PDF Generation**: `pdfkit` for server-side generated employee payslips
- **AI Assistant**: Hosted LLM tool-calling (Google Gemini / OpenAI) with deterministic service-layer fallback

---

## ⚡ Run in Under 10 Minutes

### 1. Clone & Install Dependencies

```bash
# Backend dependencies
cd backend
npm install
npx prisma db push

# Frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment

Copy `.env.example` in `backend/.env`:
```bash
cp .env.example .env
```
Edit `backend/.env` with your values (no hardcoded credentials required):
```env
PORT=5000
DATABASE_URL="file:./dev.db"
JWT_SECRET="your_secure_jwt_secret_key"
JWT_EXPIRES_IN="7d"
AI_API_KEY=""
```

### 3. Start Application

In terminal 1 (backend):
```bash
cd backend
npm run dev
```

In terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 👤 First Admin via Setup Screen

HCM Lite starts completely empty with zero dummy data. On first launch:
1. Navigate to `http://localhost:5173` — the app automatically redirects to the **First-Time Setup** screen (`/setup`).
2. Enter your **Company Legal Name**, office working hours, grace period, and create the **Master Admin account** (email & password).
3. Alternatively, setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` automatically provisions the initial Admin account upon first server startup.

---

## 🤖 Setting AI_API_KEY

HCM Lite includes an AI assistant that uses hosted LLM tool-calling to query company policies, live attendance, and leave balances through the service layer.

To enable live LLM tool-calling:
1. Obtain an API key from [Google AI Studio](https://aistudio.google.com/) (Gemini) or OpenAI.
2. In `backend/.env`:
   ```env
   AI_API_KEY="your-actual-api-key"
   AI_PROVIDER="auto"
   AI_MODEL="gemini-1.5-flash"
   ```
3. Restart the backend. If `AI_API_KEY` is not provided, the assistant operates using intelligent deterministic tool-calling rules. Colleague salary queries and unprivileged cross-employee data requests are strictly rejected.

---

## 📷 Face-API Model Setup

The frontend uses `@vladmandic/face-api` to perform client-side face verification before attendance check-in:
1. Model files reside in `frontend/public/models/`:
   - `tiny_face_detector_model-weights_manifest.json`
   - `tiny_face_detector_model.bin`
   - `face_landmark_68_model-weights_manifest.json`
   - `face_landmark_68_model.bin`
2. Vite serves `/public` statically at root URL `/models`.
3. The component loads weights via `faceapi.nets.tinyFaceDetector.loadFromUri('/models')`.
4. If models fail to load, a clear error banner is displayed and check-in remains disabled until resolved.

---

## 📸 Face-Recognition & GPS Check-In (Employee Only)

- **Role Protection**: Only users with the `EMPLOYEE` role can check in (server returns HTTP `403` to Admin and HR; check-in controls are hidden in the UI for non-employees).
- **Camera Feed**: Front-facing webcam stream with real-time face detection executed every 500 ms.
- **Single-Face Validation**: Check-in is enabled only when exactly 1 face is detected. Displays `"No face detected"` or `"More than one face detected"`.
- **GPS Validation**: Browser queries high-accuracy geolocation (`enableHighAccuracy: true`). Coordinates and accuracy in meters are displayed.
- **Server Enforcement**:
  - Rejects with HTTP `422` if GPS accuracy is worse than 100 meters.
  - If office coordinates and radius are empty, geofence check is skipped and noted.
  - If office coordinates are configured, `geolib.isPointWithinRadius` validates proximity; rejects with HTTP `422` if outside allowed radius.
  - Enforces 1 check-in per employee per day; second check-in returns HTTP `409 Conflict`.
  - Server stamps authoritative check-in timestamp (client timestamps ignored). No camera images or photos are sent to or stored on the server.
  - Audit log entry is generated for every check-in event.

---

## 📋 What is Done

1. **Role-Based Access Control**: Server and UI RBAC across Admin, HR, and Employee roles.
2. **First-Run Setup**: Clean initial setup wizard; empty database bootstrap.
3. **Face & GPS Check-In**: Live webcam face detection, GPS geofencing via `geolib`, 100m accuracy gate.
4. **Attendance Management**: Office hours cutoff (`officeStartTime` + `graceMinutes`), 5.0h half-day rules, daily attendance board with real-time status updates (`ON_LEAVE (...)`, `PRESENT`, `LATE`, `HALF_DAY`, `ABSENT`), attendance correction workflows.
5. **Leave Management**: Working-day calculator skipping configured weekends and company holidays, leave quotas, overlap detection (HTTP `422`), over-balance prevention (HTTP `422`), employee cancellation, HR approval with comments.
6. **Payroll Calculation**: Gross formula (`1.5 x Basic`), attendance and unpaid leave deductions, mid-month proration, 5 progressive annual tax slabs, Admin month finalization locking (prevents re-generation or modification with HTTP `403`), PDF payslip generation via `pdfkit`.
7. **Cross-Employee Data Isolation**: Employees restricted to their own profiles, payslips, and attendance (cross-employee access returns HTTP `403`).
8. **Employee Management**: Single employee registration with temporary password generation and forced first-login password change; bulk CSV import with dry-run error reporting (`row`, `field`, `reason`).
9. **Audit Trail**: Immutable system audit logs tracking entity creation, updates, approvals, and payroll finalizations with diffs.

---

## ⚠️ What is Not Done

1. **Physical Biometric Hardware**: Integration with proprietary hardware fingerprint or optical scanner terminals.
2. **Multi-Currency Payroll**: Multi-currency conversion rates (all calculations use company base currency).
3. **Automated Banking Gateway**: Direct automated bank wire API execution (finalized payroll generates exportable records and PDF payslips for disbursement).

---

## 💡 Assumptions

1. **Office Geofence Configuration**: On initial install, office coordinates (`latitude`, `longitude`, `radius`) are empty by default. Geofence verification is skipped until an Admin explicitly configures coordinates in Company Settings.
2. **GPS Accuracy Threshold**: Mobile and desktop browser GPS accuracy must be within 100 meters to ensure valid proximity check.
3. **Face Detection**: Evaluates live face presence (`TinyFaceDetector`) entirely in the client browser. No images are transmitted across the network, preserving user privacy.
4. **Standard Work Week**: Default working days assume Monday through Friday with Saturday and Sunday as weekends, configurable per company.
