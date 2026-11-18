import React from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { statusLabel } from '../domain/patients';
import { useApp } from '../state/AppContext';
import { colors, shadow } from './theme';

export function Icon({ name, size = 20, color = colors.muted, ...props }) { return <Ionicons name={name} size={size} color={color} {...props} />; }
export function Brand({ small = false }) { return <Image source={require('../../assets/neuroclarity-logo.png')} resizeMode="contain" accessibilityLabel="NeuroClarity" style={{ width: small ? 145 : 183, height: small ? 36 : 48 }} />; }

export function Screen({ children, scroll = true, style, contentStyle, ...props }) {
  const container = <View style={[styles.content, contentStyle]}>{children}</View>;
  return <SafeAreaView style={[styles.screen, style]} edges={['left', 'right']}>
    {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} {...props}>{container}</ScrollView>
      : <View style={[styles.scroll, { flex: 1 }]}>{container}</View>}
  </SafeAreaView>;
}

export function Button({ title, onPress, variant = 'primary', icon, busy, disabled, style, testID, ...props }) {
  const muted = variant !== 'primary';
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
    onPress={onPress} disabled={disabled || busy} testID={testID}
    style={({ pressed }) => [styles.button, muted ? styles.buttonSecondary : styles.buttonPrimary,
      variant === 'quiet' && styles.buttonQuiet, (disabled || busy) && styles.buttonDisabled, pressed && { opacity: 0.82 }, style]} {...props}>
    {busy ? <ActivityIndicator size="small" color={muted ? colors.ink : '#FFF'} /> : !!icon && <Icon name={icon} size={18} color={muted ? colors.ink : '#FFF'} />}
    <Text style={[styles.buttonText, { color: muted ? colors.ink : '#FFF' }]}>{title}</Text>
  </Pressable>;
}

export function Card({ children, style, ...props }) { return <View style={[styles.card, style]} {...props}>{children}</View>; }
export function Eyebrow({ children, style }) { return <Text style={[styles.eyebrow, style]}>{children}</Text>; }
export function Title({ children, style }) { return <Text accessibilityRole="header" style={[styles.title, style]}>{children}</Text>; }
export function Paragraph({ children, style, ...props }) { return <Text style={[styles.paragraph, style]} {...props}>{children}</Text>; }
export function SectionTitle({ title, subtitle, aside }) { return <View style={styles.sectionHeader}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{!!subtitle && <Paragraph style={{ fontSize: 12, marginTop: 4 }}>{subtitle}</Paragraph>}</View>{aside}</View>; }

export function Field({ label, error, style, ...props }) { return <View style={[{ gap: 8 }, style]}>
  <Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.faint}
    style={[styles.input, error && { borderColor: colors.red }]} {...props} />
  {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
</View>; }

export function StatusChip({ status }) {
  const palette = status === 'completed' ? [colors.greenLight, colors.green] : ['in-progress', 'report-generation-pending'].includes(status)
    ? [colors.blueLight, colors.blue] : status === 'on-hold' ? [colors.redLight, colors.red] : status === 'pending' ? [colors.amberLight, colors.amber] : ['#EFF1ED', colors.muted];
  return <View style={[styles.chip, { backgroundColor: palette[0] }]}><View style={[styles.dot, { backgroundColor: palette[1] }]} /><Text style={{ color: palette[1], fontSize: 11, fontWeight: '600' }}>{statusLabel(status)}</Text></View>;
}

export function Message({ children, tone = 'error', style }) { return <View style={[styles.message, tone === 'error' ? { backgroundColor: colors.redLight } : { backgroundColor: colors.goldLight }, style]}><Icon name={tone === 'error' ? 'alert-circle-outline' : 'information-circle-outline'} color={tone === 'error' ? colors.red : colors.goldDark} size={18} /><Text accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.messageText, { color: tone === 'error' ? colors.red : colors.goldDark }]}>{children}</Text></View>; }

export function EmptyState({ icon = 'folder-open-outline', title, message, action }) { return <Card style={styles.empty}>
  <View style={styles.emptyIcon}><Icon name={icon} size={26} color={colors.gold} /></View><Text style={styles.sectionTitle}>{title}</Text><Paragraph style={{ textAlign: 'center', maxWidth: 360 }}>{message}</Paragraph>{action}
</Card>; }
export function Loading({ label = 'Loading…' }) { return <View style={styles.loading}><ActivityIndicator color={colors.gold} /><Paragraph>{label}</Paragraph></View>; }

export function DemoBanner() {
  const { session } = useApp();
  return session?.mode === 'demo' ? <View style={styles.demoBanner}><Icon name="flask-outline" size={14} color={colors.goldDark} /><Text style={styles.demoText}>Demo · sample data</Text></View> : null;
}

export function NoticeModal() {
  const { notice, dismissNotice } = useApp();
  return <Modal visible={!!notice} transparent animationType="fade" onRequestClose={dismissNotice}>
    <View style={styles.overlay}><Card style={styles.modal}><View style={styles.emptyIcon}><Icon name="document-text-outline" color={colors.gold} size={25} /></View><Text style={styles.sectionTitle}>{notice?.title}</Text><Paragraph>{notice?.message}</Paragraph><Button title="Got it" onPress={dismissNotice} /></Card></View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, scroll: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: 960, paddingHorizontal: 22, paddingBottom: 32, paddingTop: 17, gap: 22 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 20, ...shadow },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.7, color: colors.goldDark, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 30, fontWeight: '600', letterSpacing: -0.8, lineHeight: 38 },
  paragraph: { color: colors.muted, fontSize: 14, lineHeight: 22 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '600', letterSpacing: -0.25 },
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 17, paddingVertical: 12, gap: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: colors.gold }, buttonSecondary: { backgroundColor: '#FFF', borderColor: colors.line, borderWidth: 1 },
  buttonQuiet: { borderWidth: 0, backgroundColor: 'transparent' }, buttonDisabled: { opacity: 0.45 }, buttonText: { fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.ink },
  input: { minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontSize: 14 },
  errorText: { fontSize: 12, color: colors.red, lineHeight: 18 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3 }, message: { flexDirection: 'row', alignItems: 'flex-start', padding: 13, borderRadius: 10, gap: 8 }, messageText: { flex: 1, fontSize: 12, lineHeight: 19 },
  empty: { paddingVertical: 35, alignItems: 'center', gap: 12 }, emptyIcon: { width: 52, height: 52, borderRadius: 15, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  loading: { alignItems: 'center', justifyContent: 'center', padding: 45, gap: 12 },
  demoBanner: { paddingVertical: 7, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.goldLight, borderBottomWidth: 1, borderBottomColor: '#E8DCBE' },
  demoText: { color: colors.goldDark, fontSize: 10, fontWeight: '600', letterSpacing: 0.4 }, overlay: { flex: 1, backgroundColor: '#1E302D66', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { width: '100%', maxWidth: 410, gap: 17, padding: 26 },
});
