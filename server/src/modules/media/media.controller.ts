import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { MediaService } from './media.service';
import { Media } from '../../entities/media.entity';
import { ensureUploadDir } from './upload-path.util';

@ApiTags('媒体')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('media')
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Get()
  @ApiOperation({ summary: '获取媒体列表' })
  async findAll(
    @Query('entryId') entryId?: string,
    @Query('babyId') babyId?: string,
    @Query('type') type?: string,
  ): Promise<Media[]> {
    return this.mediaService.findAll({ entryId, babyId, type });
  }

  @Post('upload')
  @ApiOperation({ summary: '上传文件' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, callback) => {
          const babyId = req.body.babyId || 'default';
          const date = new Date();
          const year = date.getFullYear().toString();
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const dest = join('./uploads', babyId, year, month);
          ensureUploadDir(dest);
          callback(null, dest);
        },
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('babyId') babyId: string,
    @Body('entryId') entryId: string,
  ) {
    const isVideo = file.mimetype.startsWith('video/');
    const relativePath = file.path.replace(/\\/g, '/').replace(/^\.\/uploads\//, '');

    return this.mediaService.create({
      type: isVideo ? 'video' : 'photo',
      url: `/uploads/${relativePath}`,
      babyId,
      entryId,
      size: file.size,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: '软删除媒体' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.mediaService.remove(id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: '恢复已删除媒体' })
  async restore(@Param('id') id: string): Promise<Media> {
    return this.mediaService.restore(id);
  }
}
