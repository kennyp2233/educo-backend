import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private configService: ConfigService) {
    // ⚠️ No podemos usar `this` antes de `super()`, así que obtenemos las configuraciones en variables locales
    const auth0Domain = configService.get<string>('AUTH0_DOMAIN');
    const auth0Audience = configService.get<string>('AUTH0_AUDIENCE');

    super({
      jwtFromRequest: (req) => {
        const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        console.log('🔍 Token extraído de la solicitud:', token);
        return token;
      },
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
      }),
      audience: auth0Audience,
      issuer: `https://${auth0Domain}/`,
      algorithms: ['RS256'],

    });

    // Ahora sí podemos usar `this`
    this.logger.log('JwtStrategy inicializada correctamente.');
    this.logger.log(`Configuración utilizada:
      - JWKS URI: https://${auth0Domain}/.well-known/jwks.json
      - Audience: ${auth0Audience}
      - Issuer: https://${auth0Domain}/
    `);

    if (!auth0Domain) {
      this.logger.error('❌ AUTH0_DOMAIN no está definido en la configuración.');
    }

    if (!auth0Audience) {
      this.logger.error('❌ AUTH0_AUDIENCE no está definido en la configuración.');
    }
  }

  validate(payload: any) {
    this.logger.log('🔍 Revisando payload recibido en validate:');
    this.logger.log(payload);

    if (!payload) {
      this.logger.error('❌ No se recibió payload en el token JWT');
      throw new UnauthorizedException('Token inválido o expirado');
    }

    this.logger.log(`✅ Token validado con éxito: ${JSON.stringify(payload)}`);
    return payload;
  }

}
