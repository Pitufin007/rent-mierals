-- ══════════════════════════════════════════════════════════════════
--  MIGRACIÓN — Mantenimiento por fechas
--  Crea la tabla `mantenimiento`, donde el admin registra rangos de
--  fechas (desde–hasta) en que una máquina está en mantención. Esos
--  días se bloquean en el calendario de reserva (en naranjo), igual que
--  las reservas aprobadas se bloquean en rojo.
--
--  Seguro de correr varias veces.
--
--  Aplicar en Azure:
--    node backend/setup-azure-db.js database/migration_mantenimiento.sql
-- ══════════════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'mantenimiento')
BEGIN
    CREATE TABLE mantenimiento (
        id                INT IDENTITY(1,1) PRIMARY KEY,
        maquinaria_id     INT            NOT NULL,
        maquinaria_nombre NVARCHAR(200)  NOT NULL,
        fecha_inicio      DATE           NOT NULL,
        fecha_fin         DATE           NOT NULL,
        motivo            NVARCHAR(500)   NULL,
        creado_en         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_mantenimiento_maquinaria
            FOREIGN KEY (maquinaria_id) REFERENCES maquinaria(id)
            ON DELETE CASCADE,

        CONSTRAINT CK_mantenimiento_fechas CHECK (fecha_fin >= fecha_inicio)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_mantenimiento_maquinaria')
    CREATE INDEX IX_mantenimiento_maquinaria ON mantenimiento(maquinaria_id);
GO

SELECT 'mantenimiento' AS tabla, COUNT(*) AS filas FROM mantenimiento;
GO
