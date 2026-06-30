// ══════════════════════════════════════════════════
// authController.js
// Fase 3 — los métodos me, getUsers, updateRol y deleteUser pasaron
// a ser async porque UserModel.getById/getAll/updateRol/delete ahora
// hacen queries a SQL Server (antes eran síncronos sobre el array
// en memoria). El resto del archivo no cambió.
// ══════════════════════════════════════════════════
const UserModel = require('../models/userModel');

const AuthController = {

  // POST /api/auth/register
  async register(req, res) {
    try {
      const { nombre, email, password } = req.body;
      if (!nombre || !email || !password)
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
      if (password.length < 6)
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });

      const user = await UserModel.create({ nombre, email, password });
      req.session.userId = user.id;

      return res.status(201).json({ success: true, message: 'Cuenta creada exitosamente', user });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  // POST /api/auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ success: false, message: 'Correo y contraseña requeridos' });

      const user = await UserModel.verifyPassword(email, password);
      if (!user)
        return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos' });

      req.session.userId = user.id;
      return res.json({ success: true, message: 'Sesión iniciada', user });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/auth/logout
  logout(req, res) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Sesión cerrada' });
    });
  },

  // GET /api/auth/me
  async me(req, res) {
    if (!req.session.userId)
      return res.status(401).json({ success: false, message: 'Sin sesión' });

    const user = await UserModel.getById(req.session.userId);
    if (!user)
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });

    return res.json({ success: true, user });
  },

  // PUT /api/auth/profile — cambiar nombre o contraseña
  async profile(req, res) {
    try {
      if (!req.session.userId)
        return res.status(401).json({ success: false, message: 'Sin sesión' });

      const { nombre, passwordActual, passwordNueva } = req.body;

      if (nombre) {
        const user = await UserModel.updateNombre(req.session.userId, nombre);
        return res.json({ success: true, message: 'Nombre actualizado', user });
      }

      if (passwordActual && passwordNueva) {
        if (passwordNueva.length < 6)
          return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres' });
        const user = await UserModel.updatePassword(req.session.userId, passwordActual, passwordNueva);
        return res.json({ success: true, message: 'Contraseña actualizada', user });
      }

      return res.status(400).json({ success: false, message: 'Envía nombre o contraseñas para actualizar' });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  // GET /api/auth/users — solo admin
  async getUsers(req, res) {
    const users = await UserModel.getAll();
    return res.json({ success: true, users });
  },

  // PUT /api/auth/users/:id/rol — solo admin
  async updateRol(req, res) {
    const { id } = req.params;
    const { rol } = req.body;
    if (!['admin', 'usuario'].includes(rol))
      return res.status(400).json({ success: false, message: 'Rol inválido' });

    const user = await UserModel.updateRol(id, rol);
    if (!user)
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    return res.json({ success: true, message: 'Rol actualizado', user });
  },

  // DELETE /api/auth/users/:id — solo admin
  async deleteUser(req, res) {
    const { id } = req.params;
    if (parseInt(id) === req.session.userId)
      return res.status(400).json({ success: false, message: 'No puedes eliminarte a ti mismo' });

    const user = await UserModel.delete(id);
    if (!user)
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    return res.json({ success: true, message: `Usuario "${user.nombre}" eliminado`, user });
  },
};

module.exports = AuthController;