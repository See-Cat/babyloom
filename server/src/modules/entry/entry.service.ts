import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Entry } from '../../entities/entry.entity';

@Injectable()
export class EntryService {
  constructor(
    @InjectRepository(Entry)
    private entryRepository: Repository<Entry>,
  ) {}

  async findAll(query: {
    babyId?: string;
    startDate?: Date;
    endDate?: Date;
    tags?: string[];
    milestoneIds?: string[];
    page?: number;
    limit?: number;
    includeDeleted?: boolean;
  }): Promise<{ items: Entry[]; total: number }> {
    const {
      babyId,
      startDate,
      endDate,
      tags,
      milestoneIds,
      page = 1,
      limit = 20,
      includeDeleted = false,
    } = query;

    const queryBuilder = this.entryRepository.createQueryBuilder('entry')
      .leftJoinAndSelect('entry.media', 'media')
      .leftJoinAndSelect('entry.creator', 'creator')
      .leftJoinAndSelect('entry.milestones', 'milestones');

    if (babyId) {
      queryBuilder.andWhere('entry.babyId = :babyId', { babyId });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('entry.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('entry.tags @> :tags', { tags });
    }

    if (milestoneIds && milestoneIds.length > 0) {
      queryBuilder.andWhere('milestones.id IN (:...milestoneIds)', { milestoneIds });
    }

    if (!includeDeleted) {
      queryBuilder.andWhere('entry.deletedAt IS NULL');
    }

    const [items, total] = await queryBuilder
      .orderBy('entry.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(id: string, includeDeleted = false): Promise<Entry> {
    const queryBuilder = this.entryRepository.createQueryBuilder('entry')
      .leftJoinAndSelect('entry.media', 'media')
      .leftJoinAndSelect('entry.creator', 'creator')
      .leftJoinAndSelect('entry.baby', 'baby')
      .leftJoinAndSelect('entry.milestones', 'milestones')
      .where('entry.id = :id', { id });

    if (!includeDeleted) {
      queryBuilder.andWhere('entry.deletedAt IS NULL');
    }

    return queryBuilder.getOne();
  }

  async create(data: Partial<Entry> & { milestoneIds?: string[] }): Promise<Entry> {
    const { milestoneIds, ...entryData } = data;
    
    const entry = this.entryRepository.create(entryData);
    
    if (milestoneIds && milestoneIds.length > 0) {
      entry.milestones = milestoneIds.map(id => ({ id } as any));
    }
    
    return this.entryRepository.save(entry);
  }

  async update(id: string, data: Partial<Entry> & { milestoneIds?: string[] }): Promise<Entry> {
    const { milestoneIds, ...entryData } = data;
    
    await this.entryRepository.update(id, entryData);
    
    if (milestoneIds !== undefined) {
      const entry = await this.entryRepository.findOne({
        where: { id },
        relations: ['milestones'],
      });
      
      if (entry) {
        entry.milestones = milestoneIds.map(id => ({ id } as any));
        await this.entryRepository.save(entry);
      }
    }
    
    return this.findOne(id);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.entryRepository.softDelete(id);
    await this.entryRepository.update(id, { deletedBy: userId });
  }

  async restore(id: string): Promise<Entry> {
    await this.entryRepository.restore(id);
    return this.findOne(id);
  }

  async getCalendarData(year: number, month: number): Promise<string[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const entries = await this.entryRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
        deletedAt: null,
      },
      select: ['createdAt'],
    });

    const dateSet = new Set<string>();
    entries.forEach((entry) => {
      const date = entry.createdAt;
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dateSet.add(dateStr);
    });

    return Array.from(dateSet);
  }
}
