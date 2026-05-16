export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Indirect import keeps webpack from following into native deps on edge build.
  const mod = await import('./instrumentation.node');
  await mod.ensureStartup();
}
