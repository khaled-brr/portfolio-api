# End-to-end Flow — full trace of one dashboard action

A whirlwind tour through every file that runs when an admin edits a project
name and clicks "Save". Use this to see how the pieces fit.

> Pair with [`FLOW.md`](./FLOW.md) (backend) and
> [`../portfolio/FLOW.md`](../portfolio/FLOW.md) (frontend).

---

## Scenario

Admin is logged in. On `/admin/projects`, they click "Edit" on a project,
change the name from `"Tafweej"` to `"Tafweej v2"`, and click "Save".

---

## 1. Frontend click → HTTP request

### `portfolio/pages/admin/projects.vue` (frontend repo)

The Save button:
```html
<button class="admin-btn" :disabled="saving" @click="save">Save</button>
```

`save()`:
```ts
const save = async () => {
  saving.value = true
  editing.value.tech = techText.value.split(',').map(s => s.trim()).filter(Boolean)

  if (editing.value._id) {
    await api(`/api/admin/projects/${editing.value._id}`, {
      method: 'PUT',
      body: editing.value,
    })
  }

  editing.value = null
  await load()
}
```

### `portfolio/composables/useApi.ts`
```ts
const api = (path, opts) =>
  $fetch(`${apiBase}${path}`, { credentials: 'include', ...opts })
```

Resolves to:
```
PUT https://portfolio-api-virid-ten.vercel.app/api/admin/projects/69e1…
Cookie: admin_token=eyJhbGc…
Content-Type: application/json
Body: { "_id": "69e1…", "name": "Tafweej v2", "client": "…", … }
```

---

## 2. Request hits Vercel edge → invokes `portfolio-api`

Vercel routes anything matching `src/server.js` (see `vercel.json`) to the
Express app.

### `portfolio-api/src/server.js`

```
app.use(cors(...))              ← step a
app.use(express.json(...))      ← step b
app.use(cookieParser())         ← step c
app.use(async (req, res, next) => await connectMongo())  ← step d
app.use('/api/admin', adminRoutes)  ← step e
```

**Step a** — CORS middleware:
- `Origin: https://my-portfolio-nine-eta-88.vercel.app` ✅ in allow-list
- Response headers set: `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`

**Step b** — `express.json()` parses the JSON body into `req.body`.

**Step c** — `cookieParser()` reads the `Cookie:` header, puts `admin_token`
on `req.cookies`.

**Step d** — Mongo connection middleware — either reuses the cached
connection (warm) or opens a new one (cold). Takes ~0ms if warm, ~800ms if cold.

**Step e** — URL starts with `/api/admin`, so control hands to
`src/routes/admin.js`.

---

## 3. Inside `admin.js`

### `portfolio-api/src/routes/admin.js`

```js
router.use(requireAuth)   // 🛡️ gate — runs before any admin handler
```

### `portfolio-api/src/utils/auth.js`
```js
export function requireAuth(req, res, next) {
  const token = req.cookies?.admin_token
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = verifyToken(token)   // jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
```

`verifyToken()` uses `JWT_SECRET` (from env) to check the signature. If the
signature is valid and the token isn't expired, it returns the decoded
payload: `{ sub, email, role, iat, exp }`. We stash it on `req.user`.

### Back in `admin.js` — the PUT handler

From the `crud('/projects', Project, 'project', (d) => d.name)` call:

```js
router.put(`${path}/:id`, async (req, res) => {
  const doc = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  await logActivity({
    action: 'update', entity: label, entityId: req.params.id,
    summary: `Updated: ${summaryFn(doc)}`,
    user: req.user.email,
  })
  res.json(doc)
})
```

Two things happen in parallel:
1. **Write the project** — Mongoose issues an `updateOne` to Mongo, returns the new doc.
2. **Write the activity log** — a separate collection records who updated what.

---

## 4. Mongo update

### `portfolio-api/src/models/Project.js`
```js
const ProjectSchema = new mongoose.Schema({
  name: String, client: String, type: String,
  category: { type: String, enum: [...] },
  published: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true })
```

Mongoose validates:
- Are all the fields the correct types?
- Is `category` one of the enum values?

If valid, the network call to Atlas:
```
msg: update
filter: { _id: ObjectId("69e1…") }
update: { $set: { name: "Tafweej v2", …, updatedAt: Date.now() } }
```

Mongo updates the single document, returns the new version.

---

## 5. Activity log write

### `portfolio-api/src/utils/activity.js`
```js
export async function logActivity({ action, entity, entityId, summary, user }) {
  await ActivityLog.create({ action, entity, entityId, summary, user })
}
```

Produces a new document in the `activitylogs` collection:
```json
{
  "action": "update",
  "entity": "project",
  "entityId": "69e1…",
  "summary": "Updated: Tafweej v2",
  "user": "aymankhaled575@gmail.com",
  "createdAt": "2026-04-24T17:30:00Z"
}
```

The overview dashboard reads from this collection to display "Recent Activity".

---

## 6. Response → frontend

```
HTTP 200
Content-Type: application/json
Body: { _id, name: "Tafweej v2", client, type, ..., updatedAt }
```

The browser receives the response. Frontend `save()` continues:
```ts
editing.value = null    // close the modal
await load()            // re-fetch the full project list
```

### `load()`:
```ts
items.value = await api('/api/admin/projects')
```

This fires another request — `GET /api/admin/projects` — goes through the
same middleware chain, hits `router.get(path, ...)` in `admin.js`, which does:
```js
res.json(await Model.find().sort({ order: 1 }).lean())
```

The updated project comes back with the new name. Vue's reactivity
re-renders the list. User sees "Tafweej v2" in the UI.

---

## 7. Total round trip

| Step | Location | ms (typical warm) |
|---|---|---|
| Click → fetch start | Browser | 0 |
| Browser → Vercel edge | Network | 20 |
| Vercel → Express (warm) | Vercel runtime | 5 |
| Middleware chain | Node | 3 |
| Mongo query | Atlas (same region) | 40 |
| Response JSON → browser | Network | 20 |
| Vue re-render | Browser | 2 |
| **Total** | | **~90ms** |

Cold starts add 500-2000ms on the first hit after 5+ minutes idle.

---

## 8. Where things can go wrong (and how to debug)

| Symptom | Where to look |
|---|---|
| 401 on admin endpoint | JWT expired, cookie missing, `credentials: 'include'` not set |
| CORS error in browser | `FRONTEND_ORIGIN` env var doesn't include current origin |
| 500 "MongooseServerSelectionError" | Atlas IP whitelist doesn't include `0.0.0.0/0` |
| 500 "bad auth" | Wrong MongoDB user/password in `MONGODB_URI` |
| Cookie not sent across origins | `SameSite=None` and `Secure` both required in prod |
| Changes not showing on public site | Section components still reading static `data/` — see frontend FLOW.md §8 |

### Useful commands when debugging:
```bash
# Backend logs (last 50 lines, live)
vercel logs portfolio-api --follow

# Test API from your shell
curl -sS -i https://portfolio-api-virid-ten.vercel.app/api/public/hero

# Verify env vars are set
vercel env ls production

# Local development — run both at once
cd portfolio-api && npm run dev &   # :4000
cd portfolio       && npm run dev   # :3000
```

---

## 9. Security checklist (good to know by heart)

✅ **Passwords** are bcrypt-hashed — never stored in plain text.
✅ **JWT** is `httpOnly` — JS can't read it (prevents XSS theft).
✅ **JWT** is `Secure` — only sent over HTTPS in production.
✅ **JWT** is `SameSite=None` cross-origin (required for cookie auth).
✅ **CORS** allow-list is explicit — arbitrary origins rejected.
✅ **`JWT_SECRET`** is 64-byte random, stored only in Vercel env vars.
✅ **`MONGODB_URI`** password stored only in Vercel env vars; never in git.
✅ **`.env`** files are gitignored.
⚠️  **Admin password** (`devDEV@@@`) is weak — change it in production.
⚠️  **No rate limiting yet** — add `express-rate-limit` before going big.

---

## 10. Quick reference — which file does what

### Backend (this repo)
| File | Role |
|---|---|
| `src/server.js` | Express entry; wires middleware + routes |
| `src/utils/db.js` | Mongo connection (cached across serverless invocations) |
| `src/utils/auth.js` | JWT sign/verify, bcrypt, `requireAuth` middleware |
| `src/utils/seed.js` | First-boot seeder (runs if DB empty) |
| `src/utils/activity.js` | Audit log helper |
| `src/models/*.js` | Mongoose schemas, one per collection |
| `src/routes/auth.js` | `/api/auth/*` — login, logout, me |
| `src/routes/public.js` | `/api/public/*` — no auth required |
| `src/routes/admin.js` | `/api/admin/*` — JWT required |

### Frontend (`../portfolio`)
| File | Role |
|---|---|
| `app.vue` | Root, just `<NuxtPage />` |
| `nuxt.config.ts` | Config + `apiBase` env derivation |
| `composables/useApi.ts` | The one function that talks to the backend |
| `middleware/admin.ts` | Route guard for `/admin/*` |
| `layouts/admin.vue` | Sidebar, logout, admin chrome |
| `pages/admin/*.vue` | One file per dashboard screen |
| `pages/index.vue` | Public portfolio (page-flip UI + analytics) |

Read both FLOW.md files, then this one, then open any single file and you
should be able to trace it from top to bottom.

Happy hacking.
