export const DEMO_USER = { uid: 'demo-clinician', email: 'demo@example.invalid' };
export const DEMO_PROFILE = { name: 'Demo Clinician', email: DEMO_USER.email, role: 'client', emailVerified: true,
  designation: 'Consultant', department: 'Neurology', hospitalName: 'Sample Medical Centre', branch: 'Demo city', phoneNumber: '' };

const base = { owner: DEMO_USER.uid, referringCentre: 'Sample Medical Centre', physicianName: 'Demo Clinician',
  syndromeAetiology: 'Focal epilepsy', seizureFrequency: 'Recorded in the clinical history', numAsmsTried: 2,
  clinicalQuestion: 'Review the available clinical evidence for the epilepsy surgery evaluation.',
  pdfs: [], additionalFiles: [], analysesRequested: ['Integrated Full Report'] };
const report = (id, source = 'report-builder') => ({ name: source === 'mdt' ? 'EPIC discussion report' : 'Final analysis report',
  fileName: `${id}-sample.pdf`, s3Key: `clients/demo-clinician/reports/${id}.pdf`, source, reportId: `report-${id}`,
  createdAt: '2026-11-17T09:00:00.000Z' });

export const DEMO_PATIENTS = [
  { ...base, id: 'demo-001', name: 'Demo Patient 001', mrn: 'SAMPLE-001', age: 32, sex: 'Female', episodeId: 'NC-DEMO-001',
    status: 'completed', diagnosis: 'Focal epilepsy evaluation', createdAt: '2026-11-16T10:00:00.000Z', completedAt: '2026-11-17T09:00:00.000Z',
    seizureOnsetAge: 14, epilepsyDuration: 18, auraDescription: 'Sample clinical history for interface preview.', semiologyType: 'Focal impaired awareness',
    seizureSemiology: ['Behavioural arrest', 'Automatisms'], presumedLateralisation: 'Left', interictalEEG: 'Sample temporal epileptiform discharges.',
    ictalEEGOnset: 'Left temporal', eegMonitoringType: ['Video EEG'], asms: [{ drugName: 'Sample medication', dose: '100 mg', duration: 'Synthetic entry' }],
    fullScaleIQ: '95', verbalIQ: '98', performanceIQ: '94', memoryVerbal: 'Sample verbal memory assessment', memoryVisual: 'Sample visual memory assessment',
    languageDominance: 'Left', wadaFmriMethod: 'fMRI', wadaFmriResult: 'Synthetic language assessment',
    plannedSurgery: 'For EPIC discussion; no procedure selected', lesionLocation: 'Sample temporal region',
    relationshipToEloquentAreas: 'Sample assessment pending', intraOpMapping: 'To be discussed', areasOfConcern: 'Synthetic treatment-plan example.',
    surgeryHistory: [{ recordType: 'surgery', id: 'demo-surgery-1', plannedSurgery: 'Synthetic procedure example', surgeryDate: '2025-01-14', status: 'Completed' }],
    finalReportKey: 'clients/demo-clinician/reports/demo-001.pdf', finalReportId: 'report-demo-001', pdfs: [report('demo-001')],
    additionalFiles: [{ name: 'Clinical summary', fileName: 'sample-clinical-summary.pdf', type: 'clinical-profile', size: 148000,
      s3Key: 'clients/demo-clinician/documents/clinical-summary.pdf', uploadedAt: '2026-11-16T10:00:00.000Z' }] },
  { ...base, id: 'demo-002', name: 'Demo Patient 002', mrn: 'SAMPLE-002', age: 26, sex: 'Male', episodeId: 'NC-DEMO-002',
    status: 'in-progress', createdAt: '2026-11-15T08:30:00.000Z', startedAt: '2026-11-16T08:30:00.000Z', seizureOnsetAge: 11,
    clinicalQuestion: 'Review the submitted imaging alongside the clinical history.', interictalEEG: 'Sample EEG findings recorded for preview.' },
  { ...base, id: 'demo-003', name: 'Demo Patient 003', mrn: 'SAMPLE-003', age: 44, sex: 'Female', episodeId: 'NC-DEMO-003',
    status: 'pending', createdAt: '2026-11-14T14:00:00.000Z', submittedAt: '2026-11-15T14:00:00.000Z', diagnosis: 'Presurgical evaluation',
    pdfs: [{ ...report('demo-003-draft'), name: 'Unreleased sample draft' }] },
  { ...base, id: 'demo-004', name: 'Demo Patient 004', mrn: 'SAMPLE-004', age: 19, sex: 'Male', episodeId: 'NC-DEMO-004',
    status: 'on-hold', createdAt: '2026-11-13T11:20:00.000Z', updatedAt: '2026-11-16T11:20:00.000Z',
    clinicalQuestion: 'Awaiting additional clinical information before processing can continue.' },
  { ...base, id: 'demo-005', name: 'Demo Patient 005', mrn: 'SAMPLE-005', age: 38, sex: 'Female', episodeId: 'NC-DEMO-005',
    status: 'saved', createdAt: '2026-11-12T09:00:00.000Z', analysesRequested: [] },
  { ...base, id: 'demo-006', name: 'Demo Patient 006', mrn: 'SAMPLE-006', age: 29, sex: 'Male', episodeId: 'NC-DEMO-006',
    status: 'completed', createdAt: '2026-11-11T16:00:00.000Z', completedAt: '2026-11-16T09:15:00.000Z',
    finalReportKey: 'clients/demo-clinician/reports/demo-006.pdf', finalReportId: 'report-demo-006', pdfs: [report('demo-006'), report('demo-006-mdt', 'mdt')] },
  { ...base, id: 'demo-007', name: 'Demo Patient 007', mrn: 'SAMPLE-007', age: 41, sex: 'Female', episodeId: 'NC-DEMO-007',
    status: 'completed', createdAt: '2026-11-10T10:00:00.000Z', completedAt: '2026-11-15T08:00:00.000Z', pdfs: [],
    clinicalQuestion: 'Synthetic example of a completed case without a released report.' },
];
