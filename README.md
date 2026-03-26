# CalorieFit

AI-powered fitness and nutrition assistant for web and mobile.

## Apps
- Web: Next.js + TypeScript + Tailwind
- Mobile: Expo (React Native)
- Server: Fastify + Groq (Llama)

## Prerequisites
- Node.js 20+
- npm

## Setup
```bash
npm install
```

### Environment
Create these files:
- `server/.env`
  ```bash
  GROQ_API_KEY=your_key
  GROQ_MODEL=llama-3.3-70b-versatile
  PORT=4000
  HOST=0.0.0.0
  ```

- `apps/mobile/.env`
  ```bash
  EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:4000
  ```

- `apps/web/.env.local`
  ```bash
  NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
  ```

## Run
```bash
npm run dev:server
npm run dev:web
npm run dev:mobile
```

Web runs at `http://localhost:3001`.

## Notes
- For mobile, use your machine’s LAN IP in `apps/mobile/.env`.
- Expo Go on iOS requires SDK 54 (this project is SDK 54).
