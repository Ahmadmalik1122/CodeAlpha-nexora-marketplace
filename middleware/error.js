const path = require('path');

// 404 for unknown /api routes (JSON).
function apiNotFound(req, res) {
  res.status(404).json({ error: 'API endpoint not found.' });
}

// Central error handler.
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  if (req.path.startsWith('/api')) {
    return res.status(status).json({ error: err.message || 'Internal server error.' });
  }
  const file = status === 404 ? '404.html' : '500.html';
  res.status(status).sendFile(path.join(__dirname, '..', 'public', file), (e) => {
    if (e) res.status(status).send(err.message || 'Error');
  });
}

module.exports = { apiNotFound, errorHandler };
