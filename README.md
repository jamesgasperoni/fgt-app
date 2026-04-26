# Fourth Generation Tile — Business Manager

A full business management app for Fourth Generation Tile. Tracks jobs, income, expenses (with vendor memory + auto-categorization), S-corp owner compensation, and quarterly tax estimates.

## Deploy Steps

### 1. Supabase (database)
1. Go to supabase.com → create a project
2. Go to Database → SQL Editor → New query
3. Paste and run the contents of `supabase-schema.sql`
4. Go to Settings → API → copy your Project URL and anon/public key

### 2. GitHub (code host)
1. Create a new repo at github.com (name it `fgt-app` or similar)
2. Upload all files in this folder to the repo

### 3. Vercel (hosting — free)
1. Go to vercel.com → sign up with your GitHub account
2. Click "Add New Project" → import your GitHub repo
3. Under "Environment Variables" add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click Deploy

Your app will be live at a free `.vercel.app` URL in about 60 seconds.

## Local development (optional)
```
npm install
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```
