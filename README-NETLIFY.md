# Netlify Upload Steps

This folder is ready for Netlify.

## Files Netlify needs

```text
public/
  index.html
  share.html
  admin.js
  share.js
  styles.css

netlify/
  functions/
    api.js

netlify.toml
package.json
```

`server.js` can stay in the folder for local testing, but Netlify uses `netlify/functions/api.js`.

## Deploy route

1. Upload this whole folder to a GitHub repository.
2. Open Netlify.
3. Choose Add new project.
4. Choose Import from Git.
5. Select your GitHub repository.
6. Build command should be:

```text
npm run build
```

7. Publish directory should be:

```text
public
```

8. Deploy.

## Admin password

In Netlify, set an environment variable:

```text
ADMIN_TOKEN
```

Use a private password value. The admin page will ask for it when needed.

If you do not set `ADMIN_TOKEN`, the admin API is open to anyone who knows the site URL.
