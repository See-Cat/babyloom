import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BabyUserService } from './baby-user.service';
import { BabyUser } from '../../entities/baby-user.entity';

@ApiTags('宝宝成员关联')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('baby-users')
export class BabyUserController {
  constructor(private babyUserService: BabyUserService) {}

  @Get()
  @ApiOperation({ summary: '获取关联列表' })
  async findAll(
    @Query('babyId') babyId?: string,
    @Query('userId') userId?: string,
  ): Promise<BabyUser[]> {
    return this.babyUserService.findAll({ babyId, userId });
  }

  @Get(':id')
  @ApiOperation({ summary: '获取关联详情' })
  async findOne(@Param('id') id: string): Promise<BabyUser> {
    return this.babyUserService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建关联' })
  async create(@Body() data: Partial<BabyUser>): Promise<BabyUser> {
    return this.babyUserService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新关联' })
  async update(
    @Param('id') id: string,
    @Body() data: Partial<BabyUser>,
  ): Promise<BabyUser> {
    return this.babyUserService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除关联' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.babyUserService.remove(id);
  }
}
