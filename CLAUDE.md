# Deployment

- Frontend: `geosef/` → GitHub Pages on push to master
- Backend: `appscript/` → Apps Script via clasp in CI
- Deployment ID lives in `appscript/deployment-id.txt` (read by vite config + CI build — no env var needed)

## Gotcha: `appsscript.json` must keep the `webapp` block

`clasp push --force` overwrites the manifest on Google's side. Without `webapp` (executeAs/access), `/exec` 404s for everyone — prod *and* local dev (which proxies to the same URL).

## Master = prod

Test Apps Script changes locally before pushing:
```
cd appscript && clasp push --force && clasp deploy -i "$(cat deployment-id.txt)"
```
Same deployment ID, same URL, updates in place. Also the recovery command if `/exec` breaks.
