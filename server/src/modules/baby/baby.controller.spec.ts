import { Test, TestingModule } from '@nestjs/testing';
import { BabyController } from './baby.controller';
import { BabyService } from './baby.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Baby } from '../../entities/baby.entity';

describe('BabyController', () => {
  let controller: BabyController;

  const mockBabyRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BabyController],
      providers: [
        BabyService,
        {
          provide: getRepositoryToken(Baby),
          useValue: mockBabyRepository,
        },
      ],
    }).compile();

    controller = module.get<BabyController>(BabyController);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all babies', async () => {
      const mockBabies = [
        { id: '1', name: '宝宝1', birthDate: new Date() },
      ];

      mockBabyRepository.find.mockResolvedValue(mockBabies);

      const result = await controller.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('宝宝1');
    });
  });

  describe('create', () => {
    it('should create a new baby', async () => {
      const mockBaby = {
        id: '1',
        name: '宝宝2',
        birthDate: new Date('2024-01-01'),
        gender: 'boy',
      };

      mockBabyRepository.create.mockReturnValue(mockBaby);
      mockBabyRepository.save.mockResolvedValue(mockBaby);

      const result = await controller.create({
        name: '宝宝2',
        birthDate: new Date('2024-01-01'),
        gender: 'boy',
      });

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('宝宝2');
    });
  });
});
