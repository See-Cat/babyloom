import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Baby } from '../../entities/baby.entity';

@Injectable()
export class BabyService {
  constructor(
    @InjectRepository(Baby)
    private babyRepository: Repository<Baby>,
  ) {}

  async findAll(): Promise<Baby[]> {
    return this.babyRepository.find({
      relations: ['entries', 'babyUsers', 'babyUsers.user'],
    });
  }

  async findOne(id: string): Promise<Baby> {
    const baby = await this.babyRepository.findOne({
      where: { id },
      relations: ['entries', 'babyUsers', 'babyUsers.user'],
    });
    if (!baby) {
      throw new NotFoundException('Baby not found');
    }
    return baby;
  }

  async create(data: Partial<Baby>): Promise<Baby> {
    const baby = this.babyRepository.create(data);
    return this.babyRepository.save(baby);
  }

  async update(id: string, data: Partial<Baby>): Promise<Baby> {
    await this.babyRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.babyRepository.delete(id);
  }
}
