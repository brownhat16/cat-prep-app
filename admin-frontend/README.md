# Admin Frontend

This is a separate web admin frontend for the CAT backend.

It talks to the backend admin APIs:

- `/admin/api/vector-status`
- `/admin/api/uploads`
- `/admin/api/logs`
- `/upload-pdfs/`

## Run

From this folder:

```bash
cd /Users/apple/Downloads/CAT/admin-frontend
python3 -m http.server 3001
```

Then open:

`http://127.0.0.1:3001`

The backend should already be running on:

`http://127.0.0.1:8000`

If you want to point to a different backend host/port, edit `config.js`.
