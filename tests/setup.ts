// Global test setup. Per-file temp dirs are created in each test's beforeEach.
(process.env as Record<string, string>).NODE_ENV = 'test';
