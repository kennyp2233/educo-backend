// prisma/seed.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Roles principales que deben existir en el sistema
    const rolesData = [
        { nombre: 'admin' },
        { nombre: 'padre_familia' },
        { nombre: 'estudiante' },
        { nombre: 'profesor' },
        { nombre: 'tesorero' },
        { nombre: 'comite' },
        { nombre: 'institucion_educativa' }
    ];

    console.log('Iniciando seed de roles...');

    // Verificar y crear cada rol si no existe
    for (const roleData of rolesData) {
        const existingRole = await prisma.rol.findFirst({
            where: {
                nombre: {
                    contains: roleData.nombre,
                    mode: 'insensitive'
                }
            }
        });

        if (!existingRole) {
            const newRole = await prisma.rol.create({
                data: roleData
            });
            console.log(`Rol creado: ${newRole.nombre} (ID: ${newRole.id})`);
        } else {
            console.log(`Rol ya existe: ${existingRole.nombre} (ID: ${existingRole.id})`);
        }
    }

    console.log('Seed de roles completado');
}

main()
    .catch((e) => {
        console.error('Error en seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });