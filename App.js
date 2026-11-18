import React, {useEffect, useRef} from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/state/AppContext';
import AuthScreen from './src/screens/AuthScreen';
import AccessScreen from './src/screens/AccessScreen';
import PatientsScreen from './src/screens/PatientsScreen';
import PatientDetailScreen from './src/screens/PatientDetailScreen';
import UpdatesScreen from './src/screens/UpdatesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { Brand, DemoBanner, Icon, Loading, NoticeModal } from './src/ui/components';
import { colors } from './src/ui/theme';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const navigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.gold, background: colors.background, card: '#FFF', text: colors.ink, border: colors.line } };
function PatientsNavigator() { return <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}><Stack.Screen name="PatientList" component={PatientsScreen} /><Stack.Screen name="PatientDetail" component={PatientDetailScreen} /></Stack.Navigator>; }
function Workspace() {
  const { session, verifying, notificationTarget, consumeNotification } = useApp();
  const navigation = useRef(null);
  const openPending = () => {
    if (notificationTarget && notificationTarget.uid === session?.user?.uid && navigation.current?.isReady()) {
      navigation.current.navigate('Patients', {screen: 'PatientDetail', params: {patientId: notificationTarget.patientId}});
      consumeNotification();
    }
  };
  useEffect(openPending, [notificationTarget, session?.key, session?.user?.uid, consumeNotification]);
  const insets = useSafeAreaInsets();
  if (verifying) return <View style={styles.loading}><Brand /><Loading label="Checking your account…" /></View>;
  if (!session) return <AuthScreen />;
  if (session.access !== 'approved') return <AccessScreen />;
  return <View style={{ flex: 1 }}><DemoBanner /><NavigationContainer ref={navigation} key={session.key} theme={navigationTheme} onReady={openPending}>
    <Tabs.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.goldDark, tabBarInactiveTintColor: colors.faint,
      tabBarStyle: { borderTopColor: colors.line, backgroundColor: '#FFF', height: 66 + insets.bottom, minHeight: 66 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 6) },
      tabBarItemStyle: { minHeight: 48, paddingVertical: 3 }, tabBarLabelStyle: { fontSize: 10, lineHeight: 16, fontWeight: '500', flexShrink: 0, marginBottom: 0 },
      tabBarIcon: ({ focused, color, size }) => <Icon name={({ Patients: focused ? 'people' : 'people-outline', Updates: focused ? 'notifications' : 'notifications-outline', Profile: focused ? 'person-circle' : 'person-circle-outline' })[route.name]} color={color} size={size - 2} />,
    })}><Tabs.Screen name="Patients" component={PatientsNavigator} /><Tabs.Screen name="Updates" component={UpdatesScreen} /><Tabs.Screen name="Profile" component={ProfileScreen} /></Tabs.Navigator>
  </NavigationContainer></View>;
}
export default function App() { return <SafeAreaProvider><AppProvider><SafeAreaView style={styles.app} edges={['top']}><StatusBar style="dark" backgroundColor={colors.background} /><Workspace /><NoticeModal /></SafeAreaView></AppProvider></SafeAreaProvider>; }
const styles = StyleSheet.create({ app: { flex: 1, backgroundColor: colors.background }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
