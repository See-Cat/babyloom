import { ServiceUnavailableError } from '@/lib/server/permissions/errors';

let backupInProgress = false;

export function setBackupInProgress(value: boolean) {
  backupInProgress = value;
}

export function isBackupInProgress() {
  return backupInProgress;
}

export function assertWritesAllowed() {
  if (backupInProgress) {
    throw new ServiceUnavailableError('backup_in_progress', 15);
  }
}
