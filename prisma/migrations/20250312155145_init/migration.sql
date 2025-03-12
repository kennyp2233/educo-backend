-- AlterTable
ALTER TABLE "PadreEstudiante" ADD COLUMN     "aprobadorId" TEXT,
ADD COLUMN     "estadoVinculacion" TEXT NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "fechaAprobacion" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProfesorCurso" ADD COLUMN     "puedeAprobarPermisos" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EstadoAprobacion" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "estadoActual" TEXT NOT NULL,
    "aprobadorId" TEXT,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaResolucion" TIMESTAMP(3),
    "comentarios" TEXT,

    CONSTRAINT "EstadoAprobacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermisoAcceso" (
    "id" SERIAL NOT NULL,
    "padreId" TEXT NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "tipoPermiso" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "aprobadorId" TEXT,
    "estadoPermiso" TEXT NOT NULL,
    "codigoQR" TEXT,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaAprobacion" TIMESTAMP(3),

    CONSTRAINT "PermisoAcceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstadoAprobacion_usuarioId_key" ON "EstadoAprobacion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PermisoAcceso_codigoQR_key" ON "PermisoAcceso"("codigoQR");

-- AddForeignKey
ALTER TABLE "EstadoAprobacion" ADD CONSTRAINT "EstadoAprobacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstadoAprobacion" ADD CONSTRAINT "EstadoAprobacion_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoAcceso" ADD CONSTRAINT "PermisoAcceso_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "Padre"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoAcceso" ADD CONSTRAINT "PermisoAcceso_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoAcceso" ADD CONSTRAINT "PermisoAcceso_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
