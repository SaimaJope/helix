# Helix content API

A Cloudflare Worker (free tier) that gives the institute's staff a username and
password login for `admin.html`, and publishes their edits and image uploads as
commits to the GitHub repository that GitHub Pages serves.

No database. The repository is the database, GitHub Pages is the host, the Worker
is the only moving part.

## Deploy (once, about five minutes)

1. Log in to Cloudflare in an interactive terminal:

       cd helix-main/api
       npx wrangler login

2. Create a GitHub token for the Worker: GitHub → Settings → Developer settings →
   Fine-grained tokens → Generate. Repository access: only `SaimaJope/helix`.
   Permissions: **Contents: Read and write**. Copy the token.

3. Create the staff accounts. One line per person:

       node hash-password.mjs martim "Martim Galésio" "a-long-password"
       node hash-password.mjs giovanni "Giovanni De Brito" "another-long-password"
       node hash-password.mjs mathieu "Mathieu Plaquevent" "third-long-password"

   Put the printed objects into one JSON array, for example
   `[{"username":"martim",...},{"username":"giovanni",...}]`.

4. Store the secrets and deploy:

       npx wrangler secret put USERS            # paste the JSON array
       npx wrangler secret put SESSION_SECRET   # any long random string
       npx wrangler secret put GITHUB_TOKEN     # the token from step 2
       npx wrangler deploy

   The deploy prints the Worker URL, e.g. `https://helix-content-api.<account>.workers.dev`.

5. Put that URL into `admin.html` (`const API_BASE = '...'`) and push.

## Endpoints

| Method | Path              | What                                                     |
|--------|-------------------|----------------------------------------------------------|
| POST   | /login            | `{username, password}` → `{token, user}` (12 h token)    |
| GET    | /me               | who am I                                                 |
| GET    | /content/:name    | latest published JSON plus its git sha                   |
| PUT    | /content/:name    | `{data, sha}` → commits `content/<name>.json`            |
| POST   | /upload           | multipart `file` → commits to `uploads/YYYY/MM/…`        |
| GET    | /status           | last commits and the latest Pages build state            |

Collections: projects, publications, initiatives, news, events, products,
opportunities, team, settings.

## Changing a password

Run `hash-password.mjs` again, replace that person's entry in the USERS secret,
`npx wrangler secret put USERS`, done. Removing an entry removes the login.

## Local test

    echo 'USERS=[...]' > .dev.vars   # plus SESSION_SECRET and GITHUB_TOKEN
    npx wrangler dev
