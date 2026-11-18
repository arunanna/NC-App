import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { dateLabel, isPatientAvailable, releasedReports, statusLabel, text } from '../domain/patients';
import { Card, EmptyState, Eyebrow, Icon, Message, Paragraph, Screen, StatusChip, Title } from '../ui/components';
import { colors } from '../ui/theme';

export default function UpdatesScreen({ navigation }) {
  const { loadedPatients } = useApp();
  const updates = loadedPatients.filter(isPatientAvailable).map(patient => ({ patient, date: patient.updatedAt || patient.completedAt || patient.startedAt || patient.submittedAt || patient.createdAt }))
    .sort((a, b) => (b.date?.toMillis?.() || new Date(b.date).getTime() || 0) - (a.date?.toMillis?.() || new Date(a.date).getTime() || 0));
  return <Screen>
    <View style={{ gap: 8 }}><Eyebrow>Your case activity</Eyebrow><Title>Updates</Title><Paragraph>A quick look at the latest recorded status of your loaded cases.</Paragraph></View>
    <Message tone="info">This feed reflects patients loaded during this session. Open Patients to load or refresh more cases.</Message>
    {updates.length ? updates.map(({ patient, date }) => {
      const reports = releasedReports(patient);
      return <Pressable key={patient.id} accessibilityRole="button" accessibilityLabel={`View update for ${text(patient.name)}`} onPress={() => navigation.navigate('Patients', { screen: 'PatientDetail', params: { patientId: patient.id } })}>
        <Card style={styles.card}><View style={[styles.icon, reports.length > 0 && { backgroundColor: colors.greenLight }]}><Icon name={reports.length > 0 ? 'document-text-outline' : 'time-outline'} size={22} color={reports.length > 0 ? colors.green : colors.goldDark} /></View><View style={styles.body}><Text style={styles.title}>{reports.length ? 'Released report available' : statusLabel(patient.status)}</Text><Text style={styles.name}>{text(patient.name, 'Patient')}</Text><View style={styles.bottom}><StatusChip status={patient.status} /><Text style={styles.date}>{dateLabel(date)}</Text></View></View><Icon name="chevron-forward" size={16} color={colors.faint} /></Card>
      </Pressable>;
    }) : <EmptyState icon="notifications-outline" title="No case activity loaded" message="Open Patients to load your cases. Their recorded status will appear here." />}
    <Paragraph style={styles.footnote}>Enable patient status push alerts in Profile. This list reflects cases loaded in your current session.</Paragraph>
  </Screen>;
}
const styles = StyleSheet.create({ card: { flexDirection: 'row', alignItems: 'flex-start', padding: 17, gap: 12 }, icon: { width: 40, height: 43, borderRadius: 12, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' }, body: { flex: 1, gap: 7 }, title: { color: colors.ink, fontSize: 14, fontWeight: '600' }, name: { color: colors.muted, fontSize: 12 }, bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 }, date: { color: colors.faint, fontSize: 10 }, footnote: { fontSize: 11, textAlign: 'center' } });
