// scripts/fix-user-profiles.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getDefaultCourseId(): Promise<number> {
    const firstCourse = await prisma.curso.findFirst();
    if (!firstCourse) {
        throw new Error('No se encontraron cursos en el sistema. Cree al menos un curso primero.');
    }
    return firstCourse.id;
}

async function fixUserProfiles() {
    console.log('Iniciando corrección de perfiles de usuario...');

    try {
        // Obtener ID del curso por defecto
        const defaultCourseId = await getDefaultCourseId();
        console.log(`Usando curso ID ${defaultCourseId} como valor por defecto`);

        // 1. Corregir usuarios con rol padre_familia pero sin perfil de padre
        const padresIncompletos = await prisma.usuarioRol.findMany({
            where: {
                rol: {
                    nombre: {
                        in: ['padre', 'padre_familia'],
                        mode: 'insensitive'
                    }
                },
                usuario: {
                    padres: null
                }
            },
            include: {
                usuario: true,
                rol: true
            }
        });

        console.log(`Encontrados ${padresIncompletos.length} usuarios con rol padre pero sin perfil`);

        for (const usuario of padresIncompletos) {
            console.log(`Creando perfil de padre para usuario ${usuario.usuarioId} (Auth0ID: ${usuario.usuario.auth0Id})`);
            await prisma.padre.create({
                data: {
                    usuarioId: usuario.usuarioId,
                    direccion: 'Por completar',
                    telefono: 'Por completar'
                }
            });
        }

        // 2. Corregir usuarios con rol estudiante pero sin perfil de estudiante
        const estudiantesIncompletos = await prisma.usuarioRol.findMany({
            where: {
                rol: {
                    nombre: {
                        equals: 'estudiante',
                        mode: 'insensitive'
                    }
                },
                usuario: {
                    estudiante: null
                }
            },
            include: {
                usuario: true,
                rol: true
            }
        });

        console.log(`Encontrados ${estudiantesIncompletos.length} usuarios con rol estudiante pero sin perfil`);

        for (const usuario of estudiantesIncompletos) {
            console.log(`Creando perfil de estudiante para usuario ${usuario.usuarioId} (Auth0ID: ${usuario.usuario.auth0Id})`);
            await prisma.estudiante.create({
                data: {
                    usuarioId: usuario.usuarioId,
                    cursoId: defaultCourseId,
                    grado: 'Por asignar'
                }
            });
        }

        // 3. Corregir usuarios con rol profesor pero sin perfil de profesor
        const profesoresIncompletos = await prisma.usuarioRol.findMany({
            where: {
                rol: {
                    nombre: {
                        equals: 'profesor',
                        mode: 'insensitive'
                    }
                },
                usuario: {
                    profesor: null
                }
            },
            include: {
                usuario: true,
                rol: true
            }
        });

        console.log(`Encontrados ${profesoresIncompletos.length} usuarios con rol profesor pero sin perfil`);

        for (const usuario of profesoresIncompletos) {
            console.log(`Creando perfil de profesor para usuario ${usuario.usuarioId} (Auth0ID: ${usuario.usuario.auth0Id})`);
            await prisma.profesor.create({
                data: {
                    usuarioId: usuario.usuarioId,
                    especialidad: 'Por completar'
                }
            });
        }

        // 4. Corregir usuarios con rol tesorero pero sin perfil de tesorero
        const tesorerosIncompletos = await prisma.usuarioRol.findMany({
            where: {
                rol: {
                    nombre: {
                        equals: 'tesorero',
                        mode: 'insensitive'
                    }
                },
                usuario: {
                    tesorero: null
                }
            },
            include: {
                usuario: true,
                rol: true
            }
        });

        console.log(`Encontrados ${tesorerosIncompletos.length} usuarios con rol tesorero pero sin perfil`);

        for (const usuario of tesorerosIncompletos) {
            console.log(`Creando perfil de tesorero para usuario ${usuario.usuarioId} (Auth0ID: ${usuario.usuario.auth0Id})`);
            await prisma.tesorero.create({
                data: {
                    usuarioId: usuario.usuarioId,
                    cursoId: defaultCourseId
                }
            });
        }

        console.log('Corrección de perfiles completada con éxito');

    } catch (error) {
        console.error('Error al corregir perfiles:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Ejecutar la función si este archivo se ejecuta directamente
if (require.main === module) {
    fixUserProfiles()
        .then(() => console.log('Proceso finalizado'))
        .catch(e => {
            console.error('Error en el proceso principal:', e);
            process.exit(1);
        });
}

// Exportar para uso en otros scripts
export { fixUserProfiles };