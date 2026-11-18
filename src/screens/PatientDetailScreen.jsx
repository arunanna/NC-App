import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { dateLabel, documents, releasedReports, statusLabel, text } from '../domain/patients';
import { clinicalSections } from '../domain/clinical';
import { Button, Card, EmptyState, Eyebrow, Icon, Loading, Message, Paragraph, Screen, SectionTitle, StatusChip, Title } from '../ui/components';
import { colors } from '../ui/theme';
import AttachmentPicker from '../components/AttachmentPicker';
import {patientFromNotification} from '../domain/push';

function ValueRow({ label, value }) { return <View style={styles.valueRow}><Text style={styles.valueLabel}>{label}</Text><Text style={styles.valueText}>{text(value, 'Not recorded')}</Text></View>; }
function ClinicalCard({ title, icon, fields }) { return <Card style={styles.clinicalCard}><View style={styles.clinicalHeading}><Icon name={icon} size={18} color={colors.goldDark} /><Text accessibilityRole="header" style={styles.clinicalTitle}>{title}</Text></View>{fields.map(([label, value]) => <ValueRow key={label} label={label} value={value} />)}</Card>; }

function FileCard({ patient, file, report = false }) {
  const { viewFile, showNotice } = useApp();
  const [busy, setBusy] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const open = async download => {
    setBusy(download ? 'save' : 'open');
    try { await viewFile(patient, file, download); }
    catch (failure) { if (active.current) showNotice({ title: 'Document unavailable', message: failure.message || 'Please try again.' }); }
    finally { if (active.current) setBusy(''); }
  };
  return <Card style={styles.fileCard}>
    <View style={styles.fileTop}><View style={styles.fileIcon}><Icon name="document-text-outline" color={colors.goldDark} size={24} /></View><View style={{ flex: 1, gap: 4 }}><Text style={styles.fileName}>{text(file.name || file.fileName, report ? 'Report' : 'Clinical document')}</Text><Text style={styles.fileMeta}>{report ? file.source === 'mdt' ? 'EPIC / MDT report' : 'Released report' : ({ 'clinical-profile': 'Clinical profile', 'clinical-report': 'Clinical report', veeg: 'Video-EEG document', referral: 'Referral' }[file.type] || 'Clinical document')}{file.createdAt || file.uploadedAt ? ` · ${dateLabel(file.createdAt || file.uploadedAt)}` : ''}</Text></View></View>
    {!!file.pdfPassword && report && <View style={styles.password}><Icon name="lock-closed-outline" size={13} color={colors.goldDark} /><Text selectable style={styles.passwordText}>PDF password: {text(file.pdfPassword)}</Text></View>}
    <View style={styles.fileActions}><Button title="Open" icon="open-outline" variant="secondary" style={{ flex: 1 }} busy={busy === 'open'} disabled={!!busy} onPress={() => open(false)} /><Button title="Save" icon="download-outline" variant="secondary" style={{ flex: 1 }} busy={busy === 'save'} disabled={!!busy} onPress={() => open(true)} /></View>
  </Card>;
}

function Overview({ patient }) {
  const step = ['saved', 'pending', 'in-progress', 'completed'].indexOf(patient.status === 'report-generation-pending' ? 'in-progress' : patient.status);
  return <>
    <Card style={{ gap: 17 }}><SectionTitle title="Case progress" /><View style={styles.progressSteps}>{['Saved', 'Submitted', 'Processing', 'Completed'].map((label, index) => <View key={label} style={styles.progressItem}><View style={[styles.progressDot, index <= step && { backgroundColor: colors.gold, borderColor: colors.gold }]}>{index < step && <Icon name="checkmark" color="#FFF" size={11} />}</View><Text style={[styles.progressLabel, index <= step && { color: colors.ink }]}>{label}</Text>{index < 3 && <View style={[styles.progressLine, index < step && { backgroundColor: colors.gold }]} />}</View>)}</View>
      {patient.status === 'on-hold' && <Message tone="info">This case is on hold. Contact the NeuroClarity team for the next step.</Message>}
      <ValueRow label="Analyses requested" value={patient.analysesRequested} />
      <ValueRow label="Registered" value={dateLabel(patient.createdAt)} />
      {!!patient.submittedAt && <ValueRow label="Submitted" value={dateLabel(patient.submittedAt)} />}
      {!!patient.completedAt && <ValueRow label="Completed" value={dateLabel(patient.completedAt)} />}
    </Card>
    {clinicalSections(patient).map(section => <ClinicalCard key={section.id} {...section} />)}
  </>;
}

export default function PatientDetailScreen({ route, navigation }) {
  const { getPatient, patientUpdate, session } = useApp(); const { patientId } = route.params;
  const [patient, setPatient] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [tab, setTab] = useState('Overview');
  const request = useRef(0);
  const load = useCallback(async ({retain = false} = {}) => {
    const id = ++request.current; setLoading(true); setError(''); if (!retain) setPatient(null);
    try { const value = await getPatient(patientId); if (id === request.current) setPatient(value); }
    catch (failure) { if (id === request.current) setError(failure.message); }
    finally { if (id === request.current) setLoading(false); }
  }, [getPatient, patientId]);
  // A new record starts a fresh server read and clears the previous record immediately.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); return () => { request.current += 1; }; }, [load]);
  const appliedNotification = useRef(patientUpdate);
  useEffect(() => {
    if (appliedNotification.current === patientUpdate) return;
    const result = patientFromNotification(patientUpdate, {patientId, session});
    if (!result.applies) return;
    appliedNotification.current = patientUpdate;
    request.current += 1; // An older read cannot overwrite this fresh snapshot.
    // Consume this one-shot external push snapshot without starting another read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPatient(result.patient); setLoading(false); setError('');
  }, [patientUpdate, patientId, session]);
  const reports = releasedReports(patient); const docs = documents(patient);
  return <Screen refreshControl={<RefreshControl refreshing={loading && !!patient} onRefresh={() => load({retain: true})} tintColor={colors.gold} />}>
    <View style={styles.topbar}><Pressable accessibilityRole="button" accessibilityLabel="Back to patients" onPress={() => navigation.goBack()} style={styles.back}><Icon name="arrow-back" size={20} color={colors.ink} /><Text style={styles.backText}>Patients</Text></Pressable><Eyebrow>Patient workspace</Eyebrow></View>
    {!!error && !!patient && <Message>{error}</Message>}
    {loading && !patient ? <Loading label="Loading patient record…" /> : error && !patient ? <><Message>{error}</Message><Button title="Try again" onPress={load} variant="secondary" /></> : !patient ? <EmptyState title="Patient unavailable" message="This patient record is not available for this account." action={<Button title="Back to patients" variant="secondary" onPress={() => navigation.goBack()} />} /> : <>
      <View style={styles.patientHero}><View style={styles.patientHeading}><View style={{ flex: 1, gap: 8 }}><Eyebrow>{text(patient.episodeId, 'Patient record')}</Eyebrow><Title style={{ fontSize: 28 }}>{text(patient.name, 'Unnamed patient')}</Title><Paragraph>{text(patient.mrn || patient.hospitalId, 'No MRN')}  ·  {text(patient.age)} years  ·  {text(patient.sex)}</Paragraph></View><View style={styles.heroIcon}><Icon name="person-outline" color={colors.goldDark} size={29} /></View></View><View style={styles.heroFooter}><StatusChip status={patient.status} /><Text style={styles.centre}>{text(patient.referringCentre, 'Centre not recorded')}</Text></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{[['Overview', null], ['Reports', reports.length], ['Documents', docs.length]].map(([label, count]) => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: tab === label }} onPress={() => setTab(label)} style={[styles.tab, tab === label && styles.activeTab]}><Text style={[styles.tabText, tab === label && { color: colors.ink }]}>{label}</Text>{count !== null && <View style={[styles.tabCount, tab === label && { backgroundColor: colors.goldLight }]}><Text style={styles.tabCountText}>{count}</Text></View>}</Pressable>)}</ScrollView>
      {tab === 'Overview' ? <Overview patient={patient} /> : tab === 'Reports' ? <>
        <SectionTitle title="Reports" subtitle="Released reports available for this patient" />
        {reports.length ? reports.map((file, i) => <FileCard key={`${file.s3Key}-${i}`} patient={patient} file={file} report />) : <EmptyState icon="document-text-outline" title="No released reports yet" message={patient.status === 'completed' ? 'This case is marked completed. A released report is not available.' : `Current status: ${statusLabel(patient.status)}. Reports will appear here when released.`} />}
      </> : <><AttachmentPicker key={patient.id} patient={patient} onUploaded={() => load({retain: true})} /><SectionTitle title="Clinical documents" subtitle="Documents attached to this patient record" />{docs.length ? docs.map((file, i) => <FileCard key={`${file.s3Key}-${i}`} patient={patient} file={file} />) : <EmptyState title="No clinical documents" message="Choose files or take a photo to attach clinical documents." />}</>}
      <View style={styles.readOnly}><Icon name="shield-checkmark-outline" size={14} /><Text style={styles.readOnlyText}>Clinical information is read-only in this app.</Text></View>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, back: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { color: colors.ink, fontSize: 13, fontWeight: '500' },
  patientHero: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFF', borderRadius: 19, padding: 22, gap: 20 }, patientHeading: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' }, heroIcon: { width: 58, height: 58, borderRadius: 17, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }, centre: { color: colors.muted, fontSize: 11 }, tabs: { gap: 8 }, tab: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' }, activeTab: { backgroundColor: '#FFF', borderColor: colors.line }, tabText: { color: colors.muted, fontSize: 13, fontWeight: '600' }, tabCount: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: '#ECEFE8' }, tabCountText: { fontSize: 10, color: colors.goldDark },
  clinicalCard: { gap: 0 }, clinicalHeading: { flexDirection: 'row', gap: 9, alignItems: 'center', paddingBottom: 13 }, clinicalTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  valueRow: { gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F2ED' }, valueLabel: { fontSize: 11, color: colors.muted }, valueText: { fontSize: 13, lineHeight: 21, color: colors.ink },
  progressSteps: { flexDirection: 'row', paddingTop: 3, paddingBottom: 8 }, progressItem: { flex: 1, alignItems: 'center', gap: 7 }, progressDot: { zIndex: 2, width: 17, height: 17, borderRadius: 9, backgroundColor: '#FFF', borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, progressLabel: { color: colors.faint, fontSize: 9 }, progressLine: { height: 2, backgroundColor: colors.line, position: 'absolute', top: 8, left: '50%', width: '100%' },
  fileCard: { gap: 16 }, fileTop: { flexDirection: 'row', gap: 12, alignItems: 'center' }, fileIcon: { width: 45, height: 51, borderRadius: 12, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' }, fileName: { fontSize: 14, fontWeight: '600', color: colors.ink }, fileMeta: { fontSize: 10, color: colors.muted, lineHeight: 17 }, fileActions: { flexDirection: 'row', gap: 10 },
  password: { flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.goldLight, padding: 11, borderRadius: 8 }, passwordText: { color: colors.goldDark, fontSize: 11 }, readOnly: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }, readOnlyText: { fontSize: 10, color: colors.muted },
});
