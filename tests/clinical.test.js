import test from 'node:test';
import assert from 'node:assert/strict';
import { clinicalSections } from '../src/domain/clinical.js';
import { DEMO_PATIENTS } from '../src/data/demo.js';

test('clinical summaries read canonical Firestore neuropsychology and treatment fields', () => {
  const patient = { fullScaleIQ: 0, verbalIQ: '98', performanceIQ: '94', memoryVerbal: 'Verbal result', memoryVisual: 'Visual result',
    languageDominance: 'Left', wadaFmriMethod: 'fMRI', wadaFmriResult: 'Result', plannedSurgery: 'Plan', lesionLocation: 'Target',
    relationshipToEloquentAreas: 'Proximity', intraOpMapping: 'Mapping', areasOfConcern: 'Concern',
    neuropsychSummary: 'Wrong summary', treatmentPlan: 'Wrong plan' };
  const sections = clinicalSections(patient);
  assert.deepEqual(sections.find(section => section.id === 'neuropsychology').fields.map(([, value]) => value), [0, '98', '94', 'Verbal result', 'Visual result', 'Left', 'fMRI', 'Result']);
  assert.deepEqual(sections.find(section => section.id === 'treatment').fields.map(([, value]) => value), ['Plan', 'Target', 'Proximity', 'Mapping', 'Concern']);
});

test('legacy treatment snapshots are not relabelled as performed surgeries', () => {
  const sections = clinicalSections({ surgeryHistory: [{ plannedSurgery: 'Old plan' }, { recordType: 'surgery', plannedSurgery: 'Actual entry', surgeryDate: '2025-01-14' }] });
  const surgery = sections.filter(section => section.id.startsWith('surgery-'));
  assert.equal(surgery.length, 1);
  assert.equal(surgery[0].fields.find(([label]) => label === 'Planned surgery')[1], 'Actual entry');
});

test('Not done method does not expose an obsolete Wada/fMRI result', () => {
  const section = clinicalSections({ wadaFmriMethod: 'Not done', wadaFmriResult: 'Obsolete' }).find(section => section.id === 'neuropsychology');
  assert.equal(section.fields.some(([label]) => label === 'Wada / fMRI result'), false);
});

test('demo fixture exercises canonical clinical fields used by connected records', () => {
  const sections = clinicalSections(DEMO_PATIENTS[0]);
  assert.equal(sections.find(section => section.id === 'neuropsychology').fields[0][1], '95');
  assert.equal(sections.find(section => section.id === 'treatment').fields[0][1], 'For EPIC discussion; no procedure selected');
  assert.equal(sections.filter(section => section.id.startsWith('surgery-')).length, 1);
});

test('medication dose text is preserved without adding or interpreting units', () => {
  const sections = clinicalSections({ asms: [{ drugName: 'Synthetic A', dose: '500 mg/day' }, { drugName: 'Synthetic B', dose: 'SOS' }] });
  const value = sections[0].fields.find(([label]) => label === 'Medications')[1];
  assert.equal(value, 'Synthetic A · 500 mg/day\nSynthetic B · SOS');
});
