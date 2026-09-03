# Helix content API

A Cloudflare Worker (free tier) that gives the institute's staff a username and
password login for `admin.html`, lets each person choose a password on first
sign-in, and publishes their edits and image uploads as commits to the GitHub
repository that GitHub Pages serves. Cloudflare KV stores only the mutable
password hashes.

The repository is the content database, GitHub Pages is the site host, and the
Worker plus one KV namespace handle authentication and publishing.

## Deploy (once, about five minutes)

1. Log in to Cloudflare in an interactive terminal:

       cd helix-main/api
       npx wrangler login

2. Create a GitHub token for the Worker: GitHub → Settings → Developer settings →
   Fine-grained tokens → Generate. Repository access: only `SaimaJope/helix`.
   Permissions: **Contents: Read and write**. Copy the token.

3. Create the staff accounts with temporary passwords. One line per person:

       node hash-password.mjs topgun "TopGun" "1234" --bootstrap
       node hash-password.mjs thomas-shelby "Thomas Shelby" "1234" --bootstrap
       node hash-password.mjs seraphim "Seraphim" "1234" --bootstrap

   `1234` is the one-time bootstrap password. Each person replaces it with their own 2–6 character password, including at least one uppercase letter and one number, the first time they sign in.

   Put the printed objects into one JSON array, for example
   `[{"username":"topgun",...},{"username":"thomas-shelby",...},{"username":"seraphim",...}]`.

4. Create the password store:

       npx wrangler kv namespace create AUTH_KV

   Copy the returned namespace ID into the `[[kv_namespaces]]` block in
   `wrangler.toml` and uncomment that block. This is required for first-login
   password setup; the Worker refuses password login without it.

5. Store the secrets and deploy:

       npx wrangler secret put USERS            # paste the JSON array
       npx wrangler secret put SESSION_SECRET   # any long random string
       npx wrangler secret put GITHUB_TOKEN     # the token from step 2
       npx wrangler deploy

   The deploy prints the Worker URL, e.g. `https://helix-content-api.<account>.workers.dev`.

6. Put that URL into `admin.html` (`const DEFAULT_API = '...'`) and push. Deployed 3 Sep 2026: https://helix-content-api.saimajope.workers.dev

## Security model

- Plaintext passwords are never stored: PBKDF2-SHA256 with a random salt, 100k
  iterations, compared in constant time. Wrong attempts are delayed.
- The temporary password is accepted once, then replaced by a new PBKDF2 hash in
  KV. The first-login setup token expires after 15 minutes and is never stored in
  the browser's persistent storage.
- New passwords are limited to 2–6 characters and must include an uppercase
  letter and a number.
- The static admin page has a session-only front-door PIN (`404`) for casual
  access control; the Worker account login remains the real authorization check.
- Login attempts are rate limited: 5 per minute per IP and per username.
- Sessions are HMAC-signed tokens that expire after 8 hours; the admin keeps them
  in session storage (gone when the tab closes) and logs out after 30 idle
  minutes. Rotating SESSION_SECRET invalidates every session at once.
- Uploads are checked by file signature, not by the name the browser sends; only
  JPG, PNG, WebP, GIF and PDF are accepted, never SVG. 8 MB maximum.
- Everything travels over HTTPS (workers.dev and github.io). The API only answers
  browsers from the site's own origin. The admin page carries a Content Security
  Policy and is excluded from search engines.
- The GitHub token lives only in the Worker secret, scoped to this one
  repository's contents. Revoke it on GitHub to cut all publishing at once.

## Endpoints

| Method | Path              | What                                                     |
|--------|-------------------|----------------------------------------------------------|
| POST   | /login            | `{username, password}` -> session (8 h) or first-login setup token (15 min) |
| POST   | /password/setup   | `{setupToken, password, confirmPassword}` → `{token, user}` |
| GET    | /me               | who am I                                                 |
| GET    | /content/:name    | latest published JSON plus its git sha                   |
| PUT    | /content/:name    | `{data, sha}` → commits `content/<name>.json`            |
| POST   | /upload           | multipart `file` → commits to `uploads/YYYY/MM/…`        |
| GET    | /status           | last commits and the latest Pages build state            |

Collections: projects, publications, initiatives, news, events, products,
opportunities, team, settings.

## Changing a password

Password recovery is intentionally manual: the admin page tells the person to
contact Jomppa Tykkyläinen on WhatsApp at +358408451893. To reset an account,
replace that person's temporary hash in `USERS`, delete their `auth-user:<username>`
key from `AUTH_KV`, and update the `USERS` secret. Their next login will ask them
to choose a new password again. Removing an entry from `USERS` removes the login.

## Local test

    echo 'USERS=[...]' > .dev.vars   # plus SESSION_SECRET and GITHUB_TOKEN
    npx wrangler dev
