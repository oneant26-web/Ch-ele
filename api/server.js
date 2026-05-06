const app = require('./index');
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API server: http://localhost:${PORT}`));
