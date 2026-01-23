import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import RoleSelectionModal from '../components/RoleSelectionModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const { user, isLoading, toggleRole } = useAuth();
  const router = useRouter();
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [checkingFirstTime, setCheckingFirstTime] = useState(true);

  useEffect(() => {
    checkFirstTimeUser();
  }, [user, isLoading]);

  const checkFirstTimeUser = async () => {
    if (!isLoading && user) {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem('has_seen_welcome');
        
        if (!hasSeenWelcome) {
          // First time user - show role selection
          setShowRoleSelection(true);
          setCheckingFirstTime(false);
        } else {
          // Returning user - go to main app
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.error('Error checking first time user:', error);
        router.replace('/(tabs)');
      }
    } else if (!isLoading && !user) {
      router.replace('/(auth)/login');
    }
  };

  const handleRoleSelection = async (role: 'seeker' | 'company') => {
    try {
      // Set the role
      await toggleRole(role);
      
      // Mark as not first time user
      await AsyncStorage.setItem('has_seen_welcome', 'true');
      
      // Hide modal
      setShowRoleSelection(false);
      
      // Navigate to profile setup
      const setupRoute = role === 'seeker' 
        ? '/profile/seeker-setup' 
        : '/profile/company-setup';
      
      router.replace(setupRoute);
    } catch (error) {
      console.error('Error setting role:', error);
    }
  };

  if (isLoading || checkingFirstTime) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
      <RoleSelectionModal
        visible={showRoleSelection}
        onSelectRole={handleRoleSelection}
      />
    </>
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