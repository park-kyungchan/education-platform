import {commonInvocation, qualifyCommonProvider, readRepositoryWorkflow, repositoryPlan} from '../src/academy-repositories.ts';

const [mode, ...args] = Bun.argv.slice(2);
try {
  const workflow = await readRepositoryWorkflow();
  if (mode === 'plan' && args.length <= 1) console.log(JSON.stringify(repositoryPlan(workflow, args[0]), null, 2));
  else if (mode === 'work' && args.length >= 4 && args.at(-2) === '--provider') {
    const providerRoot = args.at(-1)!;
    const command = await commonInvocation(workflow, providerRoot, args[0]!, args.slice(1, -2));
    // The canonical CLI alone interprets Work records, dependencies and source currentness.
    const child = Bun.spawn(command, {stdin: 'ignore', stdout: 'inherit', stderr: 'inherit'});
    const code = await child.exited;
    await qualifyCommonProvider(workflow, providerRoot);
    process.exitCode = code;
  } else throw Error('usage: plan [repository] | work <canonical-command> <request.json> [after.json|source-path] --provider <pinned-agent-platform-root>');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'academy_repository_workflow_failed');
  process.exitCode = 1;
}
