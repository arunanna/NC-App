import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Brand, Button, Card, Icon, Paragraph, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

export default function AccessScreen() {
  const { session, refreshAccount, logout } = useApp();
  const access = session?.access;
  const messages = {
    pending: ['Your account is awaiting approval', 'The NeuroClarity team will review your account. Your patient workspace will become available after approval.'],
    declined: ['Account access needs attention', 'Your registration has not been approved. Please contact the NeuroClarity team for help.'],
    identity: ['Please verify your account', 'Your account details could not be verified. Please contact the NeuroClarity team.'],
    role: ['This app is for referring doctors', 'Use a doctor account to access the mobile workspace. Administrative tools remain available on the website.'],
    missing: ['Your profile is unavailable', 'Please complete your registration on the NeuroClarity website or contact support.'],
  };
  const [title, description] = messages[access] || messages.missing;
  return <Screen contentStyle={styles.page}><Brand /><View style={styles.center}><Card style={styles.card}>
    <View style={styles.icon}><Icon name="shield-checkmark-outline" size={30} color={colors.gold} /></View>
    <Title style={{ fontSize: 25, lineHeight: 33, textAlign: 'center' }}>{title}</Title><Paragraph style={{ textAlign: 'center' }}>{description}</Paragraph>
    <Text style={styles.email}>{session?.user?.email}</Text><Button title="Check again" onPress={refreshAccount} icon="refresh-outline" /><Button title="Sign out" variant="quiet" onPress={logout} />
  </Card></View></Screen>;
}
const styles = StyleSheet.create({ page: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, card: { width: '100%', maxWidth: 440, gap: 19 },
  icon: { width: 64, height: 64, alignSelf: 'center', backgroundColor: colors.goldLight, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, email: { color: colors.muted, textAlign: 'center', fontSize: 12 } });
