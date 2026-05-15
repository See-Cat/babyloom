import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
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

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without password on valid credentials', async () => {
      const password = await bcrypt.hash('password', 10);
      const mockUser = {
        id: '1',
        username: 'test',
        password,
        nickname: 'Test User',
        role: 'member',
        isActive: true,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser('test', 'password');

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('password');
      expect(result.username).toBe('test');
    });

    it('should return null on invalid credentials', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('wrong', 'wrong');

      expect(result).toBeNull();
    });

    it('should return null for inactive user', async () => {
      const password = await bcrypt.hash('password', 10);
      const mockUser = {
        id: '1',
        username: 'test',
        password,
        isActive: false,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser('test', 'password');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return JWT token and user info', async () => {
      const mockUser = {
        id: '1',
        username: 'test',
        nickname: 'Test User',
        role: 'member',
        avatar: null,
      };

      const result = await service.login(mockUser);

      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result).toHaveProperty('user');
      expect(result.user).toEqual({
        id: '1',
        nickname: 'Test User',
        username: 'test',
        role: 'member',
        avatar: null,
      });
    });
  });

  describe('initAdmin', () => {
    it('should create admin if not exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ id: '1' });
      mockUserRepository.save.mockResolvedValue({ id: '1' });

      await service.initAdmin();

      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should not create admin if already exists', async () => {
      mockUserRepository.findOne.mockResolvedValue({ id: '1', role: 'admin' });

      await service.initAdmin();

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });
  });
});
