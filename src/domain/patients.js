export const STATUS_OPTIONS = [
  { value: 'all', label: 'All patients' },
  { value: 'completed', label: 'Completed' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'pending', label: 'Pending' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'saved', label: 'Yet to Submit' },
];

export function text(value, fallback = '—') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return value.map(v => text(v, '')).filter(Boolean).join(', ') || fallback;
  return fallback;
}

export function statusLabel(status) {
  if (status === 'report-generation-pending') return 'In Progress';
  return STATUS_OPTIONS.find(option => option.value === status)?.label || 'Status unavailable';
}

export function isPatientAvailable(patient) { return !!patient && !patient.deletionState; }

export function finalReport(patient) {
  if (patient?.status !== 'completed' || !isPatientAvailable(patient)) return null;
  const pdfs = Array.isArray(patient.pdfs) ? patient.pdfs : [];
  if (patient.finalReportKey) return pdfs.find(pdf => pdf?.s3Key === patient.finalReportKey
    && (!patient.finalReportId || pdf.reportId === patient.finalReportId)) || null;
  return [...pdfs].reverse().find(pdf => pdf?.source === 'report-builder'
    && typeof pdf.s3Key === 'string' && pdf.s3Key.length > 0) || null;
}

export function releasedReports(patient) {
  if (!isPatientAvailable(patient)) return [];
  const pdfs = (Array.isArray(patient.pdfs) ? patient.pdfs : []).filter(pdf => pdf && typeof pdf.s3Key === 'string' && pdf.s3Key);
  if (patient.status !== 'completed') return pdfs.filter(pdf => pdf.source === 'mdt');
  const final = finalReport(patient);
  return pdfs.filter(pdf => pdf.source !== 'report-builder' || pdf.s3Key === final?.s3Key);
}

export function documents(patient) {
  if (!isPatientAvailable(patient)) return [];
  return (Array.isArray(patient.additionalFiles) ? patient.additionalFiles : [])
    .filter(file => file && typeof file.s3Key === 'string' && file.s3Key
      && !/\.(?:zip|dcm|dicom|nii(?:\.gz)?|nrrd|mha|mhd|gz)$/i.test(file.fileName || file.name || file.s3Key));
}

export function matchesPatient(patient, search = '', status = 'all') {
  if (!isPatientAvailable(patient)) return false;
  const query = search.trim().toLowerCase();
  if (query && ![patient.name, patient.mrn, patient.hospitalId].some(value => text(value, '').toLowerCase().includes(query))) return false;
  return status === 'all' || patient.status === status || (status === 'in-progress' && patient.status === 'report-generation-pending');
}

export function ownsFile(key, uid) {
  return typeof uid === 'string' && !!uid && !uid.includes('/') && typeof key === 'string'
    && key.startsWith(`clients/${uid}/`) && !key.split('/').some(part => ['.', '..'].includes(part));
}

export function canOpenFile(patient, key, uid) {
  return ownsFile(key, uid) && [...releasedReports(patient), ...documents(patient)].some(file => file.s3Key === key);
}

export function dateLabel(value, options = {}) {
  const date = value?.toDate ? value.toDate() : new Date(value || '');
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...options });
}

export function initials(name) { return text(name, 'NC').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }

export function profileAccess(profile, user) {
  if (!profile) return 'missing';
  if (!user?.email || profile.email !== user.email) return 'identity';
  if ((profile.role || 'client') !== 'client') return 'role';
  if (profile.approvalStatus === 'declined') return 'declined';
  return profile.emailVerified === true ? 'approved' : 'pending';
}

export const PROFILE_FIELDS = ['name', 'designation', 'department', 'hospitalName', 'branch', 'phoneNumber'];
export function profilePatch(input) {
  return Object.fromEntries(PROFILE_FIELDS.map(key => [key, typeof input[key] === 'string' ? input[key].trim().slice(0, 255) : '']));
}
