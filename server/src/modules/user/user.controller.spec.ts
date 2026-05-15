import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';

describe('UserController', () => {
  let controller: UserController;

  const mockUserRepository = {
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
      controllers: [UserController],
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return users without deleted', async () => {
      const mockUsers = [
        { id: '1', username: 'user1', nickname: 'User 1', role: 'member' },
      ];

      mockUserRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      });

      const result = await controller.findAll();

      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const mockUser = {
        id: '1',
        username: 'newuser',
        nickname: 'New User',
        password: 'hashedpassword',
        role: 'member',
      };

      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await controller.create({
        username: 'newuser',
        nickname: 'New User',
        password: 'password123',
      });

      expect(result).toHaveProperty('id');
      expect(result.username).toBe('newuser');
    });
  });
});
