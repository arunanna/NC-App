import { text } from './patients.js';

const PLAN_FIELDS = [
  ['Planned surgery', 'plannedSurgery'], ['Lesion target', 'lesionLocation'],
  ['Eloquent proximity', 'relationshipToEloquentAreas'], ['Intra-op mapping', 'intraOpMapping'],
  ['Areas of concern', 'areasOfConcern'],
];

// These are the existing flat web/Firestore fields, not mobile-only summaries.
export function clinicalSections(patient) {
  const medications = (Array.isArray(patient.asms) ? patient.asms : [])
    .filter(item => typeof item?.drugName === 'string')
    .map(item => [item.drugName, text(item.dose, ''), text(item.duration, '')].filter(Boolean).join(' · ')).join('\n');
  const sections = [
    { id: 'history', title: 'Epilepsy history', icon: 'pulse-outline', fields: [
      ['Diagnosis', patient.diagnosis], ['Seizure type / aetiology', patient.syndromeAetiology], ['Age at onset', patient.seizureOnsetAge],
      ['Epilepsy duration', patient.epilepsyDuration], ['Seizure frequency', patient.seizureFrequency], ['Medications', medications], ['ASMs tried', patient.numAsmsTried],
    ] },
    { id: 'eeg', title: 'Semiology & EEG', icon: 'analytics-outline', fields: [
      ['Aura', patient.auraDescription], ['Semiology type', patient.semiologyType], ['Seizure semiology', patient.seizureSemiology],
      ['Presumed lateralisation', patient.presumedLateralisation], ['Interictal EEG', patient.interictalEEG], ['Ictal EEG onset', patient.ictalEEGOnset],
      ['Captured events', patient.ictalEventCount], ['Monitoring', patient.eegMonitoringType],
    ] },
    { id: 'neuropsychology', title: 'Neuropsychology', icon: 'bulb-outline', fields: [
      ['Full-scale IQ', patient.fullScaleIQ], ['Verbal IQ / VCI', patient.verbalIQ], ['Performance IQ / PRI', patient.performanceIQ],
      ['Verbal memory', patient.memoryVerbal], ['Visual memory', patient.memoryVisual], ['Language dominance', patient.languageDominance],
      ['Wada / fMRI method', patient.wadaFmriMethod],
      ...(patient.wadaFmriMethod === 'Not done' ? [] : [['Wada / fMRI result', patient.wadaFmriResult]]),
    ] },
    { id: 'treatment', title: 'Treatment plan', icon: 'clipboard-outline', fields: PLAN_FIELDS.map(([label, key]) => [label, patient[key]]) },
    { id: 'question', title: 'Clinical question & history', icon: 'document-text-outline', fields: [
      ['Clinical question', patient.clinicalQuestion], ['Prior epilepsy surgery', patient.priorEpilepsySurgery],
      ['Prior surgery details', patient.priorSurgeryDetails], ['Referring doctor', patient.physicianName || patient.referringPhysician],
    ] },
  ];
  // Unmarked legacy entries are treatment-plan snapshots, never actual surgeries.
  const surgeries = (Array.isArray(patient.surgeryHistory) ? patient.surgeryHistory : [])
    .filter(entry => entry?.recordType === 'surgery' && (text(entry.plannedSurgery, '') || text(entry.surgeryDate, ''))).slice(0, 5);
  surgeries.forEach((entry, index) => sections.push({ id: `surgery-${index}`, title: `Surgery ${index + 1}`, icon: 'medkit-outline', fields: [
    ['Surgery date', entry.surgeryDate], ['Status', entry.status], ...PLAN_FIELDS.map(([label, key]) => [label, entry[key]]),
  ] }));
  return sections;
}
