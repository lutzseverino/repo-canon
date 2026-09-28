#!/usr/bin/env node

// Lists the source inputs the checked-out commit selects and shows the
// reviewed diff over them from the previous release tag. Inputs the previous
// tag selected and the candidate no longer does are listed and diffed too.

import { git, resolveCommit, resolveTag, runScript, sourceInputsAt, union } from './support.mjs';

await runScript('release:inputs', 'npm run release:inputs -- <previous-tag>', 1, previousTag => {
  const previous = resolveTag(previousTag);
  const candidate = resolveCommit('HEAD');
  const candidateInputs = sourceInputsAt(candidate);
  const dropped = sourceInputsAt(previous).filter(path => !candidateInputs.includes(path));

  console.log(`Source inputs the candidate ${candidate} selects:`);
  for (const path of candidateInputs) console.log(`  ${path}`);
  console.log('');
  if (dropped.length === 0) {
    console.log(`The candidate selects every input that ${previousTag} selected.`);
  } else {
    console.log(`Inputs that ${previousTag} selected and the candidate no longer selects:`);
    for (const path of dropped) console.log(`  ${path}`);
  }
  console.log('');

  const stat = git(['diff', '--stat', previous, candidate, '--', ...union(candidateInputs, dropped)]);
  if (stat.trim() === '') {
    console.log(`No source input changed since ${previousTag}.`);
  } else {
    console.log(`Reviewed diff from ${previousTag} over the source inputs:`);
    process.stdout.write(stat);
  }
});
