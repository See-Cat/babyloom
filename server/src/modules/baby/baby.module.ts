import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Baby } from '../../entities/baby.entity';
import { BabyService } from './baby.service';
import { BabyController } from './baby.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Baby])],
  providers: [BabyService],
  controllers: [BabyController],
  exports: [BabyService],
})
export class BabyModule {}
