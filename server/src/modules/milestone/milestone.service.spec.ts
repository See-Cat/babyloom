import { Test, TestingModule } from '@nestjs/testing';
import { MilestoneService } from './milestone.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Milestone } from '../../entities/milestone.entity';
import { Repository } from 'typeorm';

describe('MilestoneService', () => {
  let service: MilestoneService;
  let repository: Repository<Milestone>;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findBy: jest.fn(),
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
      providers: [
        MilestoneService,
        {
          provide: getRepositoryToken(Milestone),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MilestoneService>(MilestoneService);
    repository = module.get<Repository<Milestone>>(getRepositoryToken(Milestone));

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return active milestones ordered by sortOrder', async () => {
      const mockMilestones = [
        { id: '1', name: '翻身', sortOrder: 1, isActive: true },
        { id: '2', name: '爬行', sortOrder: 2, isActive: true },
      ];

      mockRepository.find.mockResolvedValue(mockMilestones);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: [],
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
    });

    it('should include entries when requested', async () => {
      const mockMilestones = [
        { id: '1', name: '翻身', entries: [] },
      ];

      mockRepository.find.mockResolvedValue(mockMilestones);

      await service.findAll({ includeEntries: true });

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: ['entries'],
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
    });
  });

  describe('getAvailableMilestones', () => {
    it('should return all active milestones when no entryId', async () => {
      const mockMilestones = [
        { id: '1', name: '翻身', isActive: true },
      ];

      mockRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockMilestones),
      });

      const result = await service.getAvailableMilestones();

      expect(result).toHaveLength(1);
    });

    it('should exclude already selected milestones', async () => {
      const mockMilestones = [
        { id: '2', name: '爬行', isActive: true },
      ];

      mockRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockMilestones),
      });

      const result = await service.getAvailableMilestones('entry-1');

      expect(result).toHaveLength(1);
      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('findByIds', () => {
    it('should return milestones by ids', async () => {
      const mockMilestones = [
        { id: '1', name: '翻身' },
        { id: '2', name: '爬行' },
      ];

      mockRepository.findBy.mockResolvedValue(mockMilestones);

      const result = await service.findByIds(['1', '2']);

      expect(result).toHaveLength(2);
    });
  });
});
