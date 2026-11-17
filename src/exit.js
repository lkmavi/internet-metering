import process from 'node:process';

/** Flush terminal output before exiting, even if HTTP keep-alive handles remain open. */
export async function exitAfterOutput() {
  await Promise.all([
    new Promise((resolve) => process.stdout.write('', resolve)),
    new Promise((resolve) => process.stderr.write('', resolve)),
  ]);
  process.exit(process.exitCode || 0);
}
