import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';

interface RoleSelectionModalProps {
  visible: boolean;
  onSelectRole: (role: 'seeker' | 'company') => void;
}

export default function RoleSelectionModal({ visible, onSelectRole }: RoleSelectionModalProps) {
  const [selectedRole, setSelectedRole] = useState<'seeker' | 'company' | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      onSelectRole(selectedRole);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to PLYSHIP!</Text>
            <Text style={styles.subtitle}>
              Tell us who you are to get started
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
                  size={48}
                  color={selectedRole === 'seeker' ? '#FFFFFF' : '#FF6B6B'}
                />
              </View>
              <Text style={styles.optionTitle}>Home Interior Seeker</Text>
              <Text style={styles.optionDescription}>
                I'm looking for interior design services for my home or office
              </Text>
              <View style={styles.benefits}>
                <BenefitItem text="Find best interior companies" />
                <BenefitItem text="Earn ₹500 per meeting" />
                <BenefitItem text="Compare multiple options" />
              </View>
              {selectedRole === 'seeker' && (
                <View style={styles.selectedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
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
                  size={48}
                  color={selectedRole === 'company' ? '#FFFFFF' : '#FF6B6B'}
                />
              </View>
              <Text style={styles.optionTitle}>Interior Company</Text>
              <Text style={styles.optionDescription}>
                I provide interior design services and want to find clients
              </Text>
              <View style={styles.benefits}>
                <BenefitItem text="Connect with seekers" />
                <BenefitItem text="Showcase your portfolio" />
                <BenefitItem text="Grow your business" />
              </View>
              {selectedRole === 'company' && (
                <View style={styles.selectedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.continueButton,
              !selectedRole && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!selectedRole}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const BenefitItem = ({ text }: { text: string }) => (
  <View style={styles.benefitItem}>
    <Ionicons name="checkmark-circle-outline" size={16} color="#27AE60" />
    <Text style={styles.benefitText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
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
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#E9ECEF',
    position: 'relative',
  },
  optionCardSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  iconContainerSelected: {
    backgroundColor: '#FF6B6B',
  },
  optionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2D3436',
    textAlign: 'center',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  benefits: {
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#2D3436',
    flex: 1,
  },
  selectedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  continueButton: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#95A5A6',
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
