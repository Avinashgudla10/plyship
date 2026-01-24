import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function RoleSelectionScreen() {
  const { toggleRole } = useAuth();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'seeker' | 'company' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedRole) return;
    
    try {
      setLoading(true);
      await toggleRole(selectedRole);
      
      // Navigate to appropriate setup screen
      const setupRoute = selectedRole === 'seeker' 
        ? '/profile/seeker-setup' 
        : '/profile/company-setup';
      
      router.replace(setupRoute);
    } catch (error) {
      console.error('Error setting role:', error);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Who are you?</Text>
          <Text style={styles.subtitle}>
            Select your role to set up your profile
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedRole === 'seeker' && styles.optionCardSelected,
            ]}
            onPress={() => setSelectedRole('seeker')}
            activeOpacity={0.7}
          >
            <View style={[
              styles.iconContainer,
              selectedRole === 'seeker' && styles.iconContainerSelected
            ]}>
              <Ionicons
                name="home"
                size={56}
                color={selectedRole === 'seeker' ? '#FFFFFF' : '#FF6B6B'}
              />
            </View>
            <Text style={styles.optionTitle}>Home Interior Seeker</Text>
            <Text style={styles.optionDescription}>
              I'm looking for interior design services for my home or office
            </Text>
            <View style={styles.benefits}>
              <BenefitItem icon="search" text="Find best interior companies" />
              <BenefitItem icon="cash" text="Earn ₹500 per confirmed meeting" />
              <BenefitItem icon="people" text="Compare multiple options" />
            </View>
            {selectedRole === 'seeker' && (
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark-circle" size={28} color="#27AE60" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedRole === 'company' && styles.optionCardSelected,
            ]}
            onPress={() => setSelectedRole('company')}
            activeOpacity={0.7}
          >
            <View style={[
              styles.iconContainer,
              selectedRole === 'company' && styles.iconContainerSelected
            ]}>
              <Ionicons
                name="business"
                size={56}
                color={selectedRole === 'company' ? '#FFFFFF' : '#FF6B6B'}
              />
            </View>
            <Text style={styles.optionTitle}>Interior Company</Text>
            <Text style={styles.optionDescription}>
              I provide interior design services and want to find clients
            </Text>
            <View style={styles.benefits}>
              <BenefitItem icon="briefcase" text="Connect with potential clients" />
              <BenefitItem icon="images" text="Showcase your portfolio" />
              <BenefitItem icon="trending-up" text="Grow your business" />
            </View>
            {selectedRole === 'company' && (
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark-circle" size={28} color="#27AE60" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!selectedRole || loading) && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedRole || loading}
        >
          <Text style={styles.continueButtonText}>
            {loading ? 'Setting up...' : 'Continue'}
          </Text>
          <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const BenefitItem = ({ icon, text }: { icon: any; text: string }) => (
  <View style={styles.benefitItem}>
    <Ionicons name={icon} size={18} color="#636E72" />
    <Text style={styles.benefitText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
  },
  optionsContainer: {
    flex: 1,
    gap: 20,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    borderWidth: 3,
    borderColor: '#E9ECEF',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  optionCardSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
    shadowColor: '#FF6B6B',
    shadowOpacity: 0.2,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#FFE5E5',
  },
  iconContainerSelected: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  optionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436',
    textAlign: 'center',
    marginBottom: 12,
  },
  optionDescription: {
    fontSize: 15,
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  benefits: {
    gap: 12,
    marginTop: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  benefitText: {
    fontSize: 15,
    color: '#2D3436',
    flex: 1,
  },
  selectedBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 4,
  },
  continueButton: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonDisabled: {
    backgroundColor: '#95A5A6',
    opacity: 0.6,
    shadowOpacity: 0,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
