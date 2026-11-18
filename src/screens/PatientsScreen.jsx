import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { dateLabel, initials, releasedReports, STATUS_OPTIONS, text } from '../domain/patients';
import { Brand, Button, Card, EmptyState, Eyebrow, Icon, Loading, Message, Paragraph, Screen, StatusChip, Title } from '../ui/components';
import { colors } from '../ui/theme';

function PatientCard({ patient, onPress }) {
  const reports = releasedReports(patient);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${text(patient.name, 'patient')}`} onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
    <Card style={styles.patientCard}>
      <View style={styles.patientTop}><View style={styles.patientAvatar}><Icon name="person-outline" size={21} color={colors.goldDark} /></View><View style={{ flex: 1, gap: 4 }}><Text style={styles.patientName}>{text(patient.name, 'Unnamed patient')}</Text><Text style={styles.patientMeta}>{text(patient.mrn || patient.hospitalId, 'No MRN')}  ·  {text(patient.age)} yr  ·  {text(patient.sex)}</Text></View><Icon name="chevron-forward" size={17} color={colors.faint} /></View>
      <View style={styles.patientMiddle}><StatusChip status={patient.status} />{reports.length > 0 && <View style={styles.reportHint}><Icon name="document-text-outline" size={13} color={colors.green} /><Text style={styles.reportHintText}>{reports.length === 1 ? 'Report available' : `${reports.length} reports`}</Text></View>}</View>
      <View style={styles.patientFooter}><Text numberOfLines={1} style={styles.patientCentre}>{text(patient.referringCentre, 'Centre not recorded')}</Text><Text style={styles.patientDate}>{dateLabel(patient.createdAt, { year: undefined })}</Text></View>
    </Card>
  </Pressable>;
}

export default function PatientsScreen({ navigation }) {
  const { session, listPatients, recordPatients } = useApp();
  const [search, setSearch] = useState(''); const [query, setQuery] = useState(''); const [status, setStatus] = useState('all');
  const [patients, setPatients] = useState([]); const [nextCursor, setNextCursor] = useState(null); const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false); const [error, setError] = useState('');
  const requestId = useRef(0); const controller = useRef(null); const mounted = useRef(true);
  useEffect(() => { const timeout = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timeout); }, [search]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); requestId.current += 1; }; }, []);
  const load = useCallback(async (cursor = null) => {
    const id = ++requestId.current;
    controller.current?.abort(); controller.current = new AbortController();
    if (cursor) setLoadingMore(true); else { setLoading(true); setPatients([]); }
    setError('');
    try {
      const result = await listPatients({ search: query, status, cursor }, controller.current.signal);
      if (!mounted.current || id !== requestId.current) return;
      setPatients(previous => cursor ? [...new Map([...previous, ...result.patients].map(patient => [patient.id, patient])).values()] : result.patients);
      setNextCursor(result.nextCursor); setHasNext(result.hasNext); recordPatients(result.patients);
    } catch (failure) {
      if (mounted.current && id === requestId.current && failure.name !== 'AbortError') setError(failure.message || 'Unable to load patients. Please try again.');
    } finally { if (mounted.current && id === requestId.current) { setLoading(false); setLoadingMore(false); } }
  }, [listPatients, query, recordPatients, status]);
  // The effect synchronizes this registry with a new server query, including its loading state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); return () => controller.current?.abort(); }, [load]);
  const completed = patients.filter(patient => patient.status === 'completed').length;
  const inProgress = patients.filter(patient => ['in-progress', 'report-generation-pending'].includes(patient.status)).length;
  const reportCount = patients.reduce((count, patient) => count + releasedReports(patient).length, 0);
  const name = text(session.profile?.name, 'Doctor').replace(/^Dr\.?\s+/i, '');
  const header = <View style={styles.headerContent}>
    <View style={styles.topbar}><Brand small /><Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => navigation.getParent()?.navigate('Profile')} style={styles.avatar}><Text style={styles.avatarText}>{initials(name)}</Text></Pressable></View>
    <View style={styles.greeting}><Eyebrow>Your clinical workspace</Eyebrow><Title>Welcome, Dr {name}</Title><Paragraph>Your patients, and the next step for every case.</Paragraph></View>
    <View style={styles.summary}>
      <View style={styles.summaryIntro}><View style={styles.summaryIcon}><Icon name="pulse-outline" color={colors.goldDark} size={21} /></View><View><Text style={styles.summaryTitle}>A little clarity for your day</Text><Text style={styles.summarySubtitle}>A snapshot of the patients in this view</Text></View></View>
      <View style={styles.stats}>{[[patients.length, 'Loaded patients'], [inProgress, 'In progress'], [completed, 'Completed']].map(([value, label]) => <View key={label} style={styles.stat}><Text style={styles.statNumber}>{loading ? '—' : value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View>
    </View>
    <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>Patients</Text><View style={styles.subtleTag}><Icon name="document-text-outline" size={13} color={colors.goldDark} /><Text style={styles.subtleTagText}>{reportCount} available reports in view</Text></View></View>
    <View style={styles.search}><Icon name="search-outline" size={19} /><TextInput accessibilityLabel="Search patient or MRN" placeholder="Search patient or MRN" placeholderTextColor={colors.faint} value={search} onChangeText={setSearch} style={styles.searchInput} autoCorrect={false} returnKeyType="search" />{!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} style={{ padding: 4 }}><Icon name="close-circle" size={18} /></Pressable>}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{STATUS_OPTIONS.map(option => <Pressable accessibilityRole="button" accessibilityState={{ selected: status === option.value }} key={option.value} onPress={() => setStatus(option.value)} style={[styles.filter, status === option.value && styles.filterActive]}><Text style={[styles.filterText, status === option.value && styles.filterTextActive]}>{option.label}</Text></Pressable>)}</ScrollView>
    {!!error && <Message>{error}</Message>}
  </View>;
  return <Screen scroll={false} contentStyle={styles.screenContent}>
    <FlatList data={loading ? [] : patients} keyExtractor={patient => patient.id} renderItem={({ item }) => <PatientCard patient={item} onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })} />}
      ListHeaderComponent={header} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} onRefresh={() => load()} refreshing={loading && patients.length > 0}
      ListEmptyComponent={loading ? <Loading label="Loading your patients…" /> : <EmptyState title={error ? 'Patients could not be loaded' : 'No patients found'} message={error ? 'Check your connection and try again.' : query || status !== 'all' ? 'Try a different name, MRN, or processing status.' : 'Patients added on the NeuroClarity website will appear here.'} action={error ? <Button title="Try again" onPress={() => load()} variant="secondary" icon="refresh-outline" /> : null} />}
      ListFooterComponent={<View style={styles.listFooter}>{!loading && hasNext && <Button title="Load more patients" variant="secondary" onPress={() => load(nextCursor)} busy={loadingMore} icon="add-outline" />}{!loading && patients.length > 0 && <Text style={styles.endText}>{hasNext ? `${patients.length} patients loaded · more available` : `${patients.length} ${patients.length === 1 ? 'patient' : 'patients'} in this view`}</Text>}{!!error && patients.length > 0 && <Button title="Retry loading" variant="quiet" onPress={() => load(nextCursor)} />}</View>} />
  </Screen>;
}

const styles = StyleSheet.create({
  screenContent: { flex: 1, gap: 0, paddingTop: 0, paddingBottom: 0 }, list: { paddingBottom: 24 }, headerContent: { gap: 20, paddingTop: 14, paddingBottom: 18 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8DCBE' }, avatarText: { fontSize: 11, fontWeight: '700', color: colors.goldDark },
  greeting: { gap: 8, paddingTop: 6 }, summary: { backgroundColor: '#EEF2EB', borderRadius: 18, padding: 19, gap: 20, borderWidth: 1, borderColor: '#E1E8DD' },
  summaryIntro: { flexDirection: 'row', gap: 10, alignItems: 'center' }, summaryIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  summaryTitle: { fontSize: 14, fontWeight: '600', color: colors.ink }, summarySubtitle: { fontSize: 11, color: colors.muted, marginTop: 3 }, stats: { flexDirection: 'row' }, stat: { flex: 1, gap: 4, paddingLeft: 3 },
  statNumber: { color: colors.ink, fontSize: 27, fontWeight: '600', letterSpacing: -0.8 }, statLabel: { color: colors.muted, fontSize: 11 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }, sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 },
  subtleTag: { flexDirection: 'row', alignItems: 'center', gap: 5 }, subtleTagText: { fontSize: 10, color: colors.goldDark },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: '#FFF', paddingHorizontal: 14, minHeight: 48, gap: 10 }, searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 14, paddingVertical: 12, outlineStyle: 'none' },
  filters: { gap: 8 }, filter: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 9, backgroundColor: '#FFF', borderWidth: 1, borderColor: colors.line }, filterActive: { borderColor: colors.ink, backgroundColor: colors.ink }, filterText: { color: colors.muted, fontSize: 11, fontWeight: '500' }, filterTextActive: { color: '#FFF' },
  patientCard: { padding: 17, gap: 14 }, patientTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, patientAvatar: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#F4F2E9', alignItems: 'center', justifyContent: 'center' },
  patientName: { color: colors.ink, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }, patientMeta: { fontSize: 11, color: colors.muted }, patientMiddle: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  reportHint: { flexDirection: 'row', alignItems: 'center', gap: 4 }, reportHintText: { fontSize: 10, color: colors.green }, patientFooter: { borderTopWidth: 1, borderColor: '#F0F2ED', paddingTop: 11, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  patientCentre: { fontSize: 10, color: colors.muted, flex: 1 }, patientDate: { fontSize: 10, color: colors.faint }, listFooter: { gap: 14, paddingTop: 20 }, endText: { fontSize: 10, color: colors.faint, textAlign: 'center' },
});
