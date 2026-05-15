import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(includeDeleted = false): Promise<User[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .select(['user.id', 'user.username', 'user.nickname', 'user.role', 'user.avatar', 'user.isActive', 'user.createdAt']);

    if (!includeDeleted) {
      queryBuilder.where('user.deletedAt IS NULL');
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<User> {
    return this.userRepository.findOne({
      where: { id },
      select: ['id', 'username', 'nickname', 'role', 'avatar', 'isActive', 'createdAt'],
    });
  }

  async findByUsername(username: string): Promise<User> {
    return this.userRepository.findOne({
      where: { username },
    });
  }

  async create(data: Partial<User> & { password: string }): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = this.userRepository.create({
      ...data,
      password: hashedPassword,
    });
    return this.userRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    await this.userRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.softDelete(id);
  }

  async restore(id: string): Promise<User> {
    await this.userRepository.restore(id);
    return this.findOne(id);
  }
}
