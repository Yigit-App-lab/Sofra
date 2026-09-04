# Sofra mobile testing and build runbook

## Start every session

From PowerShell in the repository:

```powershell
cd "C:\Users\yberktas\Desktop\my app1\Sofra"
npm.cmd run preflight
git status --short --branch
```

Only one Metro server should use port 8081.

## iOS active development (default)

The installed app must be an EAS **development** build. Start Metro through a tunnel:

```powershell
npm.cmd run ios:dev
```

Scan the displayed QR code with the normal iPhone Camera. Keep the terminal open.
The first uncached tunnel bundle can take one to three minutes; later reloads should
be faster. Press `r` to reload.

The development-client deep-link scheme shown by Expo is `exp+sofra-app://`. Do not
manually substitute the `sofra://` application scheme.

## Faster LAN mode

Use this only when the phone can open `http://<computer-ip>:8081/status` and it shows
`packager-status:running`:

```powershell
npm.cmd run ios:lan
```

The launcher may say “No development servers found” when automatic discovery fails;
the QR/deep link can still connect. If Safari returns `403`, the network is filtering
local traffic—use the tunnel command.

## Cache policy

Normal restart:

```powershell
npm.cmd run ios:dev
```

Use cache clearing only for a suspected stale Metro transform:

```powershell
npm.cmd run ios:dev:clear
```

## When a native rebuild is required

A new development build is normally required after changing native plugins,
`app.json` native configuration, Expo SDK/native dependencies, entitlements,
Firebase native configuration, or application identifiers. Ordinary JavaScript,
styles, text, images, and route screen logic normally require only a Metro reload.

Before any EAS build, record and confirm:

```text
Platform:
Profile: development | preview | production
Git commit:
Purpose:
Why Metro reload is insufficient:
```

Build only after explicit user approval:

```powershell
npx.cmd eas-cli@latest build --platform ios --profile development
```

Preview is for stable Metro-independent testing, not active iteration. Android builds
are currently batched until real Android testing resumes.

## Recipe suggestion performance

`/recipes/tonight` reads three per-recipe counts from `recipe_kiler_stats`. After
deploying a backend change that touches recipes or ingredient mappings:

```bash
python3 backend/refresh_recipe_kiler_stats.py --dry-run
python3 backend/refresh_recipe_kiler_stats.py
python3 backend/refresh_recipe_kiler_stats.py --verify
```

`--verify` recomputes every row and compares; a non-zero exit means rebuild. The
API falls back to computing the counts inline whenever the table is missing or
does not cover every recipe, so a missed refresh costs speed and not accuracy.

To compare the endpoint against an earlier revision of itself after any change
to its query, using the service virtualenv's interpreter:

```bash
systemctl cat sofra-api.service | grep -i exec
<venv>/bin/python backend/test_tonight_equivalence.py --baseline-rev HEAD~1
```

## Application/API checks

```powershell
npm.cmd test
curl.exe http://129.121.89.248:8000/
```

Expected API response includes `"status":"running"`.

## Failure triage order

1. Capture the exact on-screen error and latest Metro lines.
2. Run `npm.cmd run preflight`.
3. Confirm development versus preview build.
4. Confirm Metro printed `iOS Bundled`.
5. For LAN, test `/status` from iPhone Safari; otherwise use tunnel.
6. Change one variable at a time. Do not create a new EAS build until native rebuild
   necessity has been established.

