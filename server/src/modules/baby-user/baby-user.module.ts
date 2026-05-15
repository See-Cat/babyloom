import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BabyUser } from '../../entities/baby-user.entity';
import { BabyUserService } from './baby-user.service';
import { BabyUserController } from './baby-user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BabyUser])],
  providers: [BabyUserService],
  controllers: [BabyUserController],
  exports: [BabyUserService],
})
export class BabyUserModule {}
