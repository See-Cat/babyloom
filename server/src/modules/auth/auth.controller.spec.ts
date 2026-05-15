import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;
  let userRepository: Repository<User>;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(() => 'mock-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return JWT token on valid credentials', async () => {
      const mockUser = {
        id: '1',
        username: 'test',
        password: await bcrypt.hash('password', 10),
        nickname: 'Test User',
        role: 'member',
        isActive: true,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await controller.login({
        username: 'test',
        password: 'password',
      });

      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result).toHaveProperty('user');
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.login({ username: 'wrong', password: 'wrong' }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const mockUser = {
        id: '1',
        username: 'test',
        password: await bcrypt.hash('password', 10),
        nickname: 'Test User',
        role: 'member',
        isActive: false,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        controller.login({ username: 'test', password: 'password' }),
      ).rejects.toThrow('Invalid credentials');
    });
  });
});
