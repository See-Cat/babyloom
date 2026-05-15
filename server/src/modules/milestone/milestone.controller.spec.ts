import { Test, TestingModule } from '@nestjs/testing';
import { MilestoneController } from './milestone.controller';
import { MilestoneService } from './milestone.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Milestone } from '../../entities/milestone.entity';

describe('MilestoneController', () => {
  let controller: MilestoneController;

  const mockMilestoneRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MilestoneController],
      providers: [
        MilestoneService,
        {
          provide: getRepositoryToken(Milestone),
          useValue: mockMilestoneRepository,
        },
      ],
    }).compile();

    controller = module.get<MilestoneController>(MilestoneController);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return active milestones by default', async () => {
      const mockMilestones = [
        { id: '1', name: '翻身', isActive: true },
        { id: '2', name: '爬行', isActive: true },
      ];

      mockMilestoneRepository.find.mockResolvedValue(mockMilestones);

      const result = await controller.findAll();

      expect(result).toHaveLength(2);
      expect(mockMilestoneRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: [],
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
    });
  });

  describe('getAvailable', () => {
    it('should return available milestones excluding selected', async () => {
      const mockMilestones = [
        { id: '1', name: '翻身', isActive: true },
      ];

      mockMilestoneRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockMilestones),
      });

      const result = await controller.getAvailable('entry-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should create a new milestone', async () => {
      const mockMilestone = {
        id: '1',
        name: '走路',
        icon: '🚶',
        color: '#FF8C69',
        sortOrder: 1,
      };

      mockMilestoneRepository.create.mockReturnValue(mockMilestone);
      mockMilestoneRepository.save.mockResolvedValue(mockMilestone);

      const result = await controller.create({
        name: '走路',
        icon: '🚶',
        color: '#FF8C69',
      });

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('走路');
    });
  });
});
