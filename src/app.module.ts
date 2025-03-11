// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './users/users.module';
import { Auth0Module } from './auth0/auth0.module';
import { JwtStrategy } from './auth0/strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    UsuariosModule,
    Auth0Module,
  ],
  providers: [JwtStrategy],
})
export class AppModule { }