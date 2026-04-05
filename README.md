# Finance Bud

Finance Bud is a static (frontend-only) expense tracker built with HTML, CSS, and Vanilla JavaScript.

## Run locally

### Option 1: Open directly
1. Open `index.html` in your browser.
2. Navigate to `dashboard.html` / `profile.html` via the app links.

### Option 2 (recommended): Local server
From the project root run:

```bash
python3 -m http.server 8000
```

Then open:

- http://localhost:8000/index.html

## If you are not seeing recent changes

1. Make sure you are in the latest commit:
   ```bash
   git log --oneline -n 3
   ```
2. Hard refresh your browser tab:
   - macOS: `Cmd + Shift + R`
   - Windows/Linux: `Ctrl + F5`
3. Use a local server (above) instead of opening stale tabs from old paths.
4. Clear site data/localStorage for the page if older data is interfering.

> Note: `styles.css` and `script.js` are now loaded with a version query string to reduce stale browser caching.

## Requested enhancements implemented

1. **Top-right dark mode toggle on dashboard/profile nav**.
2. **Clickable profile avatar photo upload** on `profile.html`.
3. **"Create a Profile" popup modal** on landing page to capture name, email, phone.
4. **Login renamed to "Create a Profile"** on landing CTA.
5. **Interactive AI Finance Assistant chatbot** with message input and contextual replies on dashboard.

