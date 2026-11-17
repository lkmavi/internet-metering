import process from 'node:process';

/** Flush output if possible, then terminate despite terminal or HTTP handles. */
export async function exitAfterOutput() {
  const code = process.exitCode || 0;
  await Promise.race([
    Promise.all([
      new Promise((resolve) => process.stdout.write('', resolve)),
      new Promise((resolve) => process.stderr.write('', resolve)),
    ]),
    new Promise((resolve) => setTimeout(resolve, 100)),
  ]);
  process.exit(code);
}
