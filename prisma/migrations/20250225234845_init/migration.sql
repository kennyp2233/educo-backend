-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "auth0Id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fotoPerfil" TEXT,
    "estado" TEXT NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rol" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioRol" (
    "usuario_id" TEXT NOT NULL,
    "rolId" INTEGER NOT NULL,

    CONSTRAINT "UsuarioRol_pkey" PRIMARY KEY ("usuario_id","rolId")
);

-- CreateTable
CREATE TABLE "Institucion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,

    CONSTRAINT "Institucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" SERIAL NOT NULL,
    "institucionId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "paralelo" TEXT NOT NULL,
    "anioLectivo" TEXT NOT NULL,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Padre" (
    "usuarioId" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,

    CONSTRAINT "Padre_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "Estudiante" (
    "usuarioId" TEXT NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "grado" TEXT NOT NULL,

    CONSTRAINT "Estudiante_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "PadreEstudiante" (
    "padreId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "esRepresentante" BOOLEAN NOT NULL,

    CONSTRAINT "PadreEstudiante_pkey" PRIMARY KEY ("padreId","estudianteId")
);

-- CreateTable
CREATE TABLE "Profesor" (
    "usuarioId" TEXT NOT NULL,
    "especialidad" TEXT NOT NULL,

    CONSTRAINT "Profesor_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "ProfesorCurso" (
    "profesorId" TEXT NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "esTutor" BOOLEAN NOT NULL,

    CONSTRAINT "ProfesorCurso_pkey" PRIMARY KEY ("profesorId","cursoId")
);

-- CreateTable
CREATE TABLE "Tesorero" (
    "usuarioId" TEXT NOT NULL,
    "cursoId" INTEGER NOT NULL,

    CONSTRAINT "Tesorero_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "Recaudacion" (
    "id" SERIAL NOT NULL,
    "tesoreroId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaCierre" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL,

    CONSTRAINT "Recaudacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Abono" (
    "id" SERIAL NOT NULL,
    "recaudacionId" INTEGER NOT NULL,
    "padreId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "comprobante" TEXT,
    "estado" TEXT NOT NULL,

    CONSTRAINT "Abono_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carnet" (
    "id" SERIAL NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "codigoQR" TEXT NOT NULL,
    "fechaExpiracion" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL,

    CONSTRAINT "Carnet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermisoTemporal" (
    "id" SERIAL NOT NULL,
    "padreId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "fechaEvento" TIMESTAMP(3) NOT NULL,
    "codigoQR" TEXT NOT NULL,
    "estado" TEXT NOT NULL,

    CONSTRAINT "PermisoTemporal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" SERIAL NOT NULL,
    "usuarioReceptorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_auth0Id_key" ON "Usuario"("auth0Id");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombre_key" ON "Rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioRol_usuario_id_key" ON "UsuarioRol"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "Carnet_estudianteId_key" ON "Carnet"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "Carnet_codigoQR_key" ON "Carnet"("codigoQR");

-- CreateIndex
CREATE UNIQUE INDEX "PermisoTemporal_codigoQR_key" ON "PermisoTemporal"("codigoQR");

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_institucionId_fkey" FOREIGN KEY ("institucionId") REFERENCES "Institucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Padre" ADD CONSTRAINT "Padre_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estudiante" ADD CONSTRAINT "Estudiante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estudiante" ADD CONSTRAINT "Estudiante_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadreEstudiante" ADD CONSTRAINT "PadreEstudiante_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "Padre"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadreEstudiante" ADD CONSTRAINT "PadreEstudiante_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profesor" ADD CONSTRAINT "Profesor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfesorCurso" ADD CONSTRAINT "ProfesorCurso_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfesorCurso" ADD CONSTRAINT "ProfesorCurso_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tesorero" ADD CONSTRAINT "Tesorero_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tesorero" ADD CONSTRAINT "Tesorero_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recaudacion" ADD CONSTRAINT "Recaudacion_tesoreroId_fkey" FOREIGN KEY ("tesoreroId") REFERENCES "Tesorero"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abono" ADD CONSTRAINT "Abono_recaudacionId_fkey" FOREIGN KEY ("recaudacionId") REFERENCES "Recaudacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abono" ADD CONSTRAINT "Abono_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "Padre"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abono" ADD CONSTRAINT "Abono_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carnet" ADD CONSTRAINT "Carnet_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoTemporal" ADD CONSTRAINT "PermisoTemporal_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "Padre"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoTemporal" ADD CONSTRAINT "PermisoTemporal_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioReceptorId_fkey" FOREIGN KEY ("usuarioReceptorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
