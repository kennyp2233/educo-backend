import { Injectable, NotFoundException } from '@nestjs/common';
import {
    PrismaService

} from 'src/prisma/prisma.service';
@Injectable()
export class UsuariosService {
    constructor(private prisma: PrismaService) { }

    // ✅ Crear usuario
    async crearUsuario(auth0Id: string) {
        return this.prisma.usuario.create({
            data: { auth0Id },
        });
    }

    // ✅ Asignar rol a usuario
    async asignarRol(usuarioId: string, rolId: number) {
        return this.prisma.usuarioRol.create({
            data: {
                usuarioId,
                rolId,
            },
        });
    }

    // ✅ Crear usuario y asignar rol
    async crearUsuarioConRol(auth0Id: string, rolId: number) {
        return this.prisma.$transaction(async (prisma) => {
            const usuario = await prisma.usuario.create({
                data: { auth0Id },
            });

            await prisma.usuarioRol.create({
                data: {
                    usuarioId: usuario.id,
                    rolId,
                },
            });

            return usuario;
        });
    }

    // ✅ Eliminar usuario (soft delete)
    async eliminarUsuario(usuarioId: string) {
        return this.prisma.usuario.delete({
            where: { id: usuarioId },
        });
    }

    // ✅ Webhook para sincronizar cambios desde Auth0
    async actualizarDesdeAuth0(auth0Id: string, datos: any) {
        return this.prisma.usuario.update({
            where: { auth0Id },
            data: datos,
        });
    }
}
