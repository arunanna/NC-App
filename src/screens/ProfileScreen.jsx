import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { initials, text } from '../domain/patients';
import { Button, Card, Eyebrow, Field, Icon, Message, Paragraph, Screen, SectionTitle, Title } from '../ui/components';
import { colors } from '../ui/theme';

const FIELDS = [['name', 'Full name'], ['designation', 'Designation'], ['department', 'Speciality'], ['hospitalName', 'Hospital / affiliation'], ['branch', 'City'], ['phoneNumber', 'Phone number']];

export default function ProfileScreen() {
  const { session, saveProfile, logout, requestReset, showNotice, pushStatus, enablePush, disablePush } = useApp();
  const profile = session.profile || {};
  const [editing, setEditing] = useState(false); const [values, setValues] = useState(profile); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [resetBusy, setResetBusy] = useState(false);
  const save = async () => {
    setBusy(true); setError(''); setSuccess('');
    try { await saveProfile(values); setEditing(false); setSuccess(session.mode === 'demo' ? 'Profile updated for this demo session.' : 'Your profile has been updated.'); }
    catch (failure) { setError(failure.message || 'Unable to save your profile. Please try again.'); }
    finally { setBusy(false); }
  };
  const togglePush = async () => {
    if (session.mode === 'demo') { showNotice({title: 'Sample notification preference', message: 'Connected accounts can enable device alerts whenever a patient status changes. Demo mode never registers this device.'}); return; }
    try { if (pushStatus.state === 'enabled') await disablePush(); else await enablePush(); }
    catch (failure) { showNotice({title: 'Notifications unavailable', message: failure.message || 'Please retry.'}); }
  };
  const resetPassword = async () => {
    if (session.mode === 'demo') { showNotice({ title: 'Demo account', message: 'This sample account has no password. Connected doctors can request a reset link for their existing account.' }); return; }
    setResetBusy(true);
    try { await requestReset(session.user.email); showNotice({ title: 'Check your email', message: 'If an account exists for this email, a reset link has been sent.' }); }
    catch (failure) { showNotice({ title: 'Reset unavailable', message: failure.message }); }
    finally { setResetBusy(false); }
  };
  return <Screen>
    <View style={{ gap: 8 }}><Eyebrow>Your account</Eyebrow><Title>Profile</Title><Paragraph>Your details across the NeuroClarity workspace.</Paragraph></View>
    <Card style={styles.identity}><View style={styles.avatar}><Text style={styles.initials}>{initials(profile.name)}</Text></View><View style={{ flex: 1, gap: 5 }}><Text style={styles.name}>{text(profile.name, 'Doctor')}</Text><Text style={styles.email}>{text(session.user.email)}</Text><View style={styles.approved}><Icon name="shield-checkmark-outline" size={13} color={colors.green} /><Text style={styles.approvedText}>{session.mode === 'demo' ? 'Sample doctor account' : 'Account approved'}</Text></View></View></Card>
    {!!error && <Message>{error}</Message>}{!!success && <Message tone="info">{success}</Message>}
    <Card style={{ gap: 20 }}><SectionTitle title="Professional details" aside={!editing && <Button title="Edit" icon="create-outline" variant="quiet" style={{ minHeight: 36, paddingVertical: 7, paddingHorizontal: 8 }} onPress={() => { setValues(profile); setEditing(true); setError(''); setSuccess(''); }} />} />
      {FIELDS.map(([key, label]) => editing ? <Field key={key} label={label} value={typeof values[key] === 'string' ? values[key] : ''} onChangeText={value => setValues(previous => ({ ...previous, [key]: value }))} editable={!busy} maxLength={255} keyboardType={key === 'phoneNumber' ? 'phone-pad' : 'default'} autoComplete={key === 'name' ? 'name' : key === 'phoneNumber' ? 'tel' : undefined} />
        : <View key={key} style={styles.profileRow}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{text(profile[key], 'Not recorded')}</Text></View>)}
      {editing && <View style={styles.actions}><Button title="Cancel" variant="secondary" onPress={() => { setEditing(false); setError(''); }} disabled={busy} style={{ flex: 1 }} /><Button title="Save profile" onPress={save} busy={busy} style={{ flex: 1 }} /></View>}
    </Card>
    <Card style={{ gap: 16 }}><SectionTitle title="Account & preferences" /><View style={styles.preference}><Icon name="lock-closed-outline" /><View style={{ flex: 1, gap: 3 }}><Text style={styles.preferenceTitle}>Password</Text><Paragraph style={styles.small}>Send a reset link to your account email.</Paragraph></View><Button title="Reset" variant="quiet" onPress={resetPassword} busy={resetBusy} style={{ paddingHorizontal: 8 }} /></View><View style={styles.preference}><Icon name="notifications-outline" /><View style={{ flex: 1, gap: 3 }}><Text style={styles.preferenceTitle}>Push notifications</Text><Paragraph style={styles.small}>{session.mode === 'demo' ? 'Receive a device alert when a patient status changes.' : pushStatus.message}</Paragraph></View></View><Button title={pushStatus.state === 'enabled' && session.mode !== 'demo' ? 'Disable notifications' : 'Enable notifications'} icon="notifications-outline" variant="secondary" onPress={togglePush} busy={pushStatus.state === 'checking'} /></Card>
    <Button title={session.mode === 'demo' ? 'Leave demo' : 'Sign out'} icon="log-out-outline" variant="secondary" onPress={logout} />
    <Text style={styles.version}>NeuroClarity mobile · v0.1.0</Text>
  </Screen>;
}
const styles = StyleSheet.create({ identity: { flexDirection: 'row', alignItems: 'center', gap: 16 }, avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' }, initials: { fontSize: 21, color: colors.goldDark, fontWeight: '600' }, name: { fontSize: 19, color: colors.ink, fontWeight: '600', letterSpacing: -0.3 }, email: { fontSize: 12, color: colors.muted }, approved: { flexDirection: 'row', gap: 5, alignItems: 'center' , marginTop: 2 }, approvedText: { fontSize: 10, color: colors.green }, profileRow: { gap: 7, borderBottomWidth: 1, borderColor: '#F0F2ED', paddingBottom: 13 }, label: { color: colors.muted, fontSize: 11 }, value: { color: colors.ink, fontSize: 14 }, actions: { flexDirection: 'row', gap: 10 }, preference: { flexDirection: 'row', alignItems: 'center', gap: 12 }, preferenceTitle: { fontSize: 13, color: colors.ink, fontWeight: '600' }, small: { fontSize: 11, lineHeight: 18 }, version: { fontSize: 10, color: colors.faint, textAlign: 'center' } });
