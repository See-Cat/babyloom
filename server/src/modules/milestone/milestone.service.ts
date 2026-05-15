import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Milestone } from '../../entities/milestone.entity';

@Injectable()
export class MilestoneService {
  constructor(
    @InjectRepository(Milestone)
    private milestoneRepository: Repository<Milestone>,
  ) {}

  async findAll(query: { isActive?: boolean; includeEntries?: boolean } = {}): Promise<Milestone[]> {
    const { isActive = true, includeEntries = false } = query;
    
    const relations = includeEntries ? ['entries'] : [];
    
    return this.milestoneRepository.find({
      where: { isActive },
      relations,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Milestone> {
    return this.milestoneRepository.findOne({
      where: { id },
      relations: ['entries'],
    });
  }

  async findByIds(ids: string[]): Promise<Milestone[]> {
    return this.milestoneRepository.findBy({ id: In(ids) });
  }

  async create(data: Partial<Milestone>): Promise<Milestone> {
    const milestone = this.milestoneRepository.create(data);
    return this.milestoneRepository.save(milestone);
  }

  async update(id: string, data: Partial<Milestone>): Promise<Milestone> {
    await this.milestoneRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.milestoneRepository.delete(id);
  }

  async getAvailableMilestones(entryId?: string): Promise<Milestone[]> {
    const queryBuilder = this.milestoneRepository.createQueryBuilder('milestone')
      .where('milestone.isActive = :isActive', { isActive: true })
      .orderBy('milestone.sortOrder', 'ASC');

    if (entryId) {
      queryBuilder.andWhere(
        'milestone.id NOT IN (SELECT "milestoneId" FROM entry_milestones WHERE "entryId" = :entryId)',
        { entryId }
      );
    }

    return queryBuilder.getMany();
  }
}
