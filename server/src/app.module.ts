import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { BabyModule } from './modules/baby/baby.module';
import { EntryModule } from './modules/entry/entry.module';
import { MediaModule } from './modules/media/media.module';
import { MilestoneModule } from './modules/milestone/milestone.module';
import { UserModule } from './modules/user/user.module';
import { BabyUserModule } from './modules/baby-user/baby-user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USERNAME || process.env.DB_USER || 'babyloom',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'babyloom',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    AuthModule,
    BabyModule,
    EntryModule,
    MediaModule,
    MilestoneModule,
    UserModule,
    BabyUserModule,
  ],
})
export class AppModule {}
