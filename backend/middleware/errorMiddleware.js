// Middleware para rutas no encontradas (404)
const notFound = (req, res, next) => {
  const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Middleware global de manejo de errores
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  const response = {
    success: false,
    message: err.message || 'Error interno del servidor',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  };

  // En desarrollo, incluir el stack trace
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// Middleware para validar Content-Type en POST/PUT
const validateContentType = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({
        success: false,
        message: 'Content-Type debe ser application/json'
      });
    }
  }
  next();
};

module.exports = { notFound, errorHandler, validateContentType };
