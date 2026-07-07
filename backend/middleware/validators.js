// ══════════════════════════════════════════════════════════════════
// backend/middleware/validators.js
// Validación y saneamiento de entradas con express-validator.
//
// Estrategia: validar en la ENTRADA (rechazar lo inválido con 422) y
// escapar en la SALIDA (el frontend usa escapeHtml al renderizar). Así
// se evita guardar datos con formato inesperado y se corta el XSS
// almacenado sin destruir el dato original (no guardamos entidades HTML).
// ══════════════════════════════════════════════════════════════════
const { body, param, validationResult } = require('express-validator');

// Middleware que corta la petición si hay errores de validación.
function handleValidation(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: errores.array()[0].msg,
      errores: errores.array().map(e => ({ campo: e.path, msg: e.msg })),
    });
  }
  next();
}

// ── Registro ────────────────────────────────────────────────────────
const registerValidator = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('email')
    .trim()
    .notEmpty().withMessage('El correo es obligatorio')
    .isEmail().withMessage('Correo electrónico inválido')
    .isLength({ max: 150 }).withMessage('El correo es demasiado largo')
    .normalizeEmail({ gmail_remove_dots: false }),
  body('password')
    .isString().withMessage('Contraseña inválida')
    .isLength({ min: 6, max: 100 }).withMessage('La contraseña debe tener entre 6 y 100 caracteres'),
  handleValidation,
];

// ── Login ───────────────────────────────────────────────────────────
const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('El correo es obligatorio')
    .isEmail().withMessage('Correo electrónico inválido')
    .normalizeEmail({ gmail_remove_dots: false }),
  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria'),
  handleValidation,
];

// ── Perfil (nombre y/o cambio de contraseña) ────────────────────────
const profileValidator = [
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('passwordActual')
    .optional()
    .isString().withMessage('Contraseña actual inválida'),
  body('passwordNueva')
    .optional()
    .isLength({ min: 6, max: 100 }).withMessage('La nueva contraseña debe tener entre 6 y 100 caracteres'),
  handleValidation,
];

// ── Rol (admin/usuario) ─────────────────────────────────────────────
const rolValidator = [
  param('id').isInt({ min: 1 }).withMessage('ID de usuario inválido'),
  body('rol').isIn(['admin', 'usuario']).withMessage('Rol inválido'),
  handleValidation,
];

// ── Reserva ─────────────────────────────────────────────────────────
const reservaValidator = [
  body('maquinariaId')
    .notEmpty().withMessage('Falta la maquinaria')
    .isInt({ min: 1 }).withMessage('Maquinaria inválida'),
  body('fecha_inicio')
    .notEmpty().withMessage('Falta la fecha de inicio')
    .isISO8601().withMessage('Fecha de inicio inválida'),
  body('fecha_fin')
    .notEmpty().withMessage('Falta la fecha de término')
    .isISO8601().withMessage('Fecha de término inválida'),
  body('telefono')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 30 }).withMessage('Teléfono demasiado largo')
    .matches(/^[0-9+()\s-]*$/).withMessage('El teléfono solo puede tener números, espacios y + ( ) -'),
  body('notas')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Las notas no pueden superar 500 caracteres'),
  handleValidation,
];

// ── Estado de reserva ───────────────────────────────────────────────
const estadoReservaValidator = [
  param('id').isInt({ min: 1 }).withMessage('ID de reserva inválido'),
  body('estado').isIn(['Pendiente', 'Aprobada', 'Rechazada', 'Cancelada']).withMessage('Estado inválido'),
  handleValidation,
];

// ── Solo :id entero en la URL ───────────────────────────────────────
const idParamValidator = [
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  handleValidation,
];

const maquinariaIdParamValidator = [
  param('maquinariaId').isInt({ min: 1 }).withMessage('ID de maquinaria inválido'),
  handleValidation,
];

module.exports = {
  handleValidation,
  registerValidator,
  loginValidator,
  profileValidator,
  rolValidator,
  reservaValidator,
  estadoReservaValidator,
  idParamValidator,
  maquinariaIdParamValidator,
};
