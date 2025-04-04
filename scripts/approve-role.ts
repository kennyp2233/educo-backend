// scripts/approve-role.ts
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

// Interfaz para lectura de consola
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Función para buscar un usuario por email
 */
async function findUserByEmail(email: string) {
    const user = await prisma.usuario.findFirst({
        where: { email },
        include: {
            roles: {
                include: {
                    rol: true
                }
            }
        }
    });

    return user;
}

/**
 * Función para listar todos los roles pendientes
 */
async function listAllPendingRoles() {
    const pendingRoles = await prisma.usuarioRol.findMany({
        where: {
            estadoAprobacion: 'PENDIENTE'
        },
        include: {
            usuario: true,
            rol: true
        }
    });

    console.log('\n===== ROLES PENDIENTES DE APROBACIÓN =====');

    if (pendingRoles.length === 0) {
        console.log('No hay roles pendientes de aprobación');
        return [];
    }

    pendingRoles.forEach((role, index) => {
        console.log(`${index + 1}. Usuario: ${role.usuario.email} (${role.usuario.nombre}) - Rol: ${role.rol.nombre} (ID: ${role.rol.id})`);
    });

    return pendingRoles;
}

/**
 * Función para aprobar un rol específico
 */
async function approveRole(usuarioId: string, rolId: number, adminId: string) {
    try {
        // 1. Buscar la asignación de rol
        const usuarioRol = await prisma.usuarioRol.findUnique({
            where: {
                usuarioId_rolId: {
                    usuarioId,
                    rolId
                }
            },
            include: {
                rol: true,
                usuario: true
            }
        });

        if (!usuarioRol) {
            throw new Error(`No se encontró asignación del rol ${rolId} al usuario ${usuarioId}`);
        }

        if (usuarioRol.estadoAprobacion !== 'PENDIENTE') {
            throw new Error(`La solicitud ya fue ${usuarioRol.estadoAprobacion.toLowerCase()}`);
        }

        console.log(`\nAprobando rol "${usuarioRol.rol.nombre}" para el usuario "${usuarioRol.usuario.email}"...`);

        // 2. Actualizar en una transacción
        await prisma.$transaction(async (tx) => {
            // 2.1. Actualizar estado del rol
            const rolActualizado = await tx.usuarioRol.update({
                where: {
                    usuarioId_rolId: {
                        usuarioId,
                        rolId
                    }
                },
                data: {
                    estadoAprobacion: 'APROBADO',
                    aprobadorId: adminId,
                    fechaAprobacion: new Date()
                }
            });

            // 2.2. Intentar parsear los datos del perfil
            let perfilData = {};
            try {
                if (usuarioRol.comentarios && usuarioRol.comentarios.startsWith('{')) {
                    perfilData = JSON.parse(usuarioRol.comentarios);
                }
            } catch (e) {
                console.log(`Error al parsear datos del perfil: ${e.message}`);
            }

            // 2.3. Crear perfil según el tipo de rol
            const rolNombre = usuarioRol.rol.nombre.toLowerCase();

            if (rolNombre === 'padre' || rolNombre === 'padre_familia') {
                // Verificar si ya existe un perfil de padre para este usuario
                const padreExistente = await tx.padre.findUnique({
                    where: { usuarioId }
                });

                if (!padreExistente) {
                    await tx.padre.create({
                        data: {
                            usuarioId,
                            direccion: perfilData['direccion'] || 'Por completar',
                            telefono: perfilData['telefono'] || 'Por completar'
                        }
                    });
                    console.log('Perfil de padre creado exitosamente');
                } else {
                    console.log('El perfil de padre ya existe, no se ha creado uno nuevo');
                }
            } else if (rolNombre === 'estudiante') {
                // Verificar si ya existe un perfil de estudiante
                const estudianteExistente = await tx.estudiante.findUnique({
                    where: { usuarioId }
                });

                if (!estudianteExistente) {
                    // Obtener un curso por defecto si no hay uno asignado
                    let cursoId = usuarioRol.cursoId;
                    if (!cursoId) {
                        const curso = await tx.curso.findFirst();
                        if (!curso) {
                            throw new Error('No hay cursos disponibles en el sistema');
                        }
                        cursoId = curso.id;
                    }

                    await tx.estudiante.create({
                        data: {
                            usuarioId,
                            cursoId,
                            grado: perfilData['grado'] || 'Por asignar'
                        }
                    });
                    console.log('Perfil de estudiante creado exitosamente');
                } else {
                    console.log('El perfil de estudiante ya existe, no se ha creado uno nuevo');
                }
            } else if (rolNombre === 'profesor') {
                // Verificar si ya existe un perfil de profesor
                const profesorExistente = await tx.profesor.findUnique({
                    where: { usuarioId }
                });

                if (!profesorExistente) {
                    await tx.profesor.create({
                        data: {
                            usuarioId,
                            especialidad: perfilData['especialidad'] || 'Por completar'
                        }
                    });
                    console.log('Perfil de profesor creado exitosamente');
                } else {
                    console.log('El perfil de profesor ya existe, no se ha creado uno nuevo');
                }
            } else if (rolNombre === 'tesorero') {
                // Verificar si ya existe un perfil de tesorero
                const tesoreroExistente = await tx.tesorero.findUnique({
                    where: { usuarioId }
                });

                if (!tesoreroExistente) {
                    // Obtener un curso por defecto si no hay uno asignado
                    let cursoId = usuarioRol.cursoId;
                    if (!cursoId) {
                        const curso = await tx.curso.findFirst();
                        if (!curso) {
                            throw new Error('No hay cursos disponibles en el sistema');
                        }
                        cursoId = curso.id;
                    }

                    await tx.tesorero.create({
                        data: {
                            usuarioId,
                            cursoId
                        }
                    });
                    console.log('Perfil de tesorero creado exitosamente');
                } else {
                    console.log('El perfil de tesorero ya existe, no se ha creado uno nuevo');
                }
            }

            // 2.4. Crear notificación
            await tx.notificacion.create({
                data: {
                    usuarioReceptorId: usuarioId,
                    titulo: `Rol ${usuarioRol.rol.nombre} aprobado`,
                    mensaje: `Su solicitud para el rol ${usuarioRol.rol.nombre} ha sido aprobada`,
                    tipo: 'EXITO'
                }
            });
            console.log('Notificación enviada al usuario');
        });

        console.log(`\n✅ Rol aprobado exitosamente`);
    } catch (error) {
        console.error(`❌ Error al aprobar rol: ${error.message}`);
    }
}

/**
 * Función principal del script
 */
async function main() {
    console.log('===== SCRIPT DE APROBACIÓN DE ROLES =====');

    // 1. Obtener admin para usar como aprobador
    let adminUser;
    try {
        // Buscar un usuario con rol admin
        const adminRol = await prisma.rol.findFirst({
            where: {
                nombre: { contains: 'admin', mode: 'insensitive' }
            }
        });

        if (!adminRol) {
            throw new Error('No se encontró el rol de administrador en el sistema');
        }

        // Buscar un usuario admin
        const adminUserRole = await prisma.usuarioRol.findFirst({
            where: {
                rolId: adminRol.id,
                estadoAprobacion: 'APROBADO'
            },
            include: {
                usuario: true
            }
        });

        if (!adminUserRole) {
            throw new Error('No hay administradores en el sistema. Debe crear uno primero.');
        }

        adminUser = adminUserRole.usuario;
        console.log(`\nUsando administrador: ${adminUser.email} (${adminUser.id}) como aprobador`);
    } catch (error) {
        console.error(`Error al buscar administrador: ${error.message}`);
        process.exit(1);
    }

    // 2. Menú de opciones
    const showMenu = async () => {
        console.log('\n===== MENÚ PRINCIPAL =====');
        console.log('1. Listar roles pendientes');
        console.log('2. Aprobar rol por selección');
        console.log('3. Aprobar rol por email de usuario');
        console.log('4. Salir');

        rl.question('\nSeleccione una opción: ', async (option) => {
            switch (option) {
                case '1':
                    await listAllPendingRoles();
                    return showMenu();

                case '2':
                    const pendingRoles = await listAllPendingRoles();
                    if (pendingRoles.length === 0) {
                        return showMenu();
                    }

                    rl.question('\nSeleccione el número del rol a aprobar: ', async (index) => {
                        const idx = parseInt(index) - 1;
                        if (isNaN(idx) || idx < 0 || idx >= pendingRoles.length) {
                            console.log('Selección inválida');
                            return showMenu();
                        }

                        const selectedRole = pendingRoles[idx];
                        await approveRole(selectedRole.usuarioId, selectedRole.rolId, adminUser.id);
                        return showMenu();
                    });
                    break;

                case '3':
                    rl.question('\nIngrese el email del usuario: ', async (email) => {
                        const user = await findUserByEmail(email);
                        if (!user) {
                            console.log(`No se encontró ningún usuario con el email ${email}`);
                            return showMenu();
                        }

                        console.log('\nRoles pendientes para este usuario:');
                        const pendingUserRoles = user.roles.filter(r => r.estadoAprobacion === 'PENDIENTE');

                        if (pendingUserRoles.length === 0) {
                            console.log('Este usuario no tiene roles pendientes de aprobación');
                            return showMenu();
                        }

                        pendingUserRoles.forEach((role, index) => {
                            console.log(`${index + 1}. ${role.rol.nombre} (ID: ${role.rolId})`);
                        });

                        rl.question('\nSeleccione el número del rol a aprobar: ', async (index) => {
                            const idx = parseInt(index) - 1;
                            if (isNaN(idx) || idx < 0 || idx >= pendingUserRoles.length) {
                                console.log('Selección inválida');
                                return showMenu();
                            }

                            const selectedRole = pendingUserRoles[idx];
                            await approveRole(user.id, selectedRole.rolId, adminUser.id);
                            return showMenu();
                        });
                    });
                    break;

                case '4':
                    console.log('Saliendo del programa...');
                    await prisma.$disconnect();
                    rl.close();
                    break;

                default:
                    console.log('Opción inválida');
                    return showMenu();
            }
        });
    };

    await showMenu();
}

// Ejecutar el script
main().catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});