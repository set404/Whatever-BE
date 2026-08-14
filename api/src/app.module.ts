import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { DecisionsModule } from './decisions/decisions.module';
import { GroupsModule } from './groups/groups.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Registered once here so ThrottlerStorage exists; AuthController is the
    // only place that actually applies ThrottlerGuard.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    RestaurantsModule,
    DecisionsModule,
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global: every route requires a valid access token unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
