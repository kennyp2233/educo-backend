import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient<
  {
    log: [
      { emit: 'event'; level: 'query' },
      { emit: 'event'; level: 'error' },
      { emit: 'event'; level: 'info' },
      { emit: 'event'; level: 'warn' }
    ]
  },
  'query' | 'error' | 'info' | 'warn'
> implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        super({
            log: [
                { emit: 'event', level: 'query' },
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'info' },
                { emit: 'event', level: 'warn' },
            ],
        });

        // Logging de consultas en desarrollo
        if (process.env.NODE_ENV !== 'production') {
            this.$on('query', (e: any) => {
                this.logger.debug(`Query: ${e.query}`);
                this.logger.debug(`Params: ${e.params}`);
                this.logger.debug(`Duration: ${e.duration}ms`);
            });
        }

        // Logging de errores en todos los entornos
        this.$on('error', (e: any) => {
            this.logger.error(`Database error: ${e.message}`);
        });
    }

    async onModuleInit() {
        this.logger.log('Prisma Service initialized');
        await this.$connect();
    }

    async onModuleDestroy() {
        this.logger.log('Prisma Service destroyed');
        await this.$disconnect();
    }

    /**
     * Ejecuta una transacción con callback personalizado
     * @param callback Función a ejecutar dentro de la transacción
     */
    async executeTransaction<T>(callback: (prisma: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>): Promise<T> {
        return this.$transaction(async (prisma) => {
            return callback(prisma);
        });
    }

    /**
     * Helper para limpiar la base de datos en tests
     */
    async cleanDatabase() {
        if (process.env.NODE_ENV !== 'test') {
            throw new Error('Este método solo debe usarse en entorno de pruebas');
        }

        const models = Reflect.ownKeys(this).filter(
            (key) => typeof key === 'string' && key[0] !== '_' && key[0] !== '$',
        ) as string[];

        return await Promise.all(
            models.map((modelName) => {
                // @ts-ignore - usamos la propiedad dinámica
                return this[modelName].deleteMany();
            }),
        );
    }
}