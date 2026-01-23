import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function Index() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [user, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF6B6B" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});