// Middleware para rutas no encontradas (404)
const notFound = (req, res, next) => {
  const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Middleware global de manejo de errores
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const esProduccion = process.env.NODE_ENV === 'production';

  // En producción, los errores 500 no exponen el mensaje interno real
  // (puede revelar detalles de la base de datos, rutas, etc.). Los
  // errores 4xx sí muestran su mensaje, porque son intencionales.
  const mensaje = (statusCode >= 500 && esProduccion)
    ? 'Error interno del servidor'
    : (err.message || 'Error interno del servidor');

  const response = {
    success: false,
    message: mensaje,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  };

  // En desarrollo, incluir el stack trace para depurar
  if (!esProduccion) {
    response.stack = err.stack;
  } else if (statusCode >= 500) {
    // Registrar el error real en el servidor aunque no se envíe al cliente
    console.error('[ERROR]', req.method, req.originalUrl, '→', err.message);
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
