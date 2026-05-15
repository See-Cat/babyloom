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
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { EntryService } from './entry.service';
import { Entry } from '../../entities/entry.entity';

@ApiTags('记录')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('entries')
export class EntryController {
  constructor(private entryService: EntryService) {}

  @Get()
  @ApiOperation({ summary: '获取记录列表' })
  async findAll(
    @Query('babyId') babyId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tags') tags?: string[],
    @Query('milestoneIds') milestoneIds?: string[],
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('includeDeleted') includeDeleted?: boolean,
  ) {
    return this.entryService.findAll({
      babyId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      tags,
      milestoneIds,
      page,
      limit,
      includeDeleted,
    });
  }

  @Get('trash')
  @ApiOperation({ summary: '获取已删除记录（垃圾桶）' })
  async getTrash(
    @Query('babyId') babyId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.entryService.findAll({
      babyId,
      page,
      limit,
      includeDeleted: true,
    });
  }

  @Get('calendar/:year/:month')
  @ApiOperation({ summary: '获取日历数据' })
  async getCalendar(
    @Param('year') year: number,
    @Param('month') month: number,
  ): Promise<string[]> {
    return this.entryService.getCalendarData(year, month);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取记录详情' })
  async findOne(@Param('id') id: string): Promise<Entry> {
    return this.entryService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建记录' })
  async create(
    @Body() data: Partial<Entry> & { milestoneIds?: string[] },
    @Request() req,
  ): Promise<Entry> {
    return this.entryService.create({
      ...data,
      createdBy: req.user.userId,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: '更新记录' })
  async update(
    @Param('id') id: string,
    @Body() data: Partial<Entry> & { milestoneIds?: string[] },
  ): Promise<Entry> {
    return this.entryService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '软删除记录' })
  async remove(@Param('id') id: string, @Request() req): Promise<void> {
    return this.entryService.remove(id, req.user.userId);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: '恢复已删除记录' })
  async restore(@Param('id') id: string): Promise<Entry> {
    return this.entryService.restore(id);
  }
}
