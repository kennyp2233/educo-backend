// src/auth0/types/auth-response.types.ts

// Respuesta de token de autenticación
export interface AuthTokens {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
}

// Información básica del usuario
export interface UserBasicInfo {
    id: string;          // ID local
    auth0Id: string;     // sub de Auth0
    name: string;
    email: string;
    picture?: string;
    roles: string[];     // Nombres de roles (strings)
    rolesApproved?: { role: string, approved: boolean }[]; // Roles con estado de aprobación
}

// Datos específicos de perfil
export interface UserProfile {
    type: 'padre' | 'estudiante' | 'profesor' | 'tesorero' | 'admin' | 'none';
    data?: any;         // Datos específicos del perfil
}

// Respuesta estandarizada para operaciones de autenticación
export interface AuthResponse {
    auth?: {
        tokens: AuthTokens;
    };
    user: UserBasicInfo & {
        profile?: UserProfile;
    };
}

// Respuesta para registro de usuarios
export interface RegisterResponse {
    success: boolean;
    message: string;
    auth?: {
        tokens: AuthTokens;
    };
    user: UserBasicInfo;
}

// Respuestas de error estandarizadas
export interface ErrorResponse {
    status: number;
    message: string;
    errors?: any[];
}