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
import { MilestoneService } from './milestone.service';
import { Milestone } from '../../entities/milestone.entity';

@ApiTags('里程碑')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('milestones')
export class MilestoneController {
  constructor(private milestoneService: MilestoneService) {}

  @Get()
  @ApiOperation({ summary: '获取里程碑列表' })
  async findAll(
    @Query('isActive') isActive?: boolean,
    @Query('includeEntries') includeEntries?: boolean,
  ): Promise<Milestone[]> {
    return this.milestoneService.findAll({
      isActive: isActive !== false,
      includeEntries: includeEntries === true,
    });
  }

  @Get('available')
  @ApiOperation({ summary: '获取可选里程碑（排除已选）' })
  async getAvailable(
    @Query('entryId') entryId?: string,
  ): Promise<Milestone[]> {
    return this.milestoneService.getAvailableMilestones(entryId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取里程碑详情' })
  async findOne(@Param('id') id: string): Promise<Milestone> {
    return this.milestoneService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建里程碑' })
  async create(@Body() data: Partial<Milestone>): Promise<Milestone> {
    return this.milestoneService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新里程碑' })
  async update(
    @Param('id') id: string,
    @Body() data: Partial<Milestone>,
  ): Promise<Milestone> {
    return this.milestoneService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除里程碑' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.milestoneService.remove(id);
  }
}
