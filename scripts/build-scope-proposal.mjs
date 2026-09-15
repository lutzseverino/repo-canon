import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [inspectionPath, templatePath, outputPath] = process.argv.slice(2);
if (!inspectionPath || !templatePath || !outputPath) {
  throw new Error('Usage: node scripts/build-scope-proposal.mjs <inspection.json> <template.json> <output.json>');
}

const inspection = JSON.parse(readFileSync(resolve(inspectionPath), 'utf8'));
const template = JSON.parse(readFileSync(resolve(templatePath), 'utf8'));
if (!['repo-standards/inspection/v2', 'repo-standards/inspection/v3'].includes(inspection.format)
    || typeof inspection.discovery?.identity !== 'string') {
  throw new Error('Inspection must be a discovery-required repo-standards inspection with a request identity.');
}
if (template.format !== 'repo-canon/scope-template/v1' || !Array.isArray(template.declarations)) {
  throw new Error('Template must use repo-canon/scope-template/v1.');
}

const evidence = new Map((inspection.discovery.evidence ?? []).map(item => [
  `${item.kind}:${item.path}`,
  item,
]));

function bind(reference) {
  if (reference.kind === 'absence') return { kind: 'absence', path: reference.path };
  const observed = evidence.get(`${reference.kind}:${reference.path}`);
  if (!observed) {
    throw new Error(`Inspection does not contain ${reference.kind} evidence for ${reference.path}.`);
  }
  return { kind: observed.kind, path: observed.path, identity: observed.identity };
}

const proposal = {
  format: 'repo-standards/scope/v1',
  request: inspection.discovery.identity,
  declarations: template.declarations.map(declaration => ({
    id: declaration.id,
    paths: declaration.paths,
    coverage: declaration.coverage,
    evidence: declaration.evidence.map(bind),
    candidates: declaration.candidates.map(candidate => ({
      path: candidate.path,
      decision: candidate.decision,
      reason: candidate.reason,
      evidence: candidate.evidence.map(bind),
    })),
    unresolved: declaration.unresolved,
  })),
};

writeFileSync(resolve(outputPath), `${JSON.stringify(proposal, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${resolve(outputPath)}\n`);
