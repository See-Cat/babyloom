import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Baby } from './baby.entity';
import { User } from './user.entity';

@Entity('baby_users')
export class BabyUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Baby, (baby) => baby.babyUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'babyId' })
  baby: Baby;

  @Column()
  babyId: string;

  @ManyToOne(() => User, (user) => user.babyUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: ['mom', 'dad', 'grandma', 'grandpa', 'other'],
    nullable: true,
  })
  relation: string;

  @Column({ default: true })
  canCreate: boolean;

  @Column({ default: false })
  canDelete: boolean;

  @Column({ default: true })
  canEdit: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
