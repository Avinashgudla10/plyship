import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useRouter } from 'expo-router';

const SPECIALIZATIONS = ['Residential', 'Commercial', 'Renovation', 'New Construction'];
const AREAS = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata'];

export default function CompanySetupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    service_areas: [] as string[],
    specializations: [] as string[],
    budget_min: '',
    budget_max: '',
    experience_years: '',
    description: '',
    contact: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/api/company/profile');
      if (response.data) {
        setFormData({
          company_name: response.data.company_name || '',
          service_areas: response.data.service_areas || [],
          specializations: response.data.specializations || [],
          budget_min: response.data.budget_min?.toString() || '',
          budget_max: response.data.budget_max?.toString() || '',
          experience_years: response.data.experience_years?.toString() || '',
          description: response.data.description || '',
          contact: response.data.contact || '',
        });
      }
    } catch (error) {
      console.log('No existing profile');
    }
  };

  const toggleItem = (list: string[], item: string) => {
    return list.includes(item)
      ? list.filter(i => i !== item)
      : [...list, item];
  };

  const handleSave = async () => {
    if (!formData.company_name || !formData.description || !formData.contact || 
        !formData.budget_min || !formData.budget_max || !formData.experience_years) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (formData.service_areas.length === 0) {
      Alert.alert('Error', 'Please select at least one service area');
      return;
    }

    if (formData.specializations.length === 0) {
      Alert.alert('Error', 'Please select at least one specialization');
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/company/profile', {
        company_name: formData.company_name,
        service_areas: formData.service_areas,
        specializations: formData.specializations,
        budget_min: parseInt(formData.budget_min),
        budget_max: parseInt(formData.budget_max),
        portfolio: [],
        experience_years: parseInt(formData.experience_years),
        description: formData.description,
        contact: formData.contact,
      });

      Alert.alert('Success', 'Profile saved successfully!', [
        { text: 'OK', onPress: () => {
          // Navigate to matches tab
          router.replace('/(tabs)');
        }}
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Setup Company Profile</Text>
          <Text style={styles.subtitle}>Tell seekers about your company</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Company Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.company_name}
              onChangeText={(text) => setFormData({ ...formData, company_name: text })}
              placeholder="e.g., Elite Interior Designs"
              placeholderTextColor="#95A5A6"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Tell clients about your company and expertise..."
              placeholderTextColor="#95A5A6"
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Contact Number *</Text>
            <TextInput
              style={styles.input}
              value={formData.contact}
              onChangeText={(text) => setFormData({ ...formData, contact: text })}
              placeholder="e.g., +91 9876543210"
              keyboardType="phone-pad"
              placeholderTextColor="#95A5A6"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Experience (Years) *</Text>
            <TextInput
              style={styles.input}
              value={formData.experience_years}
              onChangeText={(text) => setFormData({ ...formData, experience_years: text })}
              placeholder="e.g., 5"
              keyboardType="numeric"
              placeholderTextColor="#95A5A6"
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={styles.label}>Min Budget (\u20b9) *</Text>
              <TextInput
                style={styles.input}
                value={formData.budget_min}
                onChangeText={(text) => setFormData({ ...formData, budget_min: text })}
                placeholder="500000"
                keyboardType="numeric"
                placeholderTextColor="#95A5A6"
              />
            </View>

            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={styles.label}>Max Budget (\u20b9) *</Text>
              <TextInput
                style={styles.input}
                value={formData.budget_max}
                onChangeText={(text) => setFormData({ ...formData, budget_max: text })}
                placeholder="5000000"
                keyboardType="numeric"
                placeholderTextColor="#95A5A6"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Service Areas *</Text>
            <View style={styles.chipContainer}>
              {AREAS.map(area => (
                <TouchableOpacity
                  key={area}
                  style={[
                    styles.chip,
                    formData.service_areas.includes(area) && styles.chipSelected
                  ]}
                  onPress={() => setFormData({
                    ...formData,
                    service_areas: toggleItem(formData.service_areas, area)
                  })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      formData.service_areas.includes(area) && styles.chipTextSelected
                    ]}
                  >
                    {area}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Specializations *</Text>
            <View style={styles.chipContainer}>
              {SPECIALIZATIONS.map(spec => (
                <TouchableOpacity
                  key={spec}
                  style={[
                    styles.chip,
                    formData.specializations.includes(spec) && styles.chipSelected
                  ]}
                  onPress={() => setFormData({
                    ...formData,
                    specializations: toggleItem(formData.specializations, spec)
                  })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      formData.specializations.includes(spec) && styles.chipTextSelected
                    ]}
                  >
                    {spec}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : 'Save Profile'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#636E72',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  formGroupHalf: {
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE6E9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2D3436',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE6E9',
  },
  chipSelected: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  chipText: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
