// src/app.module.ts (actualizado)

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './users/users.module';
import { Auth0Module } from './auth0/auth0.module';
import { JwtStrategy } from './auth0/strategies/jwt.strategy';
import { InstitucionModule } from './institucion/institucion.module';
import { RecaudacionModule } from './recaudacion/recaudacion.module';
import { CarnetModule } from './carnet/carnet.module';
import { NotificacionModule } from './notificacion/notificacion.module';
import { AprobacionesModule } from './aprobaciones/aprobaciones.module';
import { PermisosModule } from './permisos/permisos.module';
import { PadresModule } from './padres/padres.module'; // Importar el nuevo módulo

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    UsuariosModule,
    Auth0Module,
    InstitucionModule,
    RecaudacionModule,
    CarnetModule,
    NotificacionModule,
    AprobacionesModule,
    PermisosModule,
    PadresModule, // Agregar el módulo de padres
  ],
  providers: [JwtStrategy],
})
export class AppModule { }