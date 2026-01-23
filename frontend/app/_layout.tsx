import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile/seeker-setup" options={{ title: 'Setup Seeker Profile' }} />
          <Stack.Screen name="profile/company-setup" options={{ title: 'Setup Company Profile' }} />
          <Stack.Screen name="match/[id]" options={{ title: 'Match Details' }} />
          <Stack.Screen name="appointment/[id]" options={{ title: 'Appointment' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}