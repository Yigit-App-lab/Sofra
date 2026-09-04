# Putting the Sofra API behind HTTPS

Why this is on the critical path for release, not a nice-to-have:

- `app.json` currently disables App Transport Security entirely
  (`NSAllowsArbitraryLoads: true`) and enables Android cleartext traffic,
  because the API is `http://129.121.89.248:8000`. A blanket ATS exemption is a
  known App Store review rejection reason, and Apple asks for justification.
- Every recipe request carries the ingredients the user ticked in their pantry
  and their dietary preferences — which can indicate a health condition — in
  the clear. The privacy policy has to admit this until it is fixed.

Nothing here needs a code change to the API itself. Caddy terminates TLS and
forwards to the existing uvicorn process.

## Already prepared in this repository

- `site/Caddyfile` — the real config, with your hostnames filled in. Copy it to
  `/etc/caddy/Caddyfile`.
- `site/index.html`, `site/gizlilik.html`, `site/privacy.html` — the landing
  page and both privacy policies as self-contained pages. Copy them to
  `/var/www/sofra/`.
- `https-cutover.patch` — the three app-side edits, held back deliberately.
  **Do not apply it until `https://api.buaksamnepisireyim.com/` answers**, or
  the app stops reaching the API.

Domains: `buaksamnepisireyim.com` is the home and the policy host,
`api.buaksamnepisireyim.com` is the API, and `buaksamnepisireyim.online`
redirects to the `.com`. One brand, one certificate set, one copy of the policy
to keep current.

## 1. Domain and DNS

At the registrar, point all five names at the VPS:

```
api.buaksamnepisireyim.com.      A   129.121.89.248
buaksamnepisireyim.com.          A   129.121.89.248
www.buaksamnepisireyim.com.      A   129.121.89.248
buaksamnepisireyim.online.       A   129.121.89.248
www.buaksamnepisireyim.online.   A   129.121.89.248
```

Wait for all of them to resolve before starting Caddy — it requests a
certificate per name on first start, and a name that does not resolve yet fails:

```bash
for host in api.buaksamnepisireyim.com buaksamnepisireyim.com \
            www.buaksamnepisireyim.com buaksamnepisireyim.online \
            www.buaksamnepisireyim.online; do
  printf '%-34s %s\n' "$host" "$(dig +short "$host" | tr '\n' ' ')"
done
```

Every line must show `129.121.89.248`. DNS propagation is usually minutes but
can take longer; there is no way to hurry it and no point starting Caddy early.

## 2. Caddy on the VPS

Caddy is used rather than nginx because it requests and renews the Let's
Encrypt certificate on its own, with no cron job and no certbot.

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

Install the prepared config and the pages:

```bash
cd /root/sofra-tr/tr/app/sofra-app && git pull --ff-only
install -m 0644 site/Caddyfile /etc/caddy/Caddyfile
mkdir -p /var/www/sofra /var/log/caddy
install -m 0644 site/index.html site/gizlilik.html site/privacy.html /var/www/sofra/
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

`caddy validate` before reloading: a syntax error there takes the API offline
along with the site. Then check all three:

```bash
curl -s https://api.buaksamnepisireyim.com/ && echo
curl -sI https://buaksamnepisireyim.com/gizlilik.html | head -1
curl -sI https://buaksamnepisireyim.online/ | head -2
```

Expected: the API's `{"name":"Sofra Recipe API","status":"running"}`, a `200`
for the policy, and a `301` to the `.com` for the `.online`. First request per
name is slow while the certificate is issued.

## 3. Close port 8000 from outside

Until now the API answered on `0.0.0.0:8000` directly. Once Caddy is in front,
only Caddy needs to reach it. Either bind uvicorn to localhost in
`sofra-api.service` (`--host 127.0.0.1`) and restart it, or block the port:

```bash
ufw deny 8000/tcp     # if ufw is in use
```

Binding to localhost is the better of the two. Check afterwards that the app
still works through the new hostname before you consider this done — a phone
that cannot reach the API will show "Sunucuya ulaşılamadı" rather than failing
silently, which is what the timeout work in `src/api.js` was for.

## 4. Publish the privacy policy

Done in step 2 — the pages were generated from `legal/*.md` and are already in
`site/`. If you edit the markdown later, regenerate them rather than editing
the HTML, so the two stay in step.

The URL to enter in App Store Connect and Google Play:

```
https://buaksamnepisireyim.com/gizlilik.html
```

It must stay reachable for as long as the app is listed. **Before submitting,
make sure `iletisim@buaksamnepisireyim.com` receives mail** — the policy names
it, and a dead contact address is worse than none. Registrar forwarding to an
inbox you already read is enough.

## 5. App-side changes — REQUIRES A NEW NATIVE BUILD

All three are in `https-cutover.patch`. Apply it only once step 2 succeeded:

```powershell
cd "$env:USERPROFILE\Desktop\my app1\Sofra"
git apply --check https-cutover.patch    # verify it applies cleanly first
git apply https-cutover.patch
npm.cmd test
```

What it changes: `API_URL` moves to `https://api.buaksamnepisireyim.com`, the
`NSAppTransportSecurity` block leaves `ios.infoPlist`, and the
`expo-build-properties` plugin entry — which exists only to allow Android
cleartext — is removed.

The first is JavaScript; the other two are **native configuration**, so a Metro
reload is not enough. A new build is required before they take effect.

Then, per `AGENTS.md`, state platform, profile, commit and purpose before
starting the build, and get explicit authorization:

```powershell
npx.cmd eas-cli@latest build --platform ios --profile development
```

## 6. Finally

- Update the "Güvenlik" / "Security" section of both privacy policy drafts: the
  paragraph admitting unencrypted recipe traffic comes out.
- Tick the HTTPS items in `TODO.md` section 7 and record the change in
  `PROJECT_HISTORY.md`, including the certificate's renewal owner (Caddy) so
  nobody wonders in eleven months.
- Keep `129.121.89.248:8000` answering for a while. Any build already installed
  on a phone still points at the IP, and closing it strands those installs
  until they update. That is why step 3 suggests binding uvicorn to localhost
  *after* you are satisfied — doing both at once removes the fallback.
- `usesNonExemptEncryption: false` in `app.json` stays correct: using HTTPS is
  exempt encryption, so the export-compliance answer does not change.
