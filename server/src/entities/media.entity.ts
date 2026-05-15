import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Entry } from './entry.entity';
import { Baby } from './baby.entity';

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['photo', 'video'] })
  type: string;

  @Column()
  url: string;

  @Column({ nullable: true })
  thumbnail: string;

  @Column({ nullable: true })
  duration: number;

  @Column({ nullable: true })
  size: number;

  @ManyToOne(() => Entry, (entry) => entry.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entryId' })
  entry: Entry;

  @Column()
  entryId: string;

  @ManyToOne(() => Baby, (baby) => baby.entries)
  @JoinColumn({ name: 'babyId' })
  baby: Baby;

  @Column()
  babyId: string;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
