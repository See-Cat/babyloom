import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BabyService } from './baby.service';
import { Baby } from '../../entities/baby.entity';

@ApiTags('宝宝')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('baby')
export class BabyController {
  constructor(private babyService: BabyService) {}

  @Get()
  @ApiOperation({ summary: '获取宝宝列表' })
  async findAll(): Promise<Baby[]> {
    return this.babyService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取宝宝详情' })
  async findOne(@Param('id') id: string): Promise<Baby> {
    return this.babyService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建宝宝' })
  async create(@Body() data: Partial<Baby>): Promise<Baby> {
    return this.babyService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新宝宝信息' })
  async update(
    @Param('id') id: string,
    @Body() data: Partial<Baby>,
  ): Promise<Baby> {
    return this.babyService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除宝宝' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.babyService.remove(id);
  }
}
