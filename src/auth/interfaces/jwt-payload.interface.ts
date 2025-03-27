// src/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
    sub: string;
    email: string;
    roles: string[];
    tokenType?: string;  // Para distinguir entre tokens de acceso y refresh
    [key: string]: any;
}