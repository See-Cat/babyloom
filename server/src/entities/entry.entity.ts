import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { Baby } from './baby.entity';
import { User } from './user.entity';
import { Media } from './media.entity';
import { Milestone } from './milestone.entity';

@Entity('entries')
export class Entry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @ManyToOne(() => Baby, (baby) => baby.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'babyId' })
  baby: Baby;

  @Column()
  babyId: string;

  @ManyToOne(() => User, (user) => user.entries)
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @Column()
  createdBy: string;

  @OneToMany(() => Media, (media) => media.entry, { cascade: true })
  media: Media[];

  @ManyToMany(() => Milestone, (milestone) => milestone.entries)
  milestones: Milestone[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @Column({ nullable: true })
  deletedBy: string;
}
