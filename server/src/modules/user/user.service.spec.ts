import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return active users by default', async () => {
      const mockUsers = [
        { id: '1', username: 'user1', nickname: 'User 1', deletedAt: null },
      ];

      mockRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      });

      const result = await service.findAll();

      expect(result).toHaveLength(1);
    });

    it('should include deleted users when requested', async () => {
      const mockUsers = [
        { id: '1', username: 'user1', deletedAt: new Date() },
      ];

      mockRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      });

      const result = await service.findAll(true);

      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should hash password before saving', async () => {
      const mockUser = {
        id: '1',
        username: 'newuser',
        nickname: 'New User',
        password: 'hashed',
        role: 'member',
      };

      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.create({
        username: 'newuser',
        nickname: 'New User',
        password: 'plainpassword',
      });

      expect(result).toHaveProperty('id');
      expect(mockRepository.create).toHaveBeenCalled();
      const createCall = mockRepository.create.mock.calls[0][0];
      expect(createCall.password).not.toBe('plainpassword');
    });
  });

  describe('update', () => {
    it('should hash password if provided', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValue({
        id: '1',
        username: 'user1',
      });

      await service.update('1', { password: 'newpassword' });

      expect(mockRepository.update).toHaveBeenCalled();
      const updateCall = mockRepository.update.mock.calls[0][1];
      expect(updateCall.password).not.toBe('newpassword');
    });
  });

  describe('remove', () => {
    it('should soft delete user', async () => {
      mockRepository.softDelete.mockResolvedValue({ affected: 1 });

      await service.remove('1');

      expect(mockRepository.softDelete).toHaveBeenCalledWith('1');
    });
  });
});
