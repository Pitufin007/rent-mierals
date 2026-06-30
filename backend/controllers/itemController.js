// ══════════════════════════════════════════════════
// backend/controllers/itemController.js
// Fase 3 — MaquinariaModel ahora consulta SQL Server, así que todos
// los métodos pasaron a ser async. Los filtros de categoría/estado/
// search, que antes se aplicaban con .filter() sobre el array ya
// cargado, ahora se le pasan a MaquinariaModel.getAll() y se
// resuelven en la consulta SQL (más eficiente, mismo resultado).
// ══════════════════════════════════════════════════
const MaquinariaModel = require('../models/itemModel');

const MaquinariaController = {
  // GET /api/maquinaria - Obtener toda la maquinaria
  async getAll(req, res) {
    try {
      const { categoria, estado, search } = req.query;
      const resultado = await MaquinariaModel.getAll({ categoria, estado, search });

      res.status(200).json({
        success: true,
        total: resultado.length,
        data: resultado
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener la maquinaria',
        error: error.message
      });
    }
  },

  // GET /api/maquinaria/:id - Obtener por ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      if (isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'El ID debe ser un número válido'
        });
      }

      const maquina = await MaquinariaModel.getById(id);

      if (!maquina) {
        return res.status(404).json({
          success: false,
          message: `No se encontró maquinaria con ID ${id}`
        });
      }

      res.status(200).json({
        success: true,
        data: maquina
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener la maquinaria',
        error: error.message
      });
    }
  },

  // GET /api/maquinaria/categorias - Obtener categorías
  getCategorias(req, res) {
    try {
      const categorias = MaquinariaModel.getCategorias();
      res.status(200).json({
        success: true,
        total: categorias.length,
        data: categorias
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener las categorías',
        error: error.message
      });
    }
  },

  // POST /api/maquinaria - Crear nueva maquinaria
  async create(req, res) {
    try {
      const { nombre, categoria, marca, modelo, descripcion } = req.body;

      // Validaciones de campos requeridos
      const camposFaltantes = [];
      if (!nombre || nombre.trim() === '') camposFaltantes.push('nombre');
      if (!categoria || categoria.trim() === '') camposFaltantes.push('categoria');
      if (!marca || marca.trim() === '') camposFaltantes.push('marca');
      if (!modelo || modelo.trim() === '') camposFaltantes.push('modelo');
      if (!descripcion || descripcion.trim() === '') camposFaltantes.push('descripcion');

      if (camposFaltantes.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos requeridos',
          campos_faltantes: camposFaltantes
        });
      }

      // Validar año si se proporciona
      if (req.body.año) {
        const año = parseInt(req.body.año);
        if (isNaN(año) || año < 1900 || año > new Date().getFullYear() + 1) {
          return res.status(400).json({
            success: false,
            message: `El año debe ser un número válido entre 1900 y ${new Date().getFullYear() + 1}`
          });
        }
      }

      // Validar precio si se proporciona
      if (req.body.precio_arriendo_dia) {
        const precio = parseFloat(req.body.precio_arriendo_dia);
        if (isNaN(precio) || precio < 0) {
          return res.status(400).json({
            success: false,
            message: 'El precio de arriendo debe ser un número positivo'
          });
        }
      }

      const nuevaMaquina = await MaquinariaModel.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Maquinaria creada exitosamente',
        data: nuevaMaquina
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al crear la maquinaria',
        error: error.message
      });
    }
  },

  // PUT /api/maquinaria/:id - Actualizar maquinaria
  async update(req, res) {
    try {
      const { id } = req.params;

      if (isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'El ID debe ser un número válido'
        });
      }

      const existe = await MaquinariaModel.getById(id);
      if (!existe) {
        return res.status(404).json({
          success: false,
          message: `No se encontró maquinaria con ID ${id}`
        });
      }

      if (Object.keys(req.body).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debe enviar al menos un campo para actualizar'
        });
      }

      const actualizada = await MaquinariaModel.update(id, req.body);

      res.status(200).json({
        success: true,
        message: 'Maquinaria actualizada exitosamente',
        data: actualizada
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al actualizar la maquinaria',
        error: error.message
      });
    }
  },

  // DELETE /api/maquinaria/:id - Eliminar maquinaria
  async delete(req, res) {
    try {
      const { id } = req.params;

      if (isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'El ID debe ser un número válido'
        });
      }

      const eliminada = await MaquinariaModel.delete(id);

      if (!eliminada) {
        return res.status(404).json({
          success: false,
          message: `No se encontró maquinaria con ID ${id}`
        });
      }

      res.status(200).json({
        success: true,
        message: `Maquinaria "${eliminada.nombre}" eliminada exitosamente`,
        data: eliminada
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al eliminar la maquinaria',
        error: error.message
      });
    }
  }
};

module.exports = MaquinariaController;