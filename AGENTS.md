# Agent instructions

## Cursor Cloud specific instructions

- This repository is a Node/Express WhatsApp webhook backend; standard start commands live in `package.json` (`npm run dev` for nodemon, `npm start` for plain Node).
- The app constructs the Supabase client during startup, so set `SUPABASE_URL` and `SUPABASE_ANON_KEY` before running the server. The reminder worker also starts on import and queries Supabase once per minute.
- Full end-to-end subscription testing needs a reachable Supabase project with `messages`, `subscriptions`, and `reminders` tables plus `GUPSHUP_API_KEY` for outbound WhatsApp replies. Without those credentials, local route checks can run with a Supabase-compatible stub, but live WhatsApp/Supabase behavior is not fully verified.
- There are currently no configured lint, test, or build npm scripts; use `npm run` to confirm available scripts before assuming those checks exist.
