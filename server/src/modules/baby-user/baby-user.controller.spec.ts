import { Test, TestingModule } from '@nestjs/testing';
import { BabyUserController } from './baby-user.controller';
import { BabyUserService } from './baby-user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BabyUser } from '../../entities/baby-user.entity';

describe('BabyUserController', () => {
  let controller: BabyUserController;

  const mockBabyUserRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BabyUserController],
      providers: [
        BabyUserService,
        {
          provide: getRepositoryToken(BabyUser),
          useValue: mockBabyUserRepository,
        },
      ],
    }).compile();

    controller = module.get<BabyUserController>(BabyUserController);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return baby-user relationships', async () => {
      const mockRelations = [
        {
          id: '1',
          babyId: 'baby-1',
          userId: 'user-1',
          relation: 'mom',
          canCreate: true,
          canDelete: false,
        },
      ];

      mockBabyUserRepository.find.mockResolvedValue(mockRelations);

      const result = await controller.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].relation).toBe('mom');
    });
  });

  describe('create', () => {
    it('should create baby-user relationship', async () => {
      const mockRelation = {
        id: '1',
        babyId: 'baby-1',
        userId: 'user-1',
        relation: 'dad',
        canCreate: true,
        canDelete: true,
      };

      mockBabyUserRepository.create.mockReturnValue(mockRelation);
      mockBabyUserRepository.save.mockResolvedValue(mockRelation);

      const result = await controller.create({
        babyId: 'baby-1',
        userId: 'user-1',
        relation: 'dad',
        canCreate: true,
        canDelete: true,
      });

      expect(result).toHaveProperty('id');
      expect(result.relation).toBe('dad');
    });
  });
});
