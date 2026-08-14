import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { DecisionsModule } from './decisions/decisions.module';
import { GroupsModule } from './groups/groups.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    GroupsModule,
    RestaurantsModule,
    DecisionsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global: every route requires a valid Supabase session unless marked @Public().
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
  ],
})
export class AppModule {}
