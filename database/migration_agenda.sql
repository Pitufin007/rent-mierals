-- ══════════════════════════════════════════════════════════════════
--  MIGRACIÓN — Agenda de equipos + bloqueo por fechas
--  Aplica SOLO los cambios nuevos sobre una base que ya existe
--  (no borra ni recrea nada). Seguro de correr varias veces.
--
--  Cambios:
--    1. Agrega la columna reservas.telefono (contacto del cliente).
--    2. Crea la tabla `agenda` (reservas aprobadas / días bloqueados).
--    3. Crea índices de la agenda.
--
--  Cómo aplicarla en Azure SQL (desde la carpeta del proyecto):
--    node backend/setup-azure-db.js database/migration_agenda.sql
--  o bien pegarla y ejecutarla en DBeaver conectado a la base RentMining.
-- ══════════════════════════════════════════════════════════════════

-- 1. Columna telefono en reservas ───────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('reservas') AND name = 'telefono'
)
BEGIN
    ALTER TABLE reservas ADD telefono NVARCHAR(50) NULL;
END
GO

-- 2. Tabla agenda ───────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'agenda')
BEGIN
    CREATE TABLE agenda (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        reserva_id          INT             NOT NULL,
        maquinaria_id       INT             NOT NULL,
        maquinaria_nombre   NVARCHAR(200)   NOT NULL,
        usuario_id          INT             NOT NULL,
        cliente_nombre      NVARCHAR(150)   NOT NULL,
        cliente_email       NVARCHAR(150)   NULL,
        cliente_telefono    NVARCHAR(50)    NULL,
        fecha_inicio        DATE            NOT NULL,
        fecha_fin           DATE            NOT NULL,
        precio_dia          DECIMAL(12,2)   NOT NULL DEFAULT 0,
        precio_total        DECIMAL(12,2)   NOT NULL DEFAULT 0,
        notas               NVARCHAR(500)   NULL,
        agendada_en         DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_agenda_reserva
            FOREIGN KEY (reserva_id) REFERENCES reservas(id)
            ON DELETE CASCADE,

        CONSTRAINT CK_agenda_fechas CHECK (fecha_fin >= fecha_inicio)
    );
END
GO

-- 3. Índices ────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_agenda_maquinaria')
    CREATE INDEX IX_agenda_maquinaria ON agenda(maquinaria_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_agenda_reserva')
    CREATE INDEX IX_agenda_reserva ON agenda(reserva_id);
GO

-- Verificación ──────────────────────────────────────────────────────
SELECT 'agenda' AS tabla, COUNT(*) AS filas FROM agenda;
GO
