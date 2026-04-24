# Backend Flow — how requests travel through the code

A beginner-friendly walkthrough of this Express + MongoDB backend.
Written so you can learn Node.js by reading the real code.

> If you've never used Express before, think of it as a function that takes an
> HTTP request in and sends a response out. Everything in between is
> "middleware" — small functions the request passes through in order.

---

## 1. The 10,000 ft view

```
Browser ──► Vercel (Node runtime) ──► src/server.js ──► MongoDB Atlas
                                         │
                                         └── Express app with middleware chain
```

**Two ways the code runs:**
- **Local dev**: `npm run dev` starts a regular Node server on `localhost:4000`.
- **Production**: Vercel imports `src/server.js`, grabs `export default app`, and
  invokes it as a serverless function. Nothing else changes — Express handles
  both identically.

That dual-mode is why the bottom of `server.js` says:

```js
if (!process.env.VERCEL) {
  app.listen(PORT, () => { ... })
}
export default app
```

On Vercel, `VERCEL=1` is set automatically, so `app.listen()` is skipped —
Vercel doesn't want you calling `listen()`; it just calls your `app(req, res)`.

---

## 2. File map

```
portfolio-api/
├── src/
│   ├── server.js            ← 🎯 entry point — sets up Express
│   ├── models/              ← Mongoose schemas (one per collection)
│   │   ├── User.js
│   │   ├── Hero.js
│   │   ├── Project.js
│   │   └── …
│   ├── routes/              ← HTTP handlers grouped by concern
│   │   ├── auth.js          ← login / logout / me
│   │   ├── public.js        ← anyone can hit these
│   │   └── admin.js         ← JWT required
│   └── utils/
│       ├── db.js            ← Mongo connection (cached)
│       ├── auth.js          ← JWT sign/verify + password hashing
│       ├── seed.js          ← first-run data seeder
│       └── activity.js      ← audit log helper
├── data/                    ← static seed data (copied from frontend)
├── vercel.json              ← tells Vercel to route everything to server.js
├── package.json
└── .env                     ← local secrets (NOT committed)
```

One sentence per folder:
- **models/** — shape of the data in Mongo (each file = one collection).
- **routes/** — what URLs do when you hit them.
- **utils/** — shared helpers that don't belong to any single route.
- **data/** — the original portfolio content used only the first time the DB boots empty.

---

## 3. Life of a single request

Let's trace what happens when the browser calls
`GET https://portfolio-api-virid-ten.vercel.app/api/public/hero`:

### Step 1 — `src/server.js` receives it

```js
const app = express()
```

Every incoming request walks through **middleware** in order. Each
`app.use(...)` adds one link to the chain. If a link doesn't call `next()`, the
chain stops there.

### Step 2 — CORS check

```js
app.use(cors({
  origin: (origin, cb) => {
    if (allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
```

CORS (Cross-Origin Resource Sharing) is a browser rule: JS on
`my-portfolio-nine-eta-88.vercel.app` isn't allowed to read responses from
`portfolio-api-virid-ten.vercel.app` unless the API explicitly says it's OK.

`credentials: true` lets the browser send cookies in the request. Without it,
our JWT cookie never reaches the backend.

### Step 3 — Body parsing

```js
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
```

- `express.json()` reads the raw JSON body of POST/PUT requests and puts the
  parsed object on `req.body`.
- `cookieParser()` reads the `Cookie:` header and puts each cookie on `req.cookies`.

### Step 4 — Mongo connection guard

```js
app.use(async (_req, _res, next) => {
  await connectMongo()
  if (!seeded) { seeded = true; seedIfEmpty().catch(...) }
  next()
})
```

Before any route runs, we make sure Mongo is connected. On Vercel, each
serverless invocation might reuse the module (warm start) or spin up fresh
(cold start). `connectMongo()` caches the promise in `global.__mongoConn`
so warm invocations reuse the existing socket.

**`seedIfEmpty()`** runs once per container: if the DB has no `User`, create
the admin; if no `Hero`, create it; etc. See `src/utils/seed.js`.

### Step 5 — Router dispatch

```js
app.use('/api/public', publicRoutes)
```

Express looks at the URL. Since `/api/public/hero` starts with `/api/public`,
control hands off to `src/routes/public.js`, which does:

```js
router.get('/hero', async (_req, res) => {
  const doc = await Hero.findOne({ singleton: 'hero' }).lean()
  res.json({ ... })
})
```

`Hero.findOne(...)` issues a MongoDB query via Mongoose. `.lean()` means "give
me a plain JS object, not a full Mongoose document" — faster, smaller.

### Step 6 — Response

`res.json(obj)` serializes the object to JSON and sends HTTP 200.

If anything in the chain throws (e.g. the DB is unreachable), it falls through
to the error handler at the bottom of `server.js`:

```js
app.use((err, _req, res, _next) => {
  console.error('[error]', err)
  res.status(err.status || 500).json({ error: err.message })
})
```

**That's it.** Every single route — public, auth, admin — follows the same
pattern: middleware → router → handler → response.

---

## 4. Three types of routes, three access levels

### 4a. Public routes — `src/routes/public.js`

Anyone can call these. No auth needed. Used by the portfolio site to fetch
data and by visitors to submit contact messages or track page views.

```
GET  /api/public/hero           → read hero section
GET  /api/public/projects       → read project list
POST /api/public/contact        → submit a contact form
POST /api/public/track          → log a page view
```

### 4b. Auth routes — `src/routes/auth.js`

Handle login and session lookup.

```
POST /api/auth/login   → exchange email+password for a cookie
POST /api/auth/logout  → clear the cookie
GET  /api/auth/me      → "am I logged in?"  (protected)
```

The login flow:

```js
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email: email.toLowerCase() })
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  const token = signToken({ sub: user._id.toString(), email, role: user.role })
  res.cookie('admin_token', token, cookieOpts())
  res.json({ ok: true, user: { ... } })
})
```

Plain-English version:
1. Find the user by email.
2. Use `bcrypt.compare()` to check the hashed password. Bcrypt salts the hash
   so two identical passwords still have different hashes — and comparing is
   intentionally slow (~100ms) so attackers can't brute-force.
3. If valid, sign a JWT (a string containing `{ userId, email, role, expiry }`
   signed with `JWT_SECRET`). Anyone can read the contents, but only the
   server can *forge* one.
4. Send the JWT in a cookie named `admin_token`. Options:
   - `httpOnly: true` — JavaScript can't read it (prevents XSS token theft)
   - `secure: true` in prod — HTTPS only
   - `sameSite: 'none'` in prod — allows sending across domains
     (frontend on `vercel.app` A, backend on `vercel.app` B)

### 4c. Admin routes — `src/routes/admin.js`

Everything after the line `router.use(requireAuth)` requires a valid JWT
cookie. `requireAuth` is in `src/utils/auth.js`:

```js
export function requireAuth(req, res, next) {
  const token = req.cookies?.admin_token || req.headers.authorization?.replace(/^Bearer /, '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = verifyToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
```

`verifyToken()` checks the signature against `JWT_SECRET`. If someone edits
the JWT payload, the signature no longer matches and `jwt.verify()` throws.

After that middleware runs, `req.user = { sub, email, role }` is available to
every admin handler.

---

## 5. A note on `crud()` — the DRY helper

There are four collections with identical CRUD needs (experience, skills,
projects, testimonials). Instead of writing 4× the code, `admin.js` has:

```js
function crud(path, Model, label, summaryFn) {
  router.get(path, ...)           // list all
  router.post(path, ...)          // create
  router.put(`${path}/:id`, ...)  // update
  router.delete(`${path}/:id`, ...)  // delete
  router.post(`${path}/reorder`, ...)  // reorder
}

crud('/experience',   Experience,   'experience',    (d) => `${d.role} @ ${d.company}`)
crud('/skills',       SkillCategory,'skillCategory', (d) => d.name)
crud('/projects',     Project,      'project',       (d) => d.name)
crud('/testimonials', Testimonial,  'testimonial',   (d) => `from ${d.name}`)
```

Closures capture `Model` and `summaryFn` — each call to `crud()` registers
five routes specialized for that collection.

**Lesson:** when you see the same pattern three times, extract it into a
function. It makes changes safer (one place instead of four) and shorter.

---

## 6. Environment variables

Never hardcode secrets. Instead, read them from `process.env`:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas connection string (contains DB password) |
| `JWT_SECRET` | 64-byte random string — signs/verifies tokens |
| `ADMIN_EMAIL` | Seeded admin user's email |
| `ADMIN_PASSWORD` | Seeded admin user's initial password |
| `FRONTEND_ORIGIN` | Comma-separated CORS allow-list |
| `NODE_ENV` | `production` → secure cookies, strict CORS |
| `VERCEL` | Set automatically by Vercel; skips `app.listen()` |

Locally these come from `.env` (loaded by `dotenv/config` at the top of `server.js`).
On Vercel they come from the dashboard.

**The `.env` file is gitignored.** If you leaked it, anyone with the
`MONGODB_URI` could dump your database.

---

## 7. How Mongoose models work

A model is a schema + a collection.

```js
const ProjectSchema = new mongoose.Schema({
  name: String,
  category: { type: String, enum: ['government', 'corporate', 'freelance', 'personal'] },
  published: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true })

export const Project = mongoose.model('Project', ProjectSchema)
```

- `Project.find({})` → list
- `Project.findById(id)` → one by ObjectId
- `new Project({ ... }).save()` → insert
- `Project.findByIdAndUpdate(id, { ... }, { new: true })` → update + return new doc
- `Project.findByIdAndDelete(id)` → delete

`timestamps: true` auto-adds `createdAt` and `updatedAt` fields.

The `models.Project || mongoose.model(...)` pattern at the end of each file
avoids "cannot overwrite model once compiled" errors when Vercel hot-reloads.

---

## 8. Mental model cheat sheet

| Concept | Real-world analogy |
|---|---|
| **Express app** | A post office clerk |
| **Middleware** | Stamps the clerk applies to each letter in order |
| **Route** | The specific window a letter goes to, based on the address |
| **Mongoose model** | A typed form for writing records into a filing cabinet |
| **Mongoose query** | Asking the filing clerk for records matching criteria |
| **JWT** | A tamper-evident wristband stamped by the bouncer |
| **Middleware `requireAuth`** | The bouncer checking wristbands |
| **Env var** | A sealed envelope with a secret password |

---

## 9. Next things to learn

- **Mongoose aggregations** — see `/api/admin/analytics/summary` for a real example
- **Indexes** — add `{ index: true }` to fields you query often (we do this on `createdAt`)
- **Transactions** — when you need multiple writes to all succeed or all fail
- **Validation** — Mongoose can reject bad data before it hits Mongo
- **Rate limiting** — prevent abuse (e.g. `express-rate-limit`)
- **Testing** — start with `supertest` + `mongodb-memory-server`

Try adding a new endpoint as practice:
1. Create a new model in `src/models/BlogPost.js`
2. Create a new router in `src/routes/blog.js` (copy-paste from one of the others)
3. Register it in `server.js`: `app.use('/api/blog', blogRoutes)`
4. Restart `npm run dev` and hit it with curl or Postman

If it works locally, `git push` and Vercel will redeploy automatically.
