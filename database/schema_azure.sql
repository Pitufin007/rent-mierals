-- ══════════════════════════════════════════════════════════════════
--  RENT MINING — Mining Catalog
--  Script de creación de TABLAS para Azure SQL Database
-- ══════════════════════════════════════════════════════════════════
--
--  Diferencias respecto al schema_reset_completo.sql (SQL Server local):
--  - NO incluye CREATE DATABASE ni USE (en Azure ya estás conectado
--    directo a la base de datos, no existe el concepto de "master"
--    accesible de la misma forma que en SQL Server local).
--  - NO incluye CREATE LOGIN / CREATE USER (el usuario que creaste
--    al momento de crear el servidor Azure SQL ya es administrador
--    con todos los permisos necesarios).
--  - Solo crea las 3 tablas, el seed, los índices, y verifica el
--    resultado final.
--
--  Pensado para ejecutarse vía: node backend/setup-azure-db.js
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 2. TABLA: usuarios
-- ──────────────────────────────────────────────────────────────────
-- password puede ser NULL: las cuentas creadas vía Google OAuth
-- no tienen contraseña local (createFromGoogle en userModel.js).
-- ──────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'usuarios')
BEGIN
    CREATE TABLE usuarios (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        nombre          NVARCHAR(150)   NOT NULL,
        email           NVARCHAR(150)   NOT NULL,
        password        NVARCHAR(255)   NULL,           -- hash bcrypt; NULL si es cuenta Google
        rol             NVARCHAR(20)    NOT NULL DEFAULT 'usuario',
        creado_en       DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT UQ_usuarios_email UNIQUE (email),
        CONSTRAINT CK_usuarios_rol   CHECK (rol IN ('admin', 'usuario'))
    );
END
GO


-- ──────────────────────────────────────────────────────────────────
-- 3. TABLA: maquinaria
-- ──────────────────────────────────────────────────────────────────
-- Refleja 1:1 los campos que ya usa itemModel.js / itemController.js
-- ──────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'maquinaria')
BEGIN
    CREATE TABLE maquinaria (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        nombre                  NVARCHAR(200)   NOT NULL,
        categoria               NVARCHAR(100)   NOT NULL,
        marca                   NVARCHAR(100)   NOT NULL,
        modelo                  NVARCHAR(100)   NOT NULL,
        anio                    INT             NOT NULL,   -- "año" en JS; columna sin tilde por compatibilidad SQL
        capacidad               NVARCHAR(100)   NULL,
        potencia                NVARCHAR(100)   NULL,
        descripcion             NVARCHAR(MAX)   NOT NULL,
        estado                  NVARCHAR(30)    NOT NULL DEFAULT 'Disponible',
        precio_arriendo_dia     DECIMAL(12,2)   NOT NULL DEFAULT 0,
        imagen                  NVARCHAR(500)   NULL,

        CONSTRAINT CK_maquinaria_anio   CHECK (anio BETWEEN 1900 AND 2025),
        CONSTRAINT CK_maquinaria_precio CHECK (precio_arriendo_dia >= 0),
        CONSTRAINT CK_maquinaria_estado CHECK (estado IN ('Disponible', 'En uso', 'Mantenimiento'))
    );
END
GO


-- ──────────────────────────────────────────────────────────────────
-- 4. TABLA: reservas
-- ──────────────────────────────────────────────────────────────────
-- FK a usuarios y maquinaria. Se guardan también usuarioNombre y
-- maquinariaNombre "desnormalizados" igual que en reservaModel.js
-- original, para no romper la interfaz que ya consume el frontend.
--
-- ON DELETE:
--   - Si se elimina un usuario, sus reservas se eliminan en cascada
--     (no tiene sentido conservar una reserva de un usuario inexistente).
--   - Si se elimina una maquinaria, se bloquea el borrado si tiene
--     reservas asociadas (NO ACTION = comportamiento por defecto),
--     para no perder el historial de reservas silenciosamente.
-- ──────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'reservas')
BEGIN
    CREATE TABLE reservas (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        usuario_id          INT             NOT NULL,
        maquinaria_id       INT             NOT NULL,
        usuario_nombre      NVARCHAR(150)   NOT NULL,   -- snapshot al momento de reservar
        maquinaria_nombre   NVARCHAR(200)   NOT NULL,   -- snapshot al momento de reservar
        fecha_inicio        DATE            NOT NULL,
        fecha_fin           DATE            NOT NULL,
        notas               NVARCHAR(500)   NULL,
        estado              NVARCHAR(20)    NOT NULL DEFAULT 'Pendiente',
        creada_en           DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_reservas_usuario
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            ON DELETE CASCADE,

        CONSTRAINT FK_reservas_maquinaria
            FOREIGN KEY (maquinaria_id) REFERENCES maquinaria(id)
            ON DELETE NO ACTION,

        CONSTRAINT CK_reservas_estado CHECK (estado IN ('Pendiente', 'Aprobada', 'Rechazada', 'Cancelada')),
        CONSTRAINT CK_reservas_fechas CHECK (fecha_fin >= fecha_inicio)
    );
END
GO


-- ──────────────────────────────────────────────────────────────────
-- 5. SEED — Usuarios por defecto
-- ──────────────────────────────────────────────────────────────────
-- Mismos usuarios y mismas contraseñas que generaba UserModel.init():
--   admin@rentmierals.cl     / admin123   (rol: admin)
--   usuario@rentmierals.cl   / user123    (rol: usuario)
--
-- Los hashes fueron generados con bcrypt (10 salt rounds), igual que
-- en el código original — NO son contraseñas en texto plano.
-- ──────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@rentmierals.cl')
BEGIN
    INSERT INTO usuarios (nombre, email, password, rol) VALUES
    (N'Administrador', 'admin@rentmierals.cl', '$2b$10$6oYYSZauXBtmoIeKu.Rj7.lEe9mw6EJrSrPuhRBVSYZFRh7X9MoKK', 'admin');
END
GO

IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'usuario@rentmierals.cl')
BEGIN
    INSERT INTO usuarios (nombre, email, password, rol) VALUES
    (N'Usuario Demo', 'usuario@rentmierals.cl', '$2b$10$dyUyWfgtmJHtCyP7Vir0.OQ6nznzUiVhzfLNnLIZN4jEwxt4H4D0u', 'usuario');
END
GO


-- ──────────────────────────────────────────────────────────────────
-- 6. SEED — Maquinaria (17 equipos, idénticos a database/data.js)
-- ──────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM maquinaria)
BEGIN
    INSERT INTO maquinaria (nombre, categoria, marca, modelo, anio, capacidad, potencia, descripcion, estado, precio_arriendo_dia, imagen) VALUES
    (N'Excavadora Hidráulica CAT 390F', N'Excavación', N'Caterpillar', N'390F', 2022, N'90 toneladas', N'575 HP', N'Excavadora de gran tonelaje ideal para minería a cielo abierto. Motor diesel de alta eficiencia con sistema hidráulico avanzado.', 'Disponible', 4200000, 'https://s7d2.scene7.com/is/image/Caterpillar/C10124150'),

    (N'Camión Minero Komatsu 930E', N'Transporte', N'Komatsu', N'930E', 2021, N'290 toneladas', N'2700 HP', N'Camión de acarreo eléctrico de ultra gran capacidad. Transmisión eléctrica AC para máxima productividad en minas de gran escala.', 'En uso', 8000000, 'https://www.guiaminera.cl/wp-content/uploads/2022/06/Komatsu-930E-at-Los-Bronces-mine_06.02.2022.png'),

    (N'Perforadora Rotativa Atlas Copco DM45', N'Perforación', N'Atlas Copco', N'DM45', 2023, N'Diámetro 152-311mm', N'450 HP', N'Perforadora rotaria de alto rendimiento para minería superficial. Sistema de control automático de presión y velocidad.', 'Disponible', 3800000, 'https://epiroc.scene7.com/is/image/epiroc/reverse+DM45-2?$landscape1600$'),

    (N'Motoniveladora Komatsu GD825A', N'Nivelación', N'Komatsu', N'GD825A', 2020, N'35 toneladas', N'310 HP', N'Motoniveladora de alta capacidad para mantenimiento y construcción de caminos mineros. Hoja de 6.7 metros de ancho.', 'Mantenimiento', 2100000, 'https://www.lectura-specs.es/models/renamed/orig/motoniveladoras-gd825a-2-komatsu(1).jpg'),

    (N'Pala Cargadora Liebherr L586', N'Carga', N'Liebherr', N'L586', 2022, N'Cucharón 6.5 m³', N'380 HP', N'Cargadora de ruedas de gran potencia para operaciones mineras. Transmisión hidrostática con control automático de tracción.', 'Disponible', 3200000, 'https://assets-cdn.liebherr.com/versions/408f6b9b-3b19-45c2-b602-468c62af470c/w-1280_h-1280_f-webp/L586_XPower_G6_10_2022.webp'),

    (N'Bulldozer CAT D11T', N'Empuje', N'Caterpillar', N'D11T', 2021, N'104 toneladas', N'850 HP', N'El bulldozer más grande de Caterpillar. Ideal para remociones masivas de material estéril en minería de gran escala.', 'En uso', 5500000, 'https://s7d2.scene7.com/is/image/Caterpillar/CM20221201-09744-f107a'),

    (N'Compactadora Bomag BW 226 DH-5', N'Compactación', N'Bomag', N'BW 226 DH-5', 2023, N'19 toneladas', N'220 HP', N'Rodillo vibratorio para compactación de caminos y plataformas mineras. Sistema ECONOMIZER para optimización de pasadas.', 'Disponible', 1800000, 'https://khsamgwebpro.blob.core.windows.net/wp-content/uploads/2022/11/22160606/BW226DH-5_contenido.jpg'),

    (N'Grúa Liebherr LTM 1500-8.1', N'Izaje', N'Liebherr', N'LTM 1500-8.1', 2020, N'500 toneladas', N'680 HP', N'Grúa móvil todo terreno de 500 toneladas para montaje de equipos y estructuras en faenas mineras.', 'Disponible', 1200000, 'https://www.lectura-specs.es/models/renamed/orig/gruas-todo-terreno-ltm-1500-16x8x12--liebherr(4).jpg'),

    (N'Camión Minero Subterráneo Epiroc Minetruck MT65 S', N'Transporte Subterráneo', N'Epiroc', N'MT65 S', 2023, N'65 toneladas', N'770 HP', N'Camión articulado de interior mina, uno de los más grandes del mundo en su categoría. Diseñado para operaciones subterráneas de gran volumen con sistema de control RCS y motor Tier 4 Final.', 'Disponible', 6800000, 'https://epiroc.scene7.com/is/image/epiroc/Minetruck+MT65+S_Comm_0078?$landscape1600$'),

    (N'Cargador Subterráneo Sandvik Toro LH621i', N'Carga Subterránea', N'Sandvik', N'LH621i', 2023, N'21 toneladas', N'470 HP', N'Cargador LHD para desarrollo rápido de minas y producción subterránea a gran escala. Geometría de brazo inteligente para llenado rápido del cucharón y alta velocidad en rampa.', 'Disponible', 4500000, 'https://www.mining.sandvik/cdn-cgi/image/w=1200,h=630,quality=90,fit=cover,format=avif/siteassets/images/loaders/diesel-loaders/lh621i/lh621i-003.jpg?v=1698044822'),

    (N'Perforadora Rotativa Sandvik DR416i', N'Perforación', N'Sandvik', N'DR416i', 2023, N'Diámetro 270-406mm', N'1400 HP', N'La perforadora rotativa de mayor diámetro de Sandvik, sobre orugas, diseñada para minería de cobre y mineral de hierro. Capacidad de una sola pasada de 21 metros y sistema de control inteligente SICA.', 'Disponible', 5200000, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSgpKmedngmBAkidl2PImP3KKjeN39iMrkkHgyrrm_ghj-DSE1VFOTA-ako&s=10'),

    (N'Camión Minero Subterráneo Epiroc Minetruck MT42', N'Transporte Subterráneo', N'Epiroc', N'MT42', 2022, N'42 toneladas', N'550 HP', N'Camión articulado de alta velocidad para transporte subterráneo, minería y construcción. Suspensión en eje delantero y motor Cummins QSX15 con bajas emisiones Tier 4 Final.', 'En uso', 5400000, 'https://epiroc.scene7.com/is/image/epiroc/Minetruck+MT42+SG+comm+2?$landscape1600$'),

    (N'Camión Aljibe CAT 777G Water Solutions', N'Riego de Caminos', N'Caterpillar', N'777G Water Solutions', 2022, N'65.000 litros', N'938 HP', N'Camión aljibe sobre chasis 777G para riego y supresión de polvo en caminos mineros. Sistema de aspersión de ancho variable y bombas de alto caudal para máxima cobertura.', 'Disponible', 4100000, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCnTbvT2sigTi7r3H_H4BxoJJQwLKclDQ6jGwZm84wsrnyDJo3PLCZz8E&s=10'),

    (N'Chancadora Móvil de Mandíbula Metso Lokotrack LT120', N'Chancado', N'Metso', N'Lokotrack LT120', 2022, N'Hasta 350 ton/h', N'350 HP', N'Planta chancadora móvil sobre orugas con chancador de mandíbula. Ideal para reducción primaria de mineral y estéril directamente en el frente de la faena, reduciendo costos de acarreo.', 'Disponible', 4700000, 'https://api.sitsa.com.mx/media/img/gallery/brands/Metso5.webp'),

    (N'Excavadora Hidráulica Komatsu PC2000', N'Excavación', N'Komatsu', N'PC2000-11', 2022, N'124 toneladas', N'979 HP', N'Excavadora hidráulica de gran tonelaje para carguío directo en minería a cielo abierto. Cucharón de hasta 13 m³ y sistema de control electrónico de potencia para máxima eficiencia de combustible.', 'Disponible', 5900000, 'https://www.lectura-specs.es/models/renamed/orig/excavadoras-de-orugas-pc2000-11-komatsu.jpeg'),

    (N'Camión Minero Liebherr T 284', N'Transporte', N'Liebherr', N'T 284', 2021, N'363 toneladas', N'3650 HP', N'Camión de acarreo de ultra clase con transmisión eléctrica AC Litronic Plus. Uno de los camiones mineros más grandes del mundo, diseñado para minas de cobre y carbón de gran escala.', 'En uso', 9500000, 'https://assets-cdn.liebherr.com/versions/d7c1d9a8-6866-44b3-9188-1e0185d1c76e/w-1280_h-1280_f-webp/liebherr-T284.webp'),

    (N'Bulldozer Komatsu D375A', N'Empuje', N'Komatsu', N'D375A-8', 2022, N'55 toneladas', N'610 HP', N'Bulldozer de gran tonelaje para movimiento de material estéril y construcción de plataformas mineras. Hoja semi-U de gran capacidad y sistema de control de transmisión electrónico.', 'Disponible', 3900000, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRqWyeR574B3yOoJcWEU_IpXMjgCmYwrppqpPF9xUvNyeP7GRsTjCcb5LCs&s=10');
END
GO


-- ──────────────────────────────────────────────────────────────────
-- 7. ÍNDICES adicionales (mejoran las búsquedas/filtros del catálogo)
-- ──────────────────────────────────────────────────────────────────
-- El controller permite filtrar por categoria, estado, y buscar por
-- nombre/marca/modelo. Estos índices aceleran esas consultas a medida
-- que crezca el catálogo.
-- ──────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_maquinaria_categoria')
    CREATE INDEX IX_maquinaria_categoria ON maquinaria(categoria);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_maquinaria_estado')
    CREATE INDEX IX_maquinaria_estado ON maquinaria(estado);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_reservas_usuario')
    CREATE INDEX IX_reservas_usuario ON reservas(usuario_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_reservas_maquinaria')
    CREATE INDEX IX_reservas_maquinaria ON reservas(maquinaria_id);
GO


-- ──────────────────────────────────────────────────────────────────
-- 8. Verificación rápida — corre esto para confirmar que todo
--    quedó cargado correctamente.
-- ──────────────────────────────────────────────────────────────────

SELECT 'usuarios'   AS tabla, COUNT(*) AS filas FROM usuarios
UNION ALL
SELECT 'maquinaria', COUNT(*) FROM maquinaria
UNION ALL
SELECT 'reservas',   COUNT(*) FROM reservas;
GO