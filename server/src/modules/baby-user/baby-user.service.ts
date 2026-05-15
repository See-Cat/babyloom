import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BabyUser } from '../../entities/baby-user.entity';

@Injectable()
export class BabyUserService {
  constructor(
    @InjectRepository(BabyUser)
    private babyUserRepository: Repository<BabyUser>,
  ) {}

  async findAll(query: { babyId?: string; userId?: string }): Promise<BabyUser[]> {
    const where: any = {};
    if (query.babyId) {
      where.babyId = query.babyId;
    }
    if (query.userId) {
      where.userId = query.userId;
    }
    return this.babyUserRepository.find({
      where,
      relations: ['baby', 'user'],
    });
  }

  async findOne(id: string): Promise<BabyUser> {
    return this.babyUserRepository.findOne({
      where: { id },
      relations: ['baby', 'user'],
    });
  }

  async findByBabyAndUser(babyId: string, userId: string): Promise<BabyUser> {
    return this.babyUserRepository.findOne({
      where: { babyId, userId },
    });
  }

  async create(data: Partial<BabyUser>): Promise<BabyUser> {
    const babyUser = this.babyUserRepository.create(data);
    return this.babyUserRepository.save(babyUser);
  }

  async update(id: string, data: Partial<BabyUser>): Promise<BabyUser> {
    await this.babyUserRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.babyUserRepository.delete(id);
  }
}
