import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from '../../entities/media.entity';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
  ) {}

  async findAll(query: {
    entryId?: string;
    babyId?: string;
    type?: string;
    includeDeleted?: boolean;
  }): Promise<Media[]> {
    const { entryId, babyId, type, includeDeleted = false } = query;
    const where: any = {};

    if (entryId) {
      where.entryId = entryId;
    }
    if (babyId) {
      where.babyId = babyId;
    }
    if (type) {
      where.type = type;
    }

    const queryBuilder = this.mediaRepository.createQueryBuilder('media')
      .where(where);

    if (!includeDeleted) {
      queryBuilder.andWhere('media.deletedAt IS NULL');
    }

    return queryBuilder
      .orderBy('media.createdAt', 'DESC')
      .getMany();
  }

  async create(data: Partial<Media>): Promise<Media> {
    const media = this.mediaRepository.create(data);
    return this.mediaRepository.save(media);
  }

  async remove(id: string): Promise<void> {
    await this.mediaRepository.softDelete(id);
  }

  async restore(id: string): Promise<Media> {
    await this.mediaRepository.restore(id);
    return this.mediaRepository.findOne({ where: { id } });
  }
}
