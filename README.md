# Scout 🏆

**Cornell Athlete Alumni Networking Platform**

Connect with Cornell athlete alumni who've made it in finance, tech, consulting, and more. Get personalized introductions and insider advice.

<img width="1919" height="957" alt="image" src="https://github.com/user-attachments/assets/62b5fe5d-1677-49a1-8ba5-7e21244dada6" />


## Features

- 🔍 **Discover Alumni** - Search by industry, sport, company, or name
- 👥 **Build Your Network** - Save and manage connections
- ✉️ **AI-Powered Outreach** - Generate personalized messages
- ✅ **Track Progress** - Know who you've contacted
- 🔐 **Privacy First** - Built with respect for alumni privacy

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Icons**: Lucide React

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/scout.git
cd scout
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for your database to be ready
3. Go to **SQL Editor** and run the following files in order:
   - `supabase/migrations/001_initial_schema.sql` (creates tables, RLS, functions)
   - `supabase/migrations/002_seed_data.sql` (adds sample alumni data)

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Then fill in your Supabase credentials (found in Project Settings > API):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profiles (extends Supabase auth) |
| `alumni` | Alumni directory |
| `user_networks` | User's saved connections |
| `messages` | Outreach message history |

### Row Level Security (RLS)

All tables have RLS enabled:
- Users can only view/edit their own profiles
- Users can view public alumni
- Users can only manage their own network/messages

---

## Project Structure

```
scout/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Global styles
│   ├── discover/           # Alumni discovery page
│   ├── network/            # User's network page
│   ├── profile/            # User profile page
│   ├── login/              # Login page
│   ├── signup/             # Signup page
│   └── auth/callback/      # Auth callback handler
├── components/
│   ├── Navbar.tsx          # Navigation bar
│   ├── AlumniCard.tsx      # Alumni card component
│   ├── NetworkRow.tsx      # Network list item
│   ├── MessageModal.tsx    # AI message modal
│   └── SearchFilters.tsx   # Search and filter controls
├── lib/
│   └── supabase/
│       ├── client.ts       # Browser Supabase client
│       └── server.ts       # Server Supabase client
├── types/
│   └── database.ts         # TypeScript types
└── supabase/
    └── migrations/         # SQL migration files
```

---

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy!

### Supabase Configuration for Production

1. Go to Authentication > URL Configuration
2. Add your Vercel URL to "Site URL"
3. Add callback URL: `https://your-app.vercel.app/auth/callback`

---

## Adding Real Alumni Data

### Option 1: Admin Panel (Recommended)
Build an admin interface to manually add alumni.

### Option 2: Alumni Opt-In Form
Create a Google Form or Typeform for alumni to submit their info.

### Option 3: Import from CSV
```sql
COPY alumni(full_name, sport, graduation_year, company, role, industry, location, source)
FROM '/path/to/alumni.csv'
WITH (FORMAT csv, HEADER true);
```

---

## Customization

### Change Colors
Edit `tailwind.config.js`:
```js
colors: {
  'cornell-red': '#B31B1B',      // Primary brand color
  'cornell-red-light': '#e63946', // Accent color
}
```

### Add AI Message Generation
To use Claude API for dynamic messages:

1. Add to `.env.local`:
   ```env
   ANTHROPIC_API_KEY=your-api-key
   ```

2. Create an API route at `app/api/generate-message/route.ts`

3. Call the API from the MessageModal component

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## License

MIT License - feel free to use this for your own school!

---

## Support

- Open an issue for bugs
- Start a discussion for feature requests
- DM on Twitter: @yourhandle

Built with ❤️ by Cornell Athletes
