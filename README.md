# ⛏️ Mining Catalog — Maquinaria de Minería

Aplicación web desarrollada con **Node.js + Express** que implementa un catálogo interactivo de maquinaria pesada de minería. Permite visualizar, buscar, filtrar, agregar, editar y eliminar equipos mediante una API REST y una interfaz frontend moderna.

---

## 🎯 Objetivo

Demostrar el desarrollo de un backend estructurado con Node.js y Express, aplicando separación de responsabilidades (routes, controllers, models, middleware), validaciones, manejo de errores HTTP y una vista frontend que consume la API.

---

## 🛠️ Tecnologías

| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | ≥18.x | Runtime |
| Express | ^4.18.2 | Framework HTTP |
| dotenv | ^16.0.3 | Variables de entorno |
| nodemon | ^3.0.1 | Recarga automática (dev) |

---

## 📦 Instalación

```bash
# 1. Clonar o descomprimir el proyecto
cd evaluacion_node_express

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# El archivo .env ya está incluido con valores por defecto:
# PORT=3000
# NODE_ENV=development
```

---

## ▶️ Ejecución

```bash
# Modo desarrollo (con nodemon)
npm run dev

# Modo producción
npm start
```

Luego abrir el navegador en: **http://localhost:3000**

---

## 📁 Estructura del Proyecto

```
evaluacion_node_express/
├── backend/
│   ├── config/
│   │   └── config.js          # Carga y exporta variables de entorno
│   ├── controllers/
│   │   └── itemController.js  # Lógica de negocio de cada endpoint
│   ├── middleware/
│   │   └── errorMiddleware.js # Manejo de errores y rutas no encontradas
│   ├── models/
│   │   └── itemModel.js       # Acceso y manipulación de datos en memoria
│   ├── routes/
│   │   └── itemRoutes.js      # Definición de rutas Express
│   ├── app.js                 # Configuración de Express y middlewares
│   └── server.js              # Arranque del servidor
├── database/
│   └── data.js                # Datos iniciales (arreglos en memoria)
├── frontend/
│   ├── public/
│   │   ├── css/
│   │   │   └── styles.css     # Estilos del frontend
│   │   └── js/
│   │       └── script.js      # Lógica frontend (fetch API, DOM)
│   └── views/
│       └── index.html         # Vista principal del catálogo
├── .env                       # Variables de entorno
├── package.json
└── README.md
```

---

## 🔌 Endpoints API

Base URL: `http://localhost:3000/api/maquinaria`

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/maquinaria` | Listar toda la maquinaria |
| GET | `/api/maquinaria?search=cat` | Buscar por nombre/marca/modelo |
| GET | `/api/maquinaria?categoria=Excavación` | Filtrar por categoría |
| GET | `/api/maquinaria?estado=Disponible` | Filtrar por estado |
| GET | `/api/maquinaria/categorias` | Obtener lista de categorías |
| GET | `/api/maquinaria/:id` | Obtener equipo por ID |
| POST | `/api/maquinaria` | Crear nuevo equipo |
| PUT | `/api/maquinaria/:id` | Actualizar equipo existente |
| DELETE | `/api/maquinaria/:id` | Eliminar equipo |

---

## 📝 Ejemplos de uso

### GET — Obtener toda la maquinaria
```bash
curl http://localhost:3000/api/maquinaria
```

**Respuesta:**
```json
{
  "success": true,
  "total": 8,
  "data": [
    {
      "id": 1,
      "nombre": "Excavadora Hidráulica CAT 390F",
      "categoria": "Excavación",
      "marca": "Caterpillar",
      "estado": "Disponible",
      "precio_arriendo_dia": 4500
    }
  ]
}
```

### GET — Obtener por ID
```bash
curl http://localhost:3000/api/maquinaria/1
```

### GET — Buscar
```bash
curl "http://localhost:3000/api/maquinaria?search=komatsu&estado=En%20uso"
```

### POST — Crear nuevo equipo
```bash
curl -X POST http://localhost:3000/api/maquinaria \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Retroexcavadora JCB 3CX",
    "categoria": "Excavación",
    "marca": "JCB",
    "modelo": "3CX",
    "año": 2023,
    "capacidad": "8 toneladas",
    "potencia": "109 HP",
    "descripcion": "Retroexcavadora versátil para trabajos de excavación y carga en minería artesanal.",
    "estado": "Disponible",
    "precio_arriendo_dia": 950
  }'
```

### PUT — Actualizar estado
```bash
curl -X PUT http://localhost:3000/api/maquinaria/1 \
  -H "Content-Type: application/json" \
  -d '{ "estado": "En uso" }'
```

### DELETE — Eliminar
```bash
curl -X DELETE http://localhost:3000/api/maquinaria/1
```

---

## ✅ Validaciones implementadas

- **Campos requeridos**: nombre, categoria, marca, modelo, descripcion
- **ID inválido**: retorna 400 si el ID no es un número
- **ID inexistente**: retorna 404 si no se encuentra el equipo
- **Año inválido**: valida rango 1900–2025
- **Precio negativo**: valida que sea número positivo
- **Body vacío en PUT**: retorna 400 si no hay campos a actualizar
- **Content-Type**: valida `application/json` en POST/PUT
- **Ruta no encontrada**: middleware 404 para rutas inexistentes

---

## ⚙️ Funcionamiento general

1. El servidor lee el puerto desde `.env` (por defecto 3000)
2. `app.js` configura middlewares globales, rutas y manejo de errores
3. Las rutas en `itemRoutes.js` delegan a funciones del `itemController.js`
4. El controlador usa `itemModel.js` para acceder a los datos en memoria (`database/data.js`)
5. El frontend (`index.html` + `script.js`) consume la API mediante `fetch()`
6. Errores inesperados son capturados por el middleware global y retornan respuesta JSON con código HTTP apropiado

---

## 📊 Códigos HTTP utilizados

| Código | Uso |
|---|---|
| 200 | Operación exitosa (GET, PUT, DELETE) |
| 201 | Recurso creado exitosamente (POST) |
| 400 | Solicitud inválida (campos faltantes, formato incorrecto) |
| 404 | Recurso o ruta no encontrada |
| 415 | Content-Type incorrecto |
| 500 | Error interno del servidor |
