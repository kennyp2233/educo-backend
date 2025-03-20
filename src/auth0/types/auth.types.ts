// src/auth0/types/auth.types.ts

export interface Auth0UserInfo {
    sub: string;
    email: string;
    name: string;
    picture?: string;
    [key: string]: any;
}

export interface Auth0Role {
    id: string;
    name: string;
    description?: string;
}

export interface Auth0TokenResponse {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
}

export interface AuthTokens {
    accessToken: string;
    idToken?: string;
    refreshToken?: string;
}

export interface UserProfile {
    auth0: {
        sub: string;
        email: string;
        name: string;
        picture?: string;
    };
    local: {
        id: string;
        roles: string[];
        perfil?: {
            tipo: 'padre' | 'estudiante' | 'profesor' | 'tesorero';
            datos: any;
        };
        estadoAprobacion?: any;
    };
}

export interface LoginResponse {
    tokens: AuthTokens;
    user: {
        sub: string;
        name: string;
        email: string;
        picture?: string;
        roles: string[];
        userId: string;
    };
}

export interface RegisterResponse {
    auth0User: {
        user_id: string;
        email: string;
        name: string;
    };
    localUser: {
        id: string;
        auth0Id: string;
        roles: Array<{
            rol: {
                id: number;
                nombre: string;
            }
        }>;
    };
}

export interface Auth0Config {
    domain: string;
    clientId: string;
    clientSecret: string;
    audience: string;
}