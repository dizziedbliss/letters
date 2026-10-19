// Local dev entry. On Vercel the app is served by /api/index.js instead.
import app from './app.js';

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`letters api on :${port}`));
