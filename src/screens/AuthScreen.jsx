import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Brand, Button, Card, Eyebrow, Field, Icon, Message, Paragraph, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

export default function AuthScreen() {
  const { config, servicesAvailable, error: sessionError, signIn, exploreDemo, requestReset } = useApp();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [reset, setReset] = useState(false); const [success, setSuccess] = useState('');
  const submit = async () => {
    setError(''); setSuccess('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (!reset && !password) { setError('Enter your password.'); return; }
    setBusy(true);
    try {
      if (reset) { await requestReset(email); setSuccess('If an account exists for this email, a reset link has been sent.'); }
      else await signIn(email, password);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const demo = async () => { setBusy(true); try { await exploreDemo(); } catch { setError('Unable to open the demo. Please try again.'); } finally { setBusy(false); } };
  return <Screen contentStyle={styles.page}>
    <Brand />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.layout}>
      <View style={styles.intro}>
        <Eyebrow>For referring doctors</Eyebrow>
        <Title style={styles.headline}>Your patients.{ '\n' }Within reach.</Title>
        <Paragraph style={styles.description}>A little more clarity, wherever your day takes you. Follow your cases and keep the reports you need close at hand.</Paragraph>
        <View style={styles.features}>{[['people-outline', 'Your patient workspace'], ['document-text-outline', 'Reports, ready to review'], ['shield-checkmark-outline', 'Connected to your existing account']].map(([icon, label]) => <View key={label} style={styles.feature}><View style={styles.featureIcon}><Icon name={icon} size={18} color={colors.goldDark} /></View><Text style={styles.featureText}>{label}</Text></View>)}</View>
      </View>
      <Card style={styles.form}>
        <View style={styles.formHeading}><View style={styles.lock}><Icon name="medical-outline" size={22} color={colors.gold} /></View><View><Text style={styles.formTitle}>{reset ? 'Reset your password' : 'Welcome to NeuroClarity'}</Text><Paragraph style={{ fontSize: 12 }}>{reset ? 'We’ll send a link to your email.' : 'Your clinical workspace, simplified.'}</Paragraph></View></View>
        {!!(error || sessionError) && <Message>{error || sessionError}</Message>}
        {!!success && <Message tone="info">{success}</Message>}
        {servicesAvailable ? <>
          <Field label="Email address" placeholder="you@hospital.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" value={email} onChangeText={setEmail} editable={!busy} />
          {!reset && <Field label="Password" placeholder="Enter your password" secureTextEntry autoCapitalize="none" autoComplete="current-password" value={password} onChangeText={setPassword} editable={!busy} onSubmitEditing={submit} />}
          <Button title={reset ? 'Send reset link' : 'Sign in'} onPress={submit} busy={busy} icon={reset ? 'mail-outline' : 'arrow-forward'} />
          <Button title={reset ? 'Back to sign in' : 'Forgot password?'} variant="quiet" onPress={() => { setReset(!reset); setError(''); setSuccess(''); }} disabled={busy} />
          <View style={styles.divider}><View style={styles.rule} /><Text style={styles.dividerText}>OR TAKE A LOOK</Text><View style={styles.rule} /></View>
        </> : <>
          {config.error ? <Message>{config.error}</Message> : <Message tone="info">This preview uses sample data. Account sign-in becomes available once the development connection is configured.</Message>}
          <Paragraph>Explore the doctor experience with synthetic patients and sample case information.</Paragraph>
        </>}
        <Button title="Explore demo" icon="arrow-forward" variant={servicesAvailable ? 'secondary' : 'primary'} onPress={demo} disabled={busy} testID="explore-demo" />
        <Text style={styles.finePrint}>Sample data only. No account needed.</Text>
      </Card>
    </KeyboardAvoidingView>
    <View style={styles.footer}><View style={styles.footerDot} /><Text style={styles.footerText}>NeuroClarity · Doctor companion</Text></View>
  </Screen>;
}

const styles = StyleSheet.create({
  page: { maxWidth: 1140, paddingTop: 24, paddingBottom: 26, gap: 40, flex: 1 },
  layout: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 36, paddingVertical: 18 },
  intro: { flex: 1, minWidth: 270, gap: 18, paddingVertical: 14 }, headline: { fontSize: 48, lineHeight: 55, letterSpacing: -1.7 },
  description: { maxWidth: 410, fontSize: 16, lineHeight: 26 }, features: { gap: 13, marginTop: 10 }, feature: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  featureIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 13, color: colors.ink }, form: { flex: 1, minWidth: 280, maxWidth: 430, padding: 25, gap: 18 },
  formHeading: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 4 }, formTitle: { color: colors.ink, fontSize: 18, fontWeight: '600', marginBottom: 3 },
  lock: { backgroundColor: colors.goldLight, width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  finePrint: { color: colors.faint, fontSize: 11, textAlign: 'center' }, footer: { alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'center' },
  footerText: { fontSize: 11, color: colors.faint, letterSpacing: 0.3 }, footerDot: { width: 5, height: 5, backgroundColor: colors.gold, borderRadius: 3 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 }, rule: { height: 1, backgroundColor: colors.line, flex: 1 }, dividerText: { fontSize: 9, color: colors.faint, letterSpacing: 1 },
});
