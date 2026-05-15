import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/entities/user.entity';
import { Baby } from '../src/entities/baby.entity';
import { Entry } from '../src/entities/entry.entity';
import { Milestone } from '../src/entities/milestone.entity';
import * as bcrypt from 'bcryptjs';

describe('BabyLoom API E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockBabyRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockEntryRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    })),
  };

  const mockMilestoneRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(mockUserRepository)
      .overrideProvider(getRepositoryToken(Baby))
      .useValue(mockBabyRepository)
      .overrideProvider(getRepositoryToken(Entry))
      .useValue(mockEntryRepository)
      .overrideProvider(getRepositoryToken(Milestone))
      .useValue(mockMilestoneRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('POST /api/auth/login - should authenticate user', async () => {
      const password = await bcrypt.hash('password', 10);
      const mockUser = {
        id: '1',
        username: 'admin',
        password,
        nickname: 'Admin',
        role: 'admin',
        isActive: true,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password' })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      authToken = response.body.access_token;
    });

    it('POST /api/auth/login - should reject invalid credentials', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'wrong', password: 'wrong' })
        .expect(401);
    });
  });

  describe('Entries', () => {
    it('GET /api/entries - should return entries list', async () => {
      const mockEntries = [
        {
          id: '1',
          content: 'Test entry',
          babyId: 'baby-1',
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
        },
      ];

      mockEntryRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockEntries, 1]),
        getOne: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app.getHttpServer())
        .get('/api/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
    });

    it('POST /api/entries - should create new entry', async () => {
      const mockEntry = {
        id: '1',
        content: 'New entry',
        babyId: 'baby-1',
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
      };

      mockEntryRepository.create.mockReturnValue(mockEntry);
      mockEntryRepository.save.mockResolvedValue(mockEntry);

      const response = await request(app.getHttpServer())
        .post('/api/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'New entry', babyId: 'baby-1' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('New entry');
    });

    it('DELETE /api/entries/:id - should soft delete entry', async () => {
      mockEntryRepository.softDelete.mockResolvedValue({ affected: 1 });
      mockEntryRepository.update.mockResolvedValue({ affected: 1 });

      await request(app.getHttpServer())
        .delete('/api/entries/1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockEntryRepository.softDelete).toHaveBeenCalledWith('1');
    });
  });

  describe('Milestones', () => {
    it('GET /api/milestones - should return milestones', async () => {
      const mockMilestones = [
        { id: '1', name: '翻身', isActive: true },
        { id: '2', name: '爬行', isActive: true },
      ];

      mockMilestoneRepository.find.mockResolvedValue(mockMilestones);

      const response = await request(app.getHttpServer())
        .get('/api/milestones')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('POST /api/milestones - should create milestone', async () => {
      const mockMilestone = {
        id: '1',
        name: '走路',
        icon: '🚶',
        color: '#FF8C69',
      };

      mockMilestoneRepository.create.mockReturnValue(mockMilestone);
      mockMilestoneRepository.save.mockResolvedValue(mockMilestone);

      const response = await request(app.getHttpServer())
        .post('/api/milestones')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '走路', icon: '🚶' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('走路');
    });
  });

  describe('Users', () => {
    it('GET /api/users - should return users', async () => {
      const mockUsers = [
        { id: '1', username: 'user1', nickname: 'User 1', role: 'member' },
      ];

      mockUserRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      });

      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });
  });

  describe('Babies', () => {
    it('GET /api/baby - should return babies', async () => {
      const mockBabies = [
        { id: '1', name: '宝宝1', birthDate: new Date().toISOString() },
      ];

      mockBabyRepository.find.mockResolvedValue(mockBabies);

      const response = await request(app.getHttpServer())
        .get('/api/baby')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });
  });
});
